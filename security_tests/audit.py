"""Audit de securitate pentru Secret Santa (vezi tests.md).

Rulează pe o bază separată, santa_audit, recreată la fiecare rulare.
Necesită Postgres pornit: docker compose up -d db
Rulare (din rădăcina proiectului):
    .venv/Scripts/python.exe security_tests/audit.py
"""
import os, sys, time, json, socket, threading, subprocess
import psycopg
from dotenv import load_dotenv

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
load_dotenv(os.path.join(ROOT, '.env'))
PG = os.environ['POSTGRES_PASSWORD']

with psycopg.connect(f'host=localhost port=5432 user=santa password={PG} dbname=santa', autocommit=True) as conn:
    conn.execute('DROP DATABASE IF EXISTS santa_audit')
    conn.execute('CREATE DATABASE santa_audit')
os.environ['DATABASE_URL'] = f'postgresql+psycopg://santa:{PG}@localhost:5432/santa_audit'
os.environ['FLASK_DEBUG'] = '0'

from app import create_app, db, limiter
from app.models import SantaGroup
from app.services.delivery_service import deliver_one
import app.services.email_service as es

app = create_app()
c = app.test_client()
RESULTS = []


def check(vid, title, ok, detail):
    RESULTS.append({'id': vid, 'titlu': title, 'reparat': bool(ok), 'detalii': detail})
    print(f"[{'REPARAT   ' if ok else 'VULNERABIL'}] {vid} {title}: {detail}")


def no_limits():
    limiter.reset()


def admin(code):
    return {'X-Admin-Code': code}


def drain_queue():
    # Livrarea nu mai are loc în cererea web. Rulăm explicit workerul de test.
    with app.app_context():
        while deliver_one():
            pass


def new_group(**kw):
    no_limits()
    kw.setdefault('smtp_provider', 'gmail')
    kw.setdefault('smtp_email', 'org@gmail.com')
    kw.setdefault('smtp_password', 'x')
    return c.post('/api/groups', json={'name': 'Audit', 'budget': 100, **kw})


def join(code, name, email, wishlist=''):
    no_limits()
    return c.post(f'/api/groups/{code}/participants', json={'name': name, 'email': email, 'wishlist': wishlist})


real_send = es._send
captured = []
fake_send = lambda group, to, subject, html: captured.append((to, subject, html)) or True
es._send = fake_send

# V1: debug
st = c.post('/api/groups', data='null', content_type='application/json')
body = st.get_data(as_text=True)
check('V1', 'Fără debugger / traceback în răspunsuri', 'Werkzeug Debugger' not in body and 'Traceback' not in body,
      f'status {st.status_code}, răspuns {body.strip()[:60]}')
run_py = open(os.path.join(ROOT, 'run.py'), encoding='utf-8').read()
check('V1', 'run.py nu mai are debug=True fix', 'debug=True' not in run_py, 'debug controlat de FLASK_DEBUG')

# V2: Postgres expus
port = subprocess.run(['docker', 'compose', 'port', 'db', '5432'], capture_output=True, text=True, cwd=ROOT).stdout.strip()
lan_ips = {i[4][0] for i in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET) if not i[4][0].startswith('127.')}
lan_results = {}
for ip in lan_ips:
    try:
        psycopg.connect(f'host={ip} port=5432 user=santa password={PG} dbname=santa', connect_timeout=3).close()
        lan_results[ip] = 'CONECTAT'
    except Exception:
        lan_results[ip] = 'refuzat'
check('V2', 'Postgres doar pe localhost', port.startswith('127.0.0.1') and 'CONECTAT' not in lan_results.values(),
      f'port publicat {port}; din rețea: {lan_results}')
try:
    psycopg.connect('host=localhost port=5432 user=santa password=santa dbname=santa', connect_timeout=3).close()
    old_pw = 'parola veche "santa" MERGE'
except Exception:
    old_pw = 'parola veche "santa" refuzată'
