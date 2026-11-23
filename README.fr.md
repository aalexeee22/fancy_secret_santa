🌍 [English](README.md) · [Română](README.ro.md) · **Français** · [Italiano](README.it.md) · [Türkçe](README.tr.md)

# 🎅🏻 Secret Santa

Une application web pour organiser un échange de cadeaux Secret Santa entre amis, collègues ou en famille, avec en plus un calendrier de l'Avent de films de Noël.

- **L'organisateur** crée le groupe et reçoit un lien d'administration secret, ainsi qu'un lien d'invitation pour les autres.
- **Les participants** s'inscrivent avec leur nom, leur email et une liste de souhaits.
- **Au tirage**, chacun reçoit un email avec la personne à qui il offre un cadeau et sa liste de souhaits.
- **Personne ne voit les paires, pas même l'organisateur**, qui peut donc participer lui aussi.

Les emails partent directement du compte **Gmail ou Yahoo** de l'organisateur, avec un mot de passe d'application (App Password).

## Fonctionnalités

- 🔒 **Tout reste secret :** les paires et les listes de souhaits ne circulent que par email, à chacun séparément.
- 🎲 **Tirage équitable :** personne ne tombe sur soi-même, et chaque combinaison valide a la même chance.
- 📬 **Emails fiables :** envoyés en arrière-plan depuis une file d'attente enregistrée dans la base de données. Si le serveur s'arrête, l'envoi reprend là où il s'était arrêté, sans doublons.
- 🧹 **Les données personnelles sont effacées** une fois que tout le monde a reçu son email (voir [Données personnelles](#données-personnelles)).
- ⏳ **Le lien d'administration expire** une fois que tout le monde a reçu son email.
- 🎬 **Calendrier de l'Avent :** un film de Noël derrière chaque porte, du 1er au 25 décembre, plus une porte bonus le 26 (voir [Calendrier de l'Avent](#calendrier-de-lavent)).
- 🎄 **Deux thèmes :** classique (Père Noël, boules) et 🐱 chats (chats déguisés en Père Noël et en lutins, pelotes de laine).
- 🌍 **Cinq langues :** anglais (par défaut), roumain, français, turc et italien. Chaque participant reçoit son email dans la langue dans laquelle il s'est inscrit.
- 📊 **Statistiques** globales, sans données personnelles.
- 📱 **Sur mobile :** l'interface s'adapte à l'écran et respecte le réglage « réduire les animations ».

## Technologies

| Partie | Utilise |
|---|---|
| Backend | Python 3.12, Flask, SQLAlchemy, PostgreSQL 17, gunicorn |
| Frontend | React 19, TypeScript, Vite, Ant Design 6 |
| Exécution | Docker et Docker Compose |

## Installation pour le développement

Il vous faut **Docker Desktop**, **Python 3.12** et **Node.js 22**.

**1. La configuration.** Copiez `.env.example` vers `.env` et remplissez `SECRET_KEY` et `POSTGRES_PASSWORD`. Le fichier explique comment les générer.

```bash
cp .env.example .env
```

**2. La base de données** (Postgres dans Docker, accessible uniquement depuis votre ordinateur) :

```bash
docker compose up -d db
```

**3. Le backend** (sur `localhost:5000`) :

```bash
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt
.venv/Scripts/python run.py
```

Sous macOS ou Linux, remplacez `.venv/Scripts/` par `.venv/bin/`.

**4. Le processus d'envoi des emails**, dans un deuxième terminal. Sans lui, les emails restent dans la file :

```bash
.venv/Scripts/python email_worker.py
```

**5. Le frontend** (sur `localhost:5173`) :

```bash
cd frontend
npm ci
npm run dev
```

### Se connecter à la base de données (DataGrip, DBeaver…)

| Champ | Valeur |
|---|---|
| Host | `127.0.0.1` |
| Port | `5432` |
| User | `santa` |
| Password | `POSTGRES_PASSWORD` dans `.env` |
| Database | `santa` |

L'utilisateur est `santa`, pas le nom du conteneur. Si l'outil a aussi un champ URL, celui-ci remplace les champs ci-dessus : mettez `jdbc:postgresql://127.0.0.1:5432/santa`.

## Exécution complète dans Docker

Construit le frontend et démarre le serveur avec le processus d'envoi des emails, comme en production :

```bash
docker compose -f docker-compose.yml up -d --build
```

L'application est sur `http://localhost:8000`.

## Publication via un tunnel Cloudflare

L'application peut être rendue accessible sur internet via un tunnel Cloudflare gratuit, sans compte. Cela fonctionne depuis votre ordinateur comme depuis un serveur :

```bash
docker compose -f docker-compose.yml -f docker-compose.public.yml up -d --build
```

Le lien public (`https://….trycloudflare.com`) apparaît dans les logs du tunnel :

```bash
docker compose -f docker-compose.yml -f docker-compose.public.yml logs tunnel
```

À savoir :
- **Le lien ne fonctionne que tant que la machine est allumée**, et vous en recevez un nouveau à chaque redémarrage du tunnel.
- **Passez toujours les deux fichiers** (`-f docker-compose.yml -f docker-compose.public.yml`), pour chaque commande. Avec le premier seul, le conteneur `web` démarre sans les réglages du tunnel, et Docker signale le tunnel comme « orphan container ». **N'utilisez alors jamais `--remove-orphans`** : cela arrête le tunnel.

## Mettre à jour un serveur

Quand le serveur n'a que `docker-compose.yml`, `docker-compose.public.yml` et `.env` (sans le code source), l'image est construite sur votre ordinateur puis copiée.

**1. Sur votre ordinateur**, construisez et exportez l'image :

```bash
docker compose -f docker-compose.yml build web
docker save secret-santa-web:latest | gzip > santa-web.tar.gz
tar czf movies.tar.gz movies        # seulement si les films ont changé
```

**2. Envoyez** `santa-web.tar.gz` (et `movies.tar.gz`) sur le serveur, par exemple avec le bouton « Upload file » de la fenêtre SSH du fournisseur cloud, ou avec `scp`.

**3. Sur le serveur**, dans le dossier qui contient `docker-compose.yml` :

```bash
# d'abord une sauvegarde : la mise à jour peut effacer des données personnelles, de façon irréversible
docker compose exec -T db pg_dump -U santa santa | gzip > ~/backup-before-update.sql.gz

# la nouvelle version
gunzip -c ~/santa-web.tar.gz | docker load
docker compose -f docker-compose.yml -f docker-compose.public.yml up -d
docker compose -f docker-compose.yml -f docker-compose.public.yml logs --tail=50 web

# les films (seulement s'ils ont changé)
tar xzf ~/movies.tar.gz -C ~
docker compose -f docker-compose.yml -f docker-compose.public.yml run --rm \
  -v "$HOME/movies:/movies:ro" web python advent_import.py /movies
```

Utilisez `up -d` **sans** `--build`, pour que l'image que vous venez de charger soit utilisée. Les changements de la base de données (nouvelles colonnes et tables) sont appliqués automatiquement au démarrage.

**4. Une fois que tout fonctionne**, supprimez la sauvegarde et les fichiers envoyés. La sauvegarde contient encore les données personnelles qui viennent d'être effacées.

```bash
rm ~/backup-before-update.sql.gz ~/santa-web.tar.gz ~/movies.tar.gz
rm -r ~/movies
```

## Calendrier de l'Avent

La page `/advent` (🎬 dans le menu) affiche 25 portes, une par jour du 1er au 25 décembre, chacune avec un film de Noël derrière.

- **Les jours passés** sont ouverts ; **la porte du jour** s'ouvre d'un clic (animation et confettis) ; **les jours à venir** sont verrouillés 🔒.
- **Avant le 1er décembre** tout est verrouillé et un compte à rebours s'affiche ; **après le 26 décembre** tout est ouvert.
- **Porte bonus :** le 25 décembre apparaît une porte 🎁, qui s'ouvre le 26.
- **C'est le serveur qui décide de la date**, à l'heure de la Roumanie (`Europe/Bucharest`, modifiable avec `ADVENT_TIMEZONE` dans `.env`). Les films des jours à venir n'arrivent jamais dans le navigateur : changer l'horloge de l'ordinateur n'ouvre rien.
- **Deux affichages :** 🚪 Calendrier (portes dans un ordre mélangé, comme un vrai calendrier) et 🎬 Le film du jour.

### Changer les films

Les films se trouvent dans un dossier `movies/`, qui **n'est pas dans git**. Gardez-en une copie : c'est la seule copie de la liste et des affiches originales.

- `movies/christmas_movies.json` : 26 entrées, une par jour (`day` 1–26).
- Les affiches, vers lesquelles pointe le champ `cover`.

Chaque entrée :

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

`day`, `title` et `cover` sont obligatoires ; les liens doivent être en `https`. Import (ou mise à jour) dans la base de données :

```bash
.venv/Scripts/python advent_import.py movies/ --dry-run   # vérifie seulement
.venv/Scripts/python advent_import.py movies/
```

Les affiches sont converties en WebP (400×600 au maximum) et **enregistrées dans la base de données**. Après l'import, l'application n'a plus besoin du dossier `movies/` : vous pouvez le supprimer du serveur, les affiches s'affichent toujours.

## Données personnelles

Les données personnelles ne sont conservées que le temps nécessaire :

- **Juste après l'envoi réussi du dernier email**, le groupe est anonymisé : noms, emails, listes de souhaits et paires des participants, réglages email et mot de passe de l'organisateur, et nom du groupe (qui devient « Secret Santa »).
- **Rien n'est effacé tant qu'un email a échoué ou est incertain**, pour que l'organisateur puisse le renvoyer.
- **Filet de sécurité le 1er février :** tout groupe d'une saison précédente est anonymisé, quel que soit son état (par exemple un groupe sans email, ou avec un email qui n'est jamais parti).
- Le nettoyage s'exécute au démarrage du serveur et toutes les 15 minutes dans le processus d'envoi des emails.
- Un groupe anonymisé est fermé : le lien d'administration répond « expiré » et les inscriptions sont refusées.
- **Les statistiques publiques restent justes :** les lignes restent, simplement sans données personnelles.

Les sauvegardes de la base (`pg_dump`) faites avant le nettoyage contiennent encore les données et doivent être supprimées à la main.

Vérifier sur le serveur qu'il ne reste rien de personnel :

```bash
docker compose -f docker-compose.yml -f docker-compose.public.yml exec -T db psql -U santa -d santa -c "
SELECT g.id, g.name, g.personal_data_erased_at AS efface_le, count(p.id) AS participants,
       count(p.name) + count(p.email) + count(p.wishlist) + count(p.assigned_to_id) AS donnees_restantes
FROM santa_groups g LEFT JOIN participants p ON p.group_id = g.id
GROUP BY g.id ORDER BY g.id;"
```

Un groupe anonymisé a une date dans `efface_le` et `donnees_restantes = 0`.

## Pages vues

L'application ne tient pas de compteur de visites. La seule source est le journal des requêtes de gunicorn, qui **est perdu chaque fois que le conteneur `web` est recréé** (donc à chaque mise à jour). Pages ouvertes depuis le dernier démarrage, sans la vérification automatique de Docker (toutes les 30 secondes) et sans les appels à l'API ni les fichiers statiques :

```bash
docker compose -f docker-compose.yml -f docker-compose.public.yml logs --no-log-prefix web \
  | grep -E '"GET /[^ ]* HTTP' \
  | grep -vE '^127\.0\.0\.1 |Python-urllib' \
  | grep -vE '"GET /(api|assets)/|\.(js|css|png|jpe?g|webp|svg|ico|woff2?|map|txt|json)[ ?]' \
  | wc -l
```

- Ajoutez `--until 10m` après `logs` pour le chiffre d'il y a 10 minutes, ou `--since 1h` pour la dernière heure seulement.
- Remplacez `wc -l` par `grep -oE '"GET /[^ ?/]*' | sort | uniq -c | sort -rn` pour un décompte par page.
- Ce sont des ouvertures de page, pas des personnes : chaque actualisation compte, et les robots sont inclus.

## Mot de passe d'application (App Password)

Gmail et Yahoo n'autorisent pas l'envoi d'emails avec le mot de passe habituel du compte, seulement avec un **mot de passe d'application** distinct. Les étapes pour chacun apparaissent dans le formulaire de création du groupe, sous « Comment obtenir le mot de passe pour l'envoi des emails ? ». En bref :

- **Gmail :** activez la validation en deux étapes, puis générez le mot de passe dans [Mots de passe des applications](https://support.google.com/accounts/answer/185833?hl=fr).
- **Yahoo :** Sécurité du compte → [Générer un mot de passe d'application](https://help.yahoo.com/kb/SLN15241.html).

Le mot de passe est enregistré chiffré et supprimé automatiquement une fois tous les emails envoyés.

## Tests

```bash
.venv/Scripts/python -m unittest discover -s security_tests -p "test_*.py"
```

Audits de sécurité et de robustesse (Postgres doit être démarré) :

```bash
.venv/Scripts/python security_tests/audit.py
.venv/Scripts/python security_tests/audit_robustness.py
```

## Structure du projet

```
app/                 backend Flask : routes, modèles, validations
app/advent.py        calendrier de l'Avent : quel jour est ouvert, les routes des films
app/services/        envoi des emails, tirage, effacement des données personnelles
email_worker.py      le processus qui envoie les emails de la file
advent_import.py     importe les films du calendrier dans la base de données
start.py             démarre le serveur et le processus d'envoi des emails dans Docker
frontend/            l'application React (pages, composants, thèmes, traductions)
movies/              films et affiches du calendrier (pas dans git)
security_tests/      tests unitaires et audits de sécurité
```
