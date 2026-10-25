"""Teste de robustețe: „ce se întâmplă dacă...” (vezi tests.md, auditul 2).

Rulează pe o bază separată, santa_audit2, recreată la fiecare rulare.
Necesită Postgres pornit (docker compose up -d db) și, pentru R8,
backendul de dezvoltare pornit pe localhost:5000.
Rulare (din rădăcina proiectului):
    .venv/Scripts/python.exe security_tests/audit_robustness.py
"""
import os, sys, time, json, sqlite3, threading, urllib.request, urllib.error
import psycopg
from dotenv import load_dotenv

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
load_dotenv(os.path.join(ROOT, '.env'))
PG = os.environ['POSTGRES_PASSWORD']

with psycopg.connect(f'host=localhost port=5432 user=santa password={PG} dbname=santa', autocommit=True) as conn:
    conn.execute('DROP DATABASE IF EXISTS santa_audit2')
    conn.execute('CREATE DATABASE santa_audit2')
os.environ['DATABASE_URL'] = f'postgresql+psycopg://santa:{PG}@localhost:5432/santa_audit2'
os.environ['FLASK_DEBUG'] = '0'

from sqlalchemy import event
from app import create_app, db, limiter
from app.models import SantaGroup, Participant
from app.services.delivery_service import deliver_one
import app.services.email_service as es

app = create_app()
c = app.test_client()
R = {}


def show(key, value):
    R[key] = value
    print(f'{key}: {value}')


def admin(code):
    return {'X-Admin-Code': code}


def group_with(n, smtp=True):
    # Emailul e obligatoriu; parametrul smtp a rămas doar pentru citirea testelor.
    limiter.reset()
    body = {'name': 'Robustete', 'budget': 50, 'smtp_provider': 'gmail', 'smtp_email': 'org@gmail.com', 'smtp_password': 'x'}
    g = c.post('/api/groups', json=body).get_json()
    for i in range(n):
        limiter.reset()
        c.post(f"/api/groups/{g['code']}/participants", json={'name': f'p{i}', 'email': f'p{i}@ex.ro'})
    return g


fast_send = lambda group, to, subject, html: True
es._send = fast_send

# R1. Tragere cu server de email lent
def slow_send(group, to, subject, html):
    time.sleep(1.0)
    return True
g = group_with(8)
es._send = slow_send
t = time.time()
c.post('/api/admin/draw', headers=admin(g['admin_code']))
duration = round(time.time() - t, 1)
es._send = fast_send
show('R1_tragere_8_emailuri_lente_1s', f'{duration}s')
show('R1_cel_mai_rau_caz_100_participanti_timeout_15s', f'{100 * 15}s în worker, în afara cererii web; progres salvat individual')

# R2. Cât durează alte cereri în timpul trimiterii
g = group_with(6)
es._send = slow_send
timings = {}
def draw():
    with app.test_client() as tc:
        tc.post('/api/admin/draw', headers=admin(g['admin_code']))
    with app.app_context():
        while deliver_one():
            pass
th = threading.Thread(target=draw)
th.start()
time.sleep(0.8)
for label, fn in [
    ('GET public', lambda tc: tc.get(f"/api/groups/{g['code']}")),
    ('GET admin (polling)', lambda tc: tc.get('/api/admin', headers=admin(g['admin_code']))),
]:
    with app.test_client() as tc:
        t = time.time()
        fn(tc)
        timings[label] = f'{round(time.time() - t, 1)}s'
th.join()
es._send = fast_send
show('R2_latenta_in_timpul_trimiterii', timings)

# R3. Serverul moare la jumătatea trimiterii (ex. timeout gunicorn)
class WorkerKilled(BaseException):
    pass
sent = []
def dying_send(group, to, subject, html):
    if len(sent) == 3:
        raise WorkerKilled()
    sent.append(to)
    return True
g = group_with(6)
es._send = dying_send
try:
    c.post('/api/admin/draw', headers=admin(g['admin_code']))
    with app.app_context():
        while deliver_one():
            pass
except WorkerKilled:
    pass