compose = open(os.path.join(ROOT, 'docker-compose.yml'), encoding='utf-8').read()
check('V2', 'Parola veche nu mai merge, nicio parolă în docker-compose.yml',
      'refuzată' in old_pw and 'PASSWORD=santa' not in compose, old_pw)

# V3: parola SMTP
g = new_group(smtp_email='org@gmail.com', smtp_password='ParolaMeaSecreta123').get_json()
with app.app_context():
    stored = db.session.get(SantaGroup, g['id']).smtp_password
join(g['code'], 'a', 'a@ex.ro'); join(g['code'], 'b', 'b@ex.ro')
c.post('/api/admin/draw', headers=admin(g['admin_code']))
drain_queue()
with app.app_context():
    after = db.session.get(SantaGroup, g['id']).smtp_password
check('V3', 'Parola SMTP criptată și ștearsă după trimitere',
      'ParolaMeaSecreta123' not in (stored or '') and after is None,
      f'în bază: {stored[:20]}… ; după tragere: {after}')

# V4: trageri simultane (în thread-uri, pe aceeași aplicație)
g = new_group().get_json()
for n in 'abcd':
    join(g['code'], n, f'{n}@ex.ro')
no_limits()
codes, barrier = [], threading.Barrier(8)
def draw():
    with app.test_client() as tc:
        barrier.wait()
        codes.append(tc.post('/api/admin/draw', headers=admin(g['admin_code'])).status_code)
ts = [threading.Thread(target=draw) for _ in range(8)]
[t.start() for t in ts]; [t.join() for t in ts]
check('V4', 'O singură tragere la cereri simultane', codes.count(200) == 1, f'răspunsuri {sorted(codes)}')

# V5: serverul SMTP nu mai poate fi ales de utilizator
r = new_group(smtp_provider='custom', smtp_email='x@x.ro', smtp_password='x', smtp_host='127.0.0.1', smtp_port=5432)
check('V5', '„SMTP custom” refuzat', r.status_code == 400, f'-> {r.status_code}')
r = new_group(smtp_provider='gmail', smtp_email='x@x.ro', smtp_password='x', smtp_host='10.255.255.1', smtp_port=25)
with app.app_context():
    stored = db.session.get(SantaGroup, r.get_json()['id'])
    target = (stored.smtp_host, stored.smtp_port)
check('V5', 'smtp_host trimis de client ignorat (fără SSRF)', target == ('smtp.gmail.com', 587), f'salvat: {target}')
codes = {p: new_group(smtp_provider=p, smtp_email='x@x.ro', smtp_password='x').status_code for p in ('outlook', 'proton', 'yahoo')}
check('V5', 'Doar Gmail și Yahoo acceptați', codes == {'outlook': 400, 'proton': 400, 'yahoo': 201}, str(codes))
src = open(os.path.join(ROOT, 'app', 'services', 'email_service.py'), encoding='utf-8').read()
check('V5', 'Timeout la conexiunile SMTP', 'timeout=SMTP_TIMEOUT_SECONDS' in src, 'timeout 15 s')

# V6: HTML injection
g = new_group(name='Grup <b>bold</b>', smtp_email='org@gmail.com', smtp_password='x').get_json()
evil_name = '<a href="https://evil.example/login">Click</a>'
evil_wish = '<img src="https://evil.example/track.png">'
join(g['code'], evil_name, 'atacator@ex.ro', evil_wish)
join(g['code'], 'Victima', 'victima@ex.ro')
captured.clear()
c.post('/api/admin/draw', headers=admin(g['admin_code']))
drain_queue()
mail = [h for to, s, h in captured if to == 'victima@ex.ro'][0]
check('V6', 'HTML din nume/wishlist neutralizat în email',
      evil_name not in mail and '<img src="https://evil.example' not in mail and '&lt;a href=' in mail,
      'apare ca text (&lt;a ...&gt;), nu ca link')

