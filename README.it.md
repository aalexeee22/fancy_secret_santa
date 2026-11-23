🌍 [English](README.md) · [Română](README.ro.md) · [Français](README.fr.md) · **Italiano** · [Türkçe](README.tr.md)

# 🎅🏻 Secret Santa

Un'applicazione web per organizzare uno scambio di regali Secret Santa tra amici, colleghi o in famiglia, con in più un calendario dell'Avvento di film natalizi.

- **L'organizzatore** crea il gruppo e riceve un link di amministrazione segreto, più un link di invito per gli altri.
- **I partecipanti** si iscrivono con nome, email e una lista dei desideri.
- **All'estrazione**, ognuno riceve un'email con la persona a cui fa il regalo e la sua lista dei desideri.
- **Nessuno vede le coppie, nemmeno l'organizzatore**, che quindi può partecipare anche lui.

Le email partono direttamente dall'account **Gmail o Yahoo** dell'organizzatore, con una password per le app (App Password).

## Funzionalità

- 🔒 **Tutto resta segreto:** le coppie e le liste dei desideri viaggiano solo per email, a ciascuno separatamente.
- 🎲 **Estrazione equa:** nessuno pesca se stesso, e ogni combinazione valida ha la stessa probabilità.
- 📬 **Email affidabili:** inviate in background da una coda salvata nel database. Se il server si ferma, l'invio riprende da dove si era interrotto, senza doppioni.
- 🧹 **I dati personali vengono cancellati** quando tutti hanno ricevuto la propria email (vedi [Dati personali](#dati-personali)).
- ⏳ **Il link di amministrazione scade** quando tutti hanno ricevuto la propria email.
- 🎬 **Calendario dell'Avvento:** un film di Natale dietro ogni porticina, dal 1° al 25 dicembre, più una porticina bonus il 26 (vedi [Calendario dell'Avvento](#calendario-dellavvento)).
- 🎄 **Due temi:** classico (Babbo Natale, palline) e 🐱 gatti (gatti vestiti da Babbo Natale ed elfi, gomitoli di lana).
- 🌍 **Cinque lingue:** inglese (predefinita), rumeno, francese, turco e italiano. Ogni partecipante riceve l'email nella lingua in cui si è iscritto.
- 📊 **Statistiche** aggregate, senza dati personali.
- 📱 **Da telefono:** l'interfaccia si adatta allo schermo e rispetta l'impostazione «riduci animazioni».

## Tecnologie

| Parte | Usa |
|---|---|
| Backend | Python 3.12, Flask, SQLAlchemy, PostgreSQL 17, gunicorn |
| Frontend | React 19, TypeScript, Vite, Ant Design 6 |
| Esecuzione | Docker e Docker Compose |

## Avvio per lo sviluppo

Servono **Docker Desktop**, **Python 3.12** e **Node.js 22**.

**1. La configurazione.** Copia `.env.example` in `.env` e compila `SECRET_KEY` e `POSTGRES_PASSWORD`. Il file spiega come generarli.

```bash
cp .env.example .env
```

**2. Il database** (Postgres in Docker, raggiungibile solo dal tuo computer):

```bash
docker compose up -d db
```

**3. Il backend** (su `localhost:5000`):

```bash
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt
.venv/Scripts/python run.py
```

Su macOS o Linux, sostituisci `.venv/Scripts/` con `.venv/bin/`.

**4. Il processo che invia le email**, in un secondo terminale. Senza di lui, le email restano in coda:

```bash
.venv/Scripts/python email_worker.py
```

**5. Il frontend** (su `localhost:5173`):

```bash
cd frontend
npm ci
npm run dev
```

### Collegarsi al database (DataGrip, DBeaver…)

| Campo | Valore |
|---|---|
| Host | `127.0.0.1` |
| Port | `5432` |
| User | `santa` |
| Password | `POSTGRES_PASSWORD` in `.env` |
| Database | `santa` |

L'utente è `santa`, non il nome del container. Se il programma ha anche un campo URL, questo ha la precedenza sui campi sopra: inserisci `jdbc:postgresql://127.0.0.1:5432/santa`.

## Esecuzione completa in Docker

Compila il frontend e avvia il server insieme al processo delle email, come in produzione:

```bash
docker compose -f docker-compose.yml up -d --build
```

L'applicazione è su `http://localhost:8000`.

## Pubblicazione tramite un tunnel Cloudflare

L'applicazione può essere resa raggiungibile su internet tramite un tunnel Cloudflare gratuito, senza account. Funziona sia dal tuo computer sia da un server:

```bash
docker compose -f docker-compose.yml -f docker-compose.public.yml up -d --build
```

Il link pubblico (`https://….trycloudflare.com`) compare nei log del tunnel:

```bash
docker compose -f docker-compose.yml -f docker-compose.public.yml logs tunnel
```

Da sapere:
- **Il link funziona solo finché la macchina è accesa**, e a ogni riavvio del tunnel ne ricevi uno nuovo.
- **Passa sempre entrambi i file** (`-f docker-compose.yml -f docker-compose.public.yml`), in ogni comando. Con il solo primo file, il container `web` parte senza le impostazioni del tunnel, e Docker segnala il tunnel come «orphan container». **In quel caso non usare mai `--remove-orphans`**: ferma il tunnel.

## Aggiornare un server

Quando sul server ci sono solo `docker-compose.yml`, `docker-compose.public.yml` e `.env` (senza il codice sorgente), l'immagine viene costruita sul tuo computer e poi copiata.

**1. Sul tuo computer**, costruisci ed esporta l'immagine:

```bash
docker compose -f docker-compose.yml build web
docker save secret-santa-web:latest | gzip > santa-web.tar.gz
tar czf movies.tar.gz movies        # solo se i film sono cambiati
```

**2. Carica** `santa-web.tar.gz` (e `movies.tar.gz`) sul server, per esempio con il pulsante «Upload file» della finestra SSH del provider cloud, oppure con `scp`.

**3. Sul server**, nella cartella con `docker-compose.yml`:

```bash
# prima un backup: l'aggiornamento può cancellare dati personali, e non si torna indietro
docker compose exec -T db pg_dump -U santa santa | gzip > ~/backup-before-update.sql.gz

# la nuova versione
gunzip -c ~/santa-web.tar.gz | docker load
docker compose -f docker-compose.yml -f docker-compose.public.yml up -d
docker compose -f docker-compose.yml -f docker-compose.public.yml logs --tail=50 web

# i film (solo se sono cambiati)
tar xzf ~/movies.tar.gz -C ~
docker compose -f docker-compose.yml -f docker-compose.public.yml run --rm \
  -v "$HOME/movies:/movies:ro" web python advent_import.py /movies
```

Usa `up -d` **senza** `--build`, così viene usata l'immagine appena caricata. Le modifiche al database (nuove colonne e tabelle) vengono applicate automaticamente all'avvio.

**4. Quando tutto funziona**, cancella il backup e i file caricati. Il backup contiene ancora i dati personali appena cancellati.

```bash
rm ~/backup-before-update.sql.gz ~/santa-web.tar.gz ~/movies.tar.gz
rm -r ~/movies
```

## Calendario dell'Avvento

La pagina `/advent` (🎬 nel menu) mostra 25 porticine, una per ogni giorno dal 1° al 25 dicembre, ognuna con un film di Natale dietro.

- **I giorni passati** sono aperti; **la porticina di oggi** si apre con un clic (animazione e coriandoli); **i giorni futuri** sono chiusi a chiave 🔒.
- **Prima del 1° dicembre** è tutto chiuso e compare un conto alla rovescia; **dopo il 26 dicembre** è tutto aperto.
- **Porticina bonus:** il 25 dicembre compare una porticina 🎁, che si apre il 26.
- **È il server a decidere la data**, secondo l'ora della Romania (`Europe/Bucharest`, modificabile con `ADVENT_TIMEZONE` in `.env`). I film dei giorni futuri non arrivano mai nel browser, quindi cambiare l'orologio del computer non apre nulla.
- **Due visualizzazioni:** 🚪 Calendario (porticine in ordine mescolato, come in un calendario vero) e 🎬 Il film del giorno.

### Cambiare i film

I film stanno in una cartella `movies/`, che **non è in git**. Conservane una copia: è l'unica copia della lista e delle locandine originali.

- `movies/christmas_movies.json`: 26 voci, una per giorno (`day` 1–26).
- Le locandine, a cui punta il campo `cover`.

Ogni voce:

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

`day`, `title` e `cover` sono obbligatori; i link devono essere `https`. Importazione (o aggiornamento) nel database:

```bash
.venv/Scripts/python advent_import.py movies/ --dry-run   # solo controllo
.venv/Scripts/python advent_import.py movies/
```

Le locandine vengono convertite in WebP (al massimo 400×600) e **salvate nel database**. Dopo l'importazione, l'applicazione non ha più bisogno della cartella `movies/`: puoi cancellarla dal server e le locandine continuano a comparire.

## Dati personali

I dati personali vengono conservati solo finché servono:

- **Subito dopo l'invio riuscito dell'ultima email**, il gruppo viene anonimizzato: nomi, email, liste dei desideri e coppie dei partecipanti, impostazioni email e password dell'organizzatore, e nome del gruppo (che diventa «Secret Santa»).
- **Non si cancella nulla finché un'email è fallita o incerta**, così l'organizzatore può reinviarla.
- **Rete di sicurezza il 1° febbraio:** ogni gruppo di una stagione precedente viene anonimizzato, qualunque sia il suo stato (per esempio un gruppo senza email, o con un'email mai partita).
- La pulizia viene eseguita all'avvio del server e ogni 15 minuti nel processo delle email.
- Un gruppo anonimizzato è chiuso: il link di amministrazione risponde «scaduto» e le iscrizioni vengono rifiutate.
- **Le statistiche pubbliche restano corrette:** le righe restano, solo senza dati personali.

I backup del database (`pg_dump`) fatti prima della pulizia contengono ancora i dati e vanno cancellati a mano.

Verifica sul server che non sia rimasto nulla di personale:

```bash
docker compose -f docker-compose.yml -f docker-compose.public.yml exec -T db psql -U santa -d santa -c "
SELECT g.id, g.name, g.personal_data_erased_at AS cancellato_il, count(p.id) AS partecipanti,
       count(p.name) + count(p.email) + count(p.wishlist) + count(p.assigned_to_id) AS dati_rimasti
FROM santa_groups g LEFT JOIN participants p ON p.group_id = g.id
GROUP BY g.id ORDER BY g.id;"
```

Un gruppo anonimizzato ha una data in `cancellato_il` e `dati_rimasti = 0`.

## Visualizzazioni

L'applicazione non tiene un contatore delle visite. L'unica fonte è il log delle richieste di gunicorn, che **si perde ogni volta che il container `web` viene ricreato** (quindi a ogni aggiornamento). Pagine aperte dall'ultimo avvio, senza il controllo automatico di Docker (ogni 30 secondi) e senza le chiamate all'API e i file statici:

```bash
docker compose -f docker-compose.yml -f docker-compose.public.yml logs --no-log-prefix web \
  | grep -E '"GET /[^ ]* HTTP' \
  | grep -vE '^127\.0\.0\.1 |Python-urllib' \
  | grep -vE '"GET /(api|assets)/|\.(js|css|png|jpe?g|webp|svg|ico|woff2?|map|txt|json)[ ?]' \
  | wc -l
```

- Aggiungi `--until 10m` dopo `logs` per il numero di 10 minuti fa, oppure `--since 1h` solo per l'ultima ora.
- Sostituisci `wc -l` con `grep -oE '"GET /[^ ?/]*' | sort | uniq -c | sort -rn` per il conteggio per pagina.
- Sono aperture di pagina, non persone: ogni ricaricamento conta, e i bot sono inclusi.

## Password per le app (App Password)

Gmail e Yahoo non permettono di inviare email con la normale password dell'account, ma solo con una **password per le app** separata. I passaggi per ciascuno compaiono nel modulo di creazione del gruppo, alla voce «Come ottengo la password per l'invio delle email?». In breve:

- **Gmail:** attiva la verifica in due passaggi, poi genera la password in [Password per le app](https://support.google.com/accounts/answer/185833?hl=it).
- **Yahoo:** Sicurezza dell'account → [Genera password per app](https://help.yahoo.com/kb/SLN15241.html).

La password viene salvata cifrata e cancellata automaticamente quando tutte le email sono partite.

## Test

```bash
.venv/Scripts/python -m unittest discover -s security_tests -p "test_*.py"
```

Audit di sicurezza e robustezza (serve Postgres avviato):

```bash
.venv/Scripts/python security_tests/audit.py
.venv/Scripts/python security_tests/audit_robustness.py
```

## Struttura del progetto

```
app/                 backend Flask: route, modelli, validazioni
app/advent.py        calendario dell'Avvento: quale giorno è aperto, le route dei film
app/services/        invio delle email, estrazione, cancellazione dei dati personali
email_worker.py      il processo che invia le email dalla coda
advent_import.py     importa i film del calendario nel database
start.py             avvia il server e il processo delle email in Docker
frontend/            l'applicazione React (pagine, componenti, temi, traduzioni)
movies/              film e locandine del calendario (non in git)
security_tests/      test unitari e audit di sicurezza
```