es._send = fast_send
with app.app_context():
    grp = db.session.get(SantaGroup, g['id'])
    marked = sum(p.email_sent for p in grp.participants)
    show('R3_dupa_oprire', {'emailuri_plecate_de_fapt': len(sent), 'marcate_in_baza': marked, 'is_drawn': grp.is_drawn})
limiter.reset()
resent = []
es._send = lambda group, to, subject, html: resent.append(to) or True
c.post('/api/admin/resend', json={}, headers=admin(g['admin_code']))
with app.app_context():
    while deliver_one():
        pass
es._send = fast_send
show('R3_retrimitere_dubluri', f'{len(set(sent) & set(resent))} persoane primesc același email de două ori')

# R4. Cineva cu linkul de invitație umple grupul (de pe mai multe IP-uri)
g = group_with(0, smtp=False)
limiter.reset()
codes = []
for i in range(100):
    ip = f'10.0.{i // 10}.{i % 10 + 1}'
    r = c.post(f"/api/groups/{g['code']}/participants", json={'name': f'bot{i}', 'email': f'bot{i}@ex.ro'},
               environ_base={'REMOTE_ADDR': ip})
    codes.append(r.status_code)
r = c.post(f"/api/groups/{g['code']}/participants", json={'name': 'Prieten real', 'email': 'prieten@ex.ro'},
           environ_base={'REMOTE_ADDR': '192.0.2.50'})
show('R4_grup_umplut', {'boti_inscrisi': codes.count(201), 'prieten_real': f"{r.status_code} {r.get_json()['error']}"})

# R5. Rută API inexistentă
r = c.get('/api/nu-exista')
show('R5_get_api_inexistent', f"{r.status_code} {r.headers.get('Content-Type')}")
r = c.post('/api/nu-exista', json={})
show('R5_post_api_inexistent', f"{r.status_code} {r.headers.get('Content-Type')}")

# R6. Câte interogări SQL face /api/stats
for _ in range(40):
    group_with(3, smtp=False)
statements = []
with app.app_context():
    listener = lambda conn, cursor, stmt, *a: statements.append(stmt)
    event.listen(db.engine, 'before_cursor_execute', listener)
    t = time.time()
    c.get('/api/stats')
    elapsed = round((time.time() - t) * 1000)
    event.remove(db.engine, 'before_cursor_execute', listener)
with app.app_context():
    groups = SantaGroup.query.count()
show('R6_stats', f'{len(statements)} interogări SQL pentru {groups} grupuri, {elapsed} ms')

# R7. Format dată
g = group_with(1, smtp=False)
created = c.get('/api/admin', headers=admin(g['admin_code'])).get_json()['created_at']
show('R7_created_at', f"{created} (fără fus orar: {'Z' not in created and '+' not in created})")

# R8. Consola Werkzeug pe serverul de dezvoltare (FLASK_DEBUG=1 în .env)
def probe(path, host=None):
    req = urllib.request.Request('http://localhost:5000' + path, headers={'Host': host} if host else {})
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            body = resp.read().decode('utf-8', 'replace')
            return resp.status, 'Werkzeug' in body or 'console' in body.lower()
    except urllib.error.HTTPError as e:
        return e.code, False
    except Exception as e:
        return f'nepornit ({type(e).__name__})', False
show('R8_console_localhost', probe('/console'))
show('R8_console_host_strain', probe('/console', host='santa-demo.ngrok-free.app'))

# R9. Vechea bază SQLite
old = os.path.join(ROOT, 'instance', 'santa.db')
if os.path.exists(old):
    con = sqlite3.connect(old)
    cols = [r[1] for r in con.execute('PRAGMA table_info(santa_groups)')]
    rows = con.execute('select smtp_email, smtp_password from santa_groups').fetchall() if 'smtp_password' in cols else []
    show('R9_sqlite_vechi', {
        'grupuri': con.execute('select count(*) from santa_groups').fetchone()[0],
        'participanti': con.execute('select count(*) from participants').fetchone()[0],
        'parole_smtp_in_clar': sum(1 for e, p in rows if p),
    })
    con.close()
else:
    show('R9_sqlite_vechi', 'nu există')

json.dump(R, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'audit_robustness_results.json'), 'w', encoding='utf-8'),
          ensure_ascii=False, indent=1)
print('\nDONE')