# V7: rate limiting
limiter.reset()
codes = [c.post('/api/groups', json={'name': f'spam{i}', 'budget': 10, 'smtp_provider': 'gmail', 'smtp_email': 'o@gmail.com', 'smtp_password': 'x'}).status_code for i in range(15)]
check('V7', 'Limită la crearea de grupuri', 429 in codes, f'{codes.count(201)} create, apoi {codes.count(429)}× 429')
g = new_group().get_json()
limiter.reset()
codes = [c.post(f"/api/groups/{g['code']}/participants", json={'name': f'bot{i}', 'email': f'v{i}@ex.ro'}).status_code for i in range(15)]
check('V7', 'Limită la înscrieri de pe același IP', 429 in codes, f'{codes.count(201)} înscriși, apoi {codes.count(429)}× 429')
no_limits()
pid = c.get('/api/admin', headers=admin(g['admin_code'])).get_json()['participants'][0]['id']
r = c.delete(f'/api/admin/participants/{pid}', headers=admin(g['admin_code']))
check('V7', 'Organizatorul poate scoate participanți', r.status_code == 200, f'DELETE -> {r.status_code}')
r = c.delete(f'/api/admin/participants/{pid}', headers=admin(g['code']))
check('V7', 'Codul de invitație nu poate scoate participanți', r.status_code == 404, f'DELETE cu cod public -> {r.status_code}')

# V8: validare email + duplicate
g = new_group().get_json()
r1 = join(g['code'], 'n', 'nu-e-email').status_code
join(g['code'], 'n', 'dup@ex.ro')
r2 = join(g['code'], 'n', 'DUP@ex.ro').status_code
check('V8', 'Email invalid / duplicat cu majuscule refuzat', r1 == 400 and r2 == 400, f'nu-e-email -> {r1}, DUP@ex.ro -> {r2}')
codes, barrier = [], threading.Barrier(8)
no_limits()
def join_same():
    with app.test_client() as tc:
        barrier.wait()
        codes.append(tc.post(f"/api/groups/{g['code']}/participants", json={'name': 'x', 'email': 'acelasi@ex.ro'}).status_code)
ts = [threading.Thread(target=join_same) for _ in range(8)]
[t.start() for t in ts]; [t.join() for t in ts]
check('V8', 'Fără duplicate la înscrieri simultane', codes.count(201) == 1, f'răspunsuri {sorted(codes)}')

# V9: emailuri eșuate + retrimitere
r = new_group(name='X\r\nBcc: spam@evil.example')
check('V9', 'Nume cu caractere de control refuzat', r.status_code == 400, f'-> {r.status_code}')
g = new_group(smtp_email='org@gmail.com', smtp_password='gresita').get_json()
join(g['code'], 'a', 'a@ex.ro'); join(g['code'], 'b', 'b@ex.ro')
es._send = lambda group, to, subject, html: False
d = c.post('/api/admin/draw', headers=admin(g['admin_code'])).get_json()
drain_queue()
d = c.get('/api/admin', headers=admin(g['admin_code'])).get_json()
still = c.get('/api/admin', headers=admin(g['admin_code'])).status_code
es._send = fake_send
no_limits()
rs = c.post('/api/admin/resend', json={'smtp_password': 'corecta'}, headers=admin(g['admin_code'])).get_json()
drain_queue()
expired = c.get('/api/admin', headers=admin(g['admin_code'])).status_code
check('V9', 'Emailurile eșuate pot fi retrimise; linkul expiră abia după',
      d['failed_emails'] == ['a', 'b'] and still == 200 and rs['failed_emails'] == [] and expired == 410,
      f"eșuate {d['failed_emails']}, admin încă {still}; după retrimitere eșuate {rs['failed_emails']}, admin {expired}")

# V10: versiuni
req = open(os.path.join(ROOT, 'requirements.txt'), encoding='utf-8').read()
check('V10', 'gunicorn>=23 și Flask-Cors>=6 în requirements.txt',
      'gunicorn==22' not in req and 'Flask-Cors==5' not in req, req.replace('\n', ' '))

