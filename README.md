🌍 **English** · [Română](README.ro.md) · [Français](README.fr.md) · [Italiano](README.it.md) · [Türkçe](README.tr.md)

# 🎅🏻 Secret Santa

A web app for organising a Secret Santa gift exchange between friends, colleagues or family, plus a Christmas movie advent calendar.

- **The organiser** creates the group and gets a secret admin link, plus an invitation link for everyone else.
- **Participants** sign up with their name, email and a wishlist.
- **At the draw**, everyone gets an email with the person they give a gift to and that person's wishlist.
- **Nobody sees the pairs, not even the organiser**, so they can take part too.

Emails are sent straight from the organiser's **Gmail or Yahoo** account, using an App Password.

## Features

- 🔒 **Everything stays secret:** pairs and wishlists only travel by email, to each person separately.
- 🎲 **Fair draw:** nobody gets themselves, and every valid combination is equally likely.
- 📬 **Reliable emails:** sent in the background from a queue stored in the database. If the server stops, sending resumes where it left off, without duplicates.
- 🧹 **Personal data is erased** once everyone has received their email (see [Privacy](#privacy)).
- ⏳ **The admin link expires** once everyone has received their email.
- 🎬 **Advent calendar:** a Christmas movie behind each door, from 1 to 25 December, plus a bonus door on the 26th (see [Advent calendar](#advent-calendar)).
- 🎄 **Two themes:** classic (Santa, baubles) and 🐱 cats (cats dressed as Santa and elves, balls of yarn).
- 🌍 **Five languages:** English (default), Romanian, French, Turkish and Italian. Each participant gets their email in the language they signed up in.
- 📊 **Statistics** in aggregate, with no personal data.
- 📱 **Works on phones:** the layout adapts to the screen and respects the "reduce motion" setting.

## Tech stack

| Part | Uses |
|---|---|
| Backend | Python 3.12, Flask, SQLAlchemy, PostgreSQL 17, gunicorn |
| Frontend | React 19, TypeScript, Vite, Ant Design 6 |
| Running | Docker and Docker Compose |

## Development setup

You need **Docker Desktop**, **Python 3.12** and **Node.js 22**.

**1. Configuration.** Copy `.env.example` to `.env` and fill in `SECRET_KEY` and `POSTGRES_PASSWORD`. The file explains how to generate them.

```bash
cp .env.example .env
```

**2. The database** (Postgres in Docker, reachable only from your computer):

```bash
docker compose up -d db
```

**3. The backend** (on `localhost:5000`):

```bash
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt
.venv/Scripts/python run.py
```

On macOS or Linux, replace `.venv/Scripts/` with `.venv/bin/`.

**4. The email worker**, in a second terminal. Without it, emails stay in the queue:

```bash
.venv/Scripts/python email_worker.py
```

**5. The frontend** (on `localhost:5173`):

```bash
cd frontend
npm ci
npm run dev
```

### Connecting to the database (DataGrip, DBeaver…)

| Field | Value |
|---|---|
| Host | `127.0.0.1` |
| Port | `5432` |
| User | `santa` |
| Password | `POSTGRES_PASSWORD` from `.env` |
| Database | `santa` |

The username is `santa`, not the container name. If the tool also has a URL field, it overrides the fields above: use `jdbc:postgresql://127.0.0.1:5432/santa`.

## Full run in Docker

Builds the frontend and starts the server together with the email worker, as in production:

```bash
docker compose -f docker-compose.yml up -d --build
```

The app is at `http://localhost:8000`.

## Publishing through a Cloudflare tunnel

The app can be made reachable on the internet through a free Cloudflare tunnel, with no account. This works both from your own computer and from a server:

```bash
docker compose -f docker-compose.yml -f docker-compose.public.yml up -d --build
```

The public link (`https://….trycloudflare.com`) appears in the tunnel's logs:

```bash
docker compose -f docker-compose.yml -f docker-compose.public.yml logs tunnel
```

Good to know:
- **The link only works while the machine is on**, and you get a new one every time the tunnel restarts.
- **Always pass both files** (`-f docker-compose.yml -f docker-compose.public.yml`), for every command. With only the first one, the `web` container starts without the tunnel settings, and Docker reports the tunnel as an "orphan container". **Never use `--remove-orphans` then**: it stops the tunnel.

## Updating a server

When the server only has `docker-compose.yml`, `docker-compose.public.yml` and `.env` (no source code), the image is built on your computer and copied over.

**1. On your computer**, build and export the image:

```bash
docker compose -f docker-compose.yml build web
docker save secret-santa-web:latest | gzip > santa-web.tar.gz
tar czf movies.tar.gz movies        # only if the movies changed
```

**2. Upload** `santa-web.tar.gz` (and `movies.tar.gz`) to the server, for example with the "Upload file" button in the cloud provider's SSH window, or with `scp`.

**3. On the server**, in the folder with `docker-compose.yml`:

```bash
# backup first: the update may erase personal data, and that cannot be undone
docker compose exec -T db pg_dump -U santa santa | gzip > ~/backup-before-update.sql.gz

# the new version
gunzip -c ~/santa-web.tar.gz | docker load
docker compose -f docker-compose.yml -f docker-compose.public.yml up -d
docker compose -f docker-compose.yml -f docker-compose.public.yml logs --tail=50 web

# the movies (only if they changed)
tar xzf ~/movies.tar.gz -C ~
docker compose -f docker-compose.yml -f docker-compose.public.yml run --rm \
  -v "$HOME/movies:/movies:ro" web python advent_import.py /movies
```

Use `up -d` **without** `--build`, so the image you just loaded is used. Database changes (new columns and tables) are applied automatically on startup.

**4. Once everything works**, delete the backup and the uploaded files. The backup still holds the personal data that was just erased.

```bash
rm ~/backup-before-update.sql.gz ~/santa-web.tar.gz ~/movies.tar.gz
rm -r ~/movies
```

## Advent calendar

The `/advent` page (🎬 in the menu) shows 25 doors, one per day from 1 to 25 December, each with a Christmas movie behind it.

- **Past days** are open; **today's door** opens with a click (animation and confetti); **future days** are locked 🔒.
- **Before 1 December** everything is locked and a countdown is shown; **after 26 December** everything is open.
- **Bonus door:** on 25 December a 🎁 door appears, which opens on the 26th.
- **The server decides the date**, in Romania's time zone (`Europe/Bucharest`, configurable with `ADVENT_TIMEZONE` in `.env`). The movies of future days never reach the browser, so changing your computer's clock does not open anything.
- **Two views:** 🚪 Calendar (doors in shuffled order, like a real calendar) and 🎬 Movie of the day.

### Changing the movies

The movies live in a `movies/` folder, which is **not in git**. Keep a copy of it: it is the only copy of the list and the original posters.

- `movies/christmas_movies.json`: 26 entries, one per day (`day` 1–26).
- The posters, which the `cover` field points to.

Each entry:

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

`day`, `title` and `cover` are required; links must be `https`. Import (or update) them into the database:

```bash
.venv/Scripts/python advent_import.py movies/ --dry-run   # only checks
.venv/Scripts/python advent_import.py movies/
```

Posters are converted to WebP (at most 400×600) and **stored in the database**. After the import, the app no longer needs the `movies/` folder: you can delete it from the server, and the posters still show.

## Privacy

Personal data is kept only as long as it is needed:

- **Right after the last email has been sent successfully**, the group is anonymised: participants' names, emails, wishlists and pairs, the organiser's email settings and password, and the group's name (which becomes "Secret Santa").
- **Nothing is erased while an email has failed or is uncertain**, so the organiser can still resend.
- **Safety net on 1 February:** every group from a previous season is anonymised, whatever its state (for example a group without email, or with an email that never went out).
- The cleanup runs on server startup and every 15 minutes in the email worker.
- An anonymised group is closed: the admin link replies "expired" and sign-ups are refused.
- **Public statistics stay correct:** the rows remain, just without personal data.

Database backups (`pg_dump`) made before the cleanup still contain the data and have to be deleted by hand.

Check on the server that nothing personal is left:

```bash
docker compose -f docker-compose.yml -f docker-compose.public.yml exec -T db psql -U santa -d santa -c "
SELECT g.id, g.name, g.personal_data_erased_at AS erased_at, count(p.id) AS participants,
       count(p.name) + count(p.email) + count(p.wishlist) + count(p.assigned_to_id) AS data_left
FROM santa_groups g LEFT JOIN participants p ON p.group_id = g.id
GROUP BY g.id ORDER BY g.id;"
```

An anonymised group has a date in `erased_at` and `data_left = 0`.

## Page views

The app does not keep a visit counter. The only source is gunicorn's request log, which is **lost every time the `web` container is recreated** (so on every update). Page opens since the last start, without Docker's health check (every 30 seconds) and without API calls and static files:

```bash
docker compose -f docker-compose.yml -f docker-compose.public.yml logs --no-log-prefix web \
  | grep -E '"GET /[^ ]* HTTP' \
  | grep -vE '^127\.0\.0\.1 |Python-urllib' \
  | grep -vE '"GET /(api|assets)/|\.(js|css|png|jpe?g|webp|svg|ico|woff2?|map|txt|json)[ ?]' \
  | wc -l
```

- Add `--until 10m` after `logs` for the count as it was 10 minutes ago, or `--since 1h` for the last hour only.
- Replace `wc -l` with `grep -oE '"GET /[^ ?/]*' | sort | uniq -c | sort -rn` for a count per page.
- These are page opens, not people: every refresh counts, and bots are included.

## App Password

Gmail and Yahoo do not allow sending email with the account's normal password, only with a separate **App Password**. The steps for each appear in the group creation form, under "How do I get the password for sending emails?". In short:

- **Gmail:** turn on 2-Step Verification, then generate the password under [App passwords](https://support.google.com/accounts/answer/185833).
- **Yahoo:** Account Security → [Generate app password](https://help.yahoo.com/kb/SLN15241.html).

The password is stored encrypted and deleted automatically once all emails have been sent.

## Tests

```bash
.venv/Scripts/python -m unittest discover -s security_tests -p "test_*.py"
```

Security and robustness audits (need Postgres running):

```bash
.venv/Scripts/python security_tests/audit.py
.venv/Scripts/python security_tests/audit_robustness.py
```

## Project structure

```
app/                 Flask backend: routes, models, validation
app/advent.py        advent calendar: which day is open, the movie routes
app/services/        sending emails, the draw, erasing personal data
email_worker.py      the process that sends emails from the queue
advent_import.py     imports the advent movies into the database
start.py             starts the server and the email worker in Docker
frontend/            the React app (pages, components, themes, translations)
movies/              advent movies and posters (not in git)
security_tests/      unit tests and security audits
```
