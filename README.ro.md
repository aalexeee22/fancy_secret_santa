🌍 [English](README.md) · **Română** · [Français](README.fr.md) · [Italiano](README.it.md) · [Türkçe](README.tr.md)

# 🎅🏻 Secret Santa

Aplicație web pentru organizat un schimb de cadouri Secret Santa între prieteni, colegi sau familie, plus un calendar de advent cu filme de Crăciun.

- **Organizatorul** creează grupul și primește un link secret de admin, plus un link de invitație pentru ceilalți.
- **Participanții** se înscriu cu nume, email și o listă de dorințe.
- **La tragere**, fiecare primește un email cu persoana căreia îi face cadou și lista ei de dorințe.
- **Nimeni nu vede perechile, nici organizatorul**, așa că poate participa și el.

Emailurile pleacă direct din contul de **Gmail sau Yahoo** al organizatorului, cu o parolă de aplicație (App Password).

## Ce are

- 🔒 **Totul e secret:** perechile și listele de dorințe ajung doar pe email, fiecăruia separat.
- 🎲 **Tragere corectă:** nimeni nu se nimerește pe sine, iar orice combinație validă are aceeași șansă.
- 📬 **Emailuri sigure:** se trimit în fundal, dintr-o coadă salvată în baza de date. Dacă serverul se oprește, trimiterea continuă de unde a rămas, fără dubluri.
- 🧹 **Datele personale se șterg** după ce toți și-au primit emailul (vezi [Datele personale](#datele-personale)).
- ⏳ **Link de admin care expiră** după ce toți și-au primit emailul.
- 🎬 **Calendar de advent:** un film de Crăciun în spatele fiecărei ușițe, de pe 1 până pe 25 decembrie, plus o ușiță bonus pe 26 (vezi [Calendarul de advent](#calendarul-de-advent)).
- 🎄 **Două teme:** clasică (Moș Crăciun, globuri) și 🐱 cu pisici (pisici îmbrăcate în Moș și spiriduși, gheme de lână).
- 🌍 **Cinci limbi:** engleză (implicit), română, franceză, turcă și italiană. Fiecare participant primește emailul în limba în care s-a înscris.
- 📊 **Statistici** generale, fără date personale.
- 📱 **Pe telefon:** interfața se adaptează la ecran și ține cont de setarea „mai puține animații”.

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

### Conectarea la baza de date (DataGrip, DBeaver…)

| Câmp | Valoare |
|---|---|
| Host | `127.0.0.1` |
| Port | `5432` |
| User | `santa` |
| Password | `POSTGRES_PASSWORD` din `.env` |
| Database | `santa` |

Utilizatorul e `santa`, nu numele containerului. Dacă programul are și un câmp URL, acela are prioritate față de câmpurile de mai sus: pune `jdbc:postgresql://127.0.0.1:5432/santa`.

## Rulare completă în Docker

Construiește frontendul și pornește serverul împreună cu procesul de emailuri, ca în producție:

```bash
docker compose -f docker-compose.yml up -d --build
```

Aplicația e pe `http://localhost:8000`.

## Publicare printr-un tunel Cloudflare

Aplicația poate fi făcută accesibilă pe internet printr-un tunel Cloudflare gratuit, fără cont. Merge și de pe calculatorul tău, și de pe un server:

```bash
docker compose -f docker-compose.yml -f docker-compose.public.yml up -d --build
```

Linkul public (`https://….trycloudflare.com`) apare în logurile tunelului:

```bash
docker compose -f docker-compose.yml -f docker-compose.public.yml logs tunnel
```

De știut:
- **Linkul merge doar cât mașina e pornită**, iar la fiecare repornire a tunelului primești altul.
- **Pune mereu ambele fișiere** (`-f docker-compose.yml -f docker-compose.public.yml`), la orice comandă. Doar cu primul, containerul `web` pornește fără setările pentru tunel, iar Docker spune că tunelul e un „orphan container”. **Nu folosi atunci `--remove-orphans`**: oprește tunelul.

## Update pe server

Când pe server sunt doar `docker-compose.yml`, `docker-compose.public.yml` și `.env` (fără cod), imaginea se construiește pe calculatorul tău și se copiază acolo.

**1. Pe calculatorul tău**, construiește și exportă imaginea:

```bash
docker compose -f docker-compose.yml build web
docker save secret-santa-web:latest | gzip > santa-web.tar.gz
tar czf movies.tar.gz movies        # doar dacă s-au schimbat filmele
```

**2. Urcă** `santa-web.tar.gz` (și `movies.tar.gz`) pe server, de exemplu cu butonul „Upload file” din fereastra SSH a furnizorului de cloud, sau cu `scp`.

**3. Pe server**, în folderul cu `docker-compose.yml`:

```bash
# întâi copia de siguranță: update-ul poate șterge date personale, iar asta nu se poate anula
docker compose exec -T db pg_dump -U santa santa | gzip > ~/backup-before-update.sql.gz

# versiunea nouă
gunzip -c ~/santa-web.tar.gz | docker load
docker compose -f docker-compose.yml -f docker-compose.public.yml up -d
docker compose -f docker-compose.yml -f docker-compose.public.yml logs --tail=50 web

# filmele (doar dacă s-au schimbat)
tar xzf ~/movies.tar.gz -C ~
docker compose -f docker-compose.yml -f docker-compose.public.yml run --rm \
  -v "$HOME/movies:/movies:ro" web python advent_import.py /movies
```

Folosește `up -d` **fără** `--build`, ca să ia imaginea pe care tocmai ai încărcat-o. Modificările bazei de date (coloane și tabele noi) se aplică singure la pornire.

**4. După ce totul merge**, șterge backup-ul și fișierele urcate. Backup-ul încă are datele personale care tocmai s-au șters.

```bash
rm ~/backup-before-update.sql.gz ~/santa-web.tar.gz ~/movies.tar.gz
rm -r ~/movies
```

## Calendarul de advent

Pagina `/advent` (🎬 în meniu) arată 25 de ușițe, câte una pentru fiecare zi de pe 1 până pe 25 decembrie, fiecare cu un film de Crăciun.

- **Zilele trecute** sunt deschise; **ușița de azi** se deschide cu un click (animație și confetti); **zilele viitoare** sunt încuiate 🔒.
- **Înainte de 1 decembrie** totul e încuiat și apare o numărătoare inversă; **după 26 decembrie** totul e deschis.
- **Ușița bonus:** pe 25 decembrie apare o ușiță 🎁, care se deschide pe 26.
- **Serverul decide ce zi e**, după ora României (`Europe/Bucharest`, se poate schimba cu `ADVENT_TIMEZONE` în `.env`). Filmele zilelor viitoare nu ajung deloc în browser, deci schimbarea ceasului pe calculator nu deschide nimic.
- **Două moduri de afișare:** 🚪 Calendar (ușițe în ordine amestecată, ca la un calendar adevărat) și 🎬 Filmul zilei.

### Schimbarea filmelor

Filmele stau în folderul `movies/`, care **nu e în git**. Păstrează-i o copie: e singura copie a listei și a posterelor originale.

- `movies/christmas_movies.json`: 26 de filme, câte unul pe zi (`day` 1–26).
- Posterele, la care trimite câmpul `cover`.

Fiecare film:

```json
{
  "day": 15,
  "title": "Tom & Jerry: A Nutcracker Tale",
  "url_IMDB": "https://www.imdb.com/title/tt1114698",
  "cover": "Tom_and_Jerry_A_Nutcracker_Tale_cover.jpg",
  "trailer_link": "https://www.youtube.com/...",
  "movie_link": "https://tv.apple.com/..."
}
```

`day`, `title` și `cover` sunt obligatorii; linkurile trebuie să fie `https`. Importul (sau actualizarea) în baza de date:

```bash
.venv/Scripts/python advent_import.py movies/ --dry-run   # doar verifică
.venv/Scripts/python advent_import.py movies/
```

Posterele sunt convertite în WebP (cel mult 400×600) și **salvate în baza de date**. După import, aplicația nu mai are nevoie de folderul `movies/`: îl poți șterge de pe server, iar pozele apar în continuare.

## Datele personale

Datele personale se păstrează doar cât e nevoie de ele:

- **Imediat după ce ultimul email a plecat cu succes**, grupul e anonimizat: numele, emailurile, listele de dorințe și perechile participanților, setările de email și parola organizatorului, și numele grupului (care devine „Secret Santa”).
- **Nu se șterge nimic cât timp un email a eșuat sau e nesigur**, ca organizatorul să poată retrimite.
- **Plasă de siguranță pe 1 februarie:** orice grup dintr-un sezon trecut e anonimizat, indiferent de stare (de exemplu un grup fără email, sau cu un email care n-a plecat niciodată).
- Curățarea rulează la pornirea serverului și la fiecare 15 minute în procesul de emailuri.
- Un grup anonimizat e închis: linkul de admin răspunde „expirat”, iar înscrierile sunt refuzate.
- **Statisticile publice rămân corecte:** rândurile rămân, doar fără date personale.

Backup-urile bazei de date (`pg_dump`) făcute înainte de curățare încă au datele și trebuie șterse manual.

Verificare pe server că nu a rămas nimic personal:

```bash
docker compose -f docker-compose.yml -f docker-compose.public.yml exec -T db psql -U santa -d santa -c "
SELECT g.id, g.name, g.personal_data_erased_at AS sters_la, count(p.id) AS participanti,
       count(p.name) + count(p.email) + count(p.wishlist) + count(p.assigned_to_id) AS date_ramase
FROM santa_groups g LEFT JOIN participants p ON p.group_id = g.id
GROUP BY g.id ORDER BY g.id;"
```

Un grup anonimizat are o dată la `sters_la` și `date_ramase = 0`.

## Vizualizări

Aplicația nu ține un contor de vizite. Singura sursă sunt logurile de cereri ale lui gunicorn, care **se pierd de fiecare dată când containerul `web` e recreat** (deci la fiecare update). Paginile deschise de la ultima pornire, fără verificarea automată a lui Docker (la fiecare 30 de secunde) și fără cererile către API și fișierele statice:

```bash
docker compose -f docker-compose.yml -f docker-compose.public.yml logs --no-log-prefix web \
  | grep -E '"GET /[^ ]* HTTP' \
  | grep -vE '^127\.0\.0\.1 |Python-urllib' \
  | grep -vE '"GET /(api|assets)/|\.(js|css|png|jpe?g|webp|svg|ico|woff2?|map|txt|json)[ ?]' \
  | wc -l
```

- Adaugă `--until 10m` după `logs` pentru numărul de acum 10 minute, sau `--since 1h` doar pentru ultima oră.
- Înlocuiește `wc -l` cu `grep -oE '"GET /[^ ?/]*' | sort | uniq -c | sort -rn` pentru numărul pe fiecare pagină.
- Sunt deschideri de pagină, nu oameni: fiecare refresh se numără, iar boții sunt incluși.

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
app/                 backend Flask: rute, modele, validări
app/advent.py        calendarul de advent: ce zi e deschisă, rutele pentru filme
app/services/        trimiterea emailurilor, tragerea, ștergerea datelor personale
email_worker.py      procesul care trimite emailurile din coadă
advent_import.py     importă filmele calendarului în baza de date
start.py             pornește serverul și procesul de emailuri în Docker
frontend/            aplicația React (pagini, componente, teme, traduceri)
movies/              filmele și posterele calendarului (nu sunt în git)
security_tests/      teste unitare și audituri de securitate
```