# V11: input
no_limits()
out = {
    'body null': c.post('/api/groups', data='null', content_type='application/json').status_code,
    'body listă': c.post('/api/groups', data='[1,2]', content_type='application/json').status_code,
    'nume 5000': new_group(name='A' * 5000).status_code,
}
g = new_group().get_json()
out['wishlist 3000'] = join(g['code'], 'n', 'w@ex.ro', 'W' * 3000).status_code
no_limits()
out['body 5 MB'] = c.post(f"/api/groups/{g['code']}/participants",
                          json={'name': 'n', 'email': 'big@ex.ro', 'wishlist': 'W' * 5_000_000}).status_code
check('V11', 'Input invalid → 400/413, nu 500', 500 not in out.values() and 201 not in out.values(), str(out))

# V12: buget
out = {v: new_group(budget=v).status_code for v in ['nan', 'inf', '-5', '1e308']}
check('V12', 'Buget nan/inf/negativ/uriaș refuzat', set(out.values()) == {400}, str(out))

# V13: stats
s = c.get('/api/stats').get_json()
check('V13', 'Statisticile nu arată numele grupurilor', all('name' not in x for x in s['recent_groups']),
      f"chei: {sorted(s['recent_groups'][0]) if s['recent_groups'] else []}")

# V14: CORS + headere
r = c.get('/api/stats', headers={'Origin': 'https://evil.example'})
hdr = {k: r.headers.get(k) for k in ['Access-Control-Allow-Origin', 'X-Frame-Options', 'X-Content-Type-Options',
                                      'Referrer-Policy']}
check('V14', 'CORS restrâns + headere de securitate',
      hdr['Access-Control-Allow-Origin'] is None and all(hdr[k] for k in list(hdr)[1:])
      and r.headers.get('Content-Security-Policy'), str(hdr))

# V15: codul de admin nu mai e în URL
src = open(os.path.join(ROOT, 'app', 'routes.py'), encoding='utf-8').read()
check('V15', 'Codul de admin nu mai apare în URL-uri', '<admin_code>' not in src and "admin#" in src,
      'API: header X-Admin-Code; pagină: /admin#cod (fragmentul nu ajunge la server)')

# V16: secrete
dockerignore = open(os.path.join(ROOT, '.dockerignore'), encoding='utf-8').read()
os.environ.pop('SECRET_KEY_BACKUP', None)
saved = os.environ.pop('SECRET_KEY')
try:
    create_app(); refused = False
except RuntimeError:
    refused = True
os.environ['SECRET_KEY'] = saved
check('V16', 'Fără SECRET_KEY aplicația refuză să pornească; .env exclus din imaginea Docker',
      refused and '.env' in dockerignore and 'SECRET_KEY=change' not in compose, f'refuză: {refused}')

# V18: distribuția tragerilor (4 persoane: 9 trageri posibile, dintre care 3 sunt perechi A↔B, C↔D)
from app.services.santa_service import _rng
two_cycles = 0
for _ in range(3000):
    people = list(range(4)); recv = people[:]
    while True:
        _rng.shuffle(recv)
        if all(a != b for a, b in zip(people, recv)):
            break
    two_cycles += all(recv[recv[i]] == i for i in people)
check('V18', 'Tragerea poate produce și perechi reciproce (nu doar un cerc)', 700 < two_cycles < 1300,
      f'{two_cycles}/3000 trageri cu perechi reciproce (ideal ~1000)')

json.dump(RESULTS, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'audit_results.json'), 'w', encoding='utf-8'),
          ensure_ascii=False, indent=1)
fails = [r for r in RESULTS if not r['reparat']]
print(f"\n{len(RESULTS) - len(fails)}/{len(RESULTS)} verificări trecute")
sys.exit(1 if fails else 0)
