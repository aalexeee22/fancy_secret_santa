# 🎅🏻 Secret Santa

Aplicație web pentru organizat un schimb de cadouri Secret Santa între prieteni, colegi sau familie.

- **Organizatorul** creează grupul și primește un link secret de admin, plus un link de invitație pentru ceilalți.
- **Participanții** se înscriu cu nume, email și o listă de dorințe.
- **La tragere**, fiecare primește un email cu persoana căreia îi face cadou și lista ei de dorințe.
- **Nimeni nu vede perechile, nici organizatorul**, așa că poate participa și el.

Emailurile pleacă direct din contul de **Gmail sau Yahoo** al organizatorului, cu o parolă de aplicație (App Password).

## Ce are

- 🔒 **Totul e secret:** perechile și listele de dorințe ajung doar pe email, fiecăruia separat.
- 🎲 **Tragere corectă:** nimeni nu se nimerește pe sine, iar orice combinație validă are aceeași șansă.
- 📬 **Emailuri sigure:** se trimit în fundal, dintr-o coadă salvată în baza de date. Dacă serverul se oprește, trimiterea continuă de unde a rămas, fără dubluri.
- ⏳ **Link de admin care expiră** după ce toți și-au primit emailul.
- 🎄 **Două teme:** clasică (Moș Crăciun, globuri) și 🐱 cu pisici (pisici îmbrăcate în Moș și spiriduși, gheme de lână).
- 📊 **Statistici** generale, fără date personale.
- 📱 **Pe telefon:** interfață în română, care se adaptează la ecran și ține cont de setarea „mai puține animații”.

## Tehnologii

| Parte | Ce folosește |
|---|---|
| Backend | Python 3.12, Flask, SQLAlchemy, PostgreSQL 17, gunicorn |
| Frontend | React 19, TypeScript, Vite, Ant Design 6 |
| Rulare | Docker și Docker Compose |

## Pornire pentru dezvoltare

Ai nevoie de **Docker Desktop**, **Python 3.12** și **Node.js 22**.

**1. Configurația.** Copiază `.env.example` în `.env` și completează `SECRET_KEY` și `POSTGRES_PASSWORD`. Fișierul explică cum le generezi.

```bash
cp .env.example .env
```

**2. Baza de date** (Postgres în Docker, accesibil doar de pe calculatorul tău):

```bash
docker compose up -d db
```

**3. Backendul** (pe `localhost:5000`):

```bash
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt
.venv/Scripts/python run.py
```

Pe macOS sau Linux, înlocuiește `.venv/Scripts/` cu `.venv/bin/`.

**4. Procesul care trimite emailurile**, într-un al doilea terminal. Fără el, emailurile rămân în coadă:

```bash
.venv/Scripts/python email_worker.py
```

**5. Frontendul** (pe `localhost:5173`):

```bash
cd frontend
npm ci
npm run dev
```

## Rulare completă în Docker

Construiește frontendul și pornește serverul împreună cu procesul de emailuri, ca în producție:

```bash
docker compose -f docker-compose.yml up -d --build
```

Aplicația e pe `http://localhost:8000`.

## Publicare de pe calculatorul tău

Aplicația poate fi făcută accesibilă pe internet direct de pe calculatorul tău, printr-un tunel Cloudflare gratuit, fără cont:

```bash
docker compose -f docker-compose.yml -f docker-compose.public.yml up -d --build
```

Linkul public (`https://….trycloudflare.com`) apare în logurile tunelului:

```bash
docker compose -f docker-compose.yml -f docker-compose.public.yml logs tunnel
```

De știut:
- **Linkul merge doar cât calculatorul e pornit**, iar la fiecare repornire a tunelului primești altul.
- **Cel mai bine e să pornești totul o singură dată** și să lași calculatorul deschis până după tragere.

## Parola de aplicație (App Password)

Gmail și Yahoo nu permit trimiterea emailurilor cu parola obișnuită a contului, ci cu o **parolă de aplicație** separată. Pașii pentru fiecare apar în formularul de creare a grupului, la „Cum obțin parola pentru trimiterea emailurilor?”. Pe scurt:

- **Gmail:** activează verificarea în doi pași, apoi generează parola la [App passwords](https://support.google.com/accounts/answer/185833?hl=ro).
- **Yahoo:** Account Security → [Generează parolă de aplicație](https://help.yahoo.com/kb/SLN15241.html).

Parola se salvează criptat și se șterge automat după ce au plecat toate emailurile.

## Teste

```bash
.venv/Scripts/python -m unittest discover -s security_tests -p "test_*.py"
```

Auditurile de securitate și robustețe (au nevoie de Postgres pornit):

```bash
.venv/Scripts/python security_tests/audit.py
.venv/Scripts/python security_tests/audit_robustness.py
```

## Structura proiectului

```
app/                 backend Flask: rute, modele, validări, trimiterea emailurilor
email_worker.py      procesul care trimite emailurile din coadă
start.py             pornește serverul și procesul de emailuri în Docker
frontend/            aplicația React (pagini, componente, teme)
migrations/          scripturi SQL pentru bazele create cu versiuni mai vechi
security_tests/      teste unitare și audituri de securitate
```
