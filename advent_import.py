"""Încarcă filmele calendarului de advent în baza de date.

Folosire:
    .venv/bin/python advent_import.py movies/
    .venv/bin/python advent_import.py movies/ --dry-run   # doar verifică

Folderul conține christmas_movies.json și posterele la care trimite câmpul „cover”.
Totul e verificat înainte să se scrie ceva; o zi care există deja e actualizată.
"""
import argparse
import io
import json
import sys
from pathlib import Path
from urllib.parse import urlparse

from PIL import Image, UnidentifiedImageError

DAYS = range(1, 27)  # 1–25 + ușița bonus de pe 26
REQUIRED = ('day', 'title', 'cover')
LINKS = ('url_IMDB', 'trailer_link', 'movie_link')
POSTER_SIZE = (400, 600)
JSON_NAME = 'christmas_movies.json'


def load_movies(folder):
    path = folder / JSON_NAME
    if not path.is_file():
        sys.exit(f'Nu găsesc {path}')
    try:
        movies = json.loads(path.read_text(encoding='utf-8'))
    except json.JSONDecodeError as e:
        sys.exit(f'{path} nu e JSON valid: {e}')
    if not isinstance(movies, list):
        sys.exit(f'{path} trebuie să conțină o listă de filme')
    return movies


def validate(movies, folder):
    errors, seen = [], set()
    for i, movie in enumerate(movies, 1):
        where = f'filmul #{i} ({movie.get("title", "fără titlu") if isinstance(movie, dict) else "?"})'
        if not isinstance(movie, dict):
            errors.append(f'{where}: nu e un obiect JSON')
            continue
        for key in REQUIRED:
            if not movie.get(key):
                errors.append(f'{where}: lipsește „{key}”')
        day = movie.get('day')
        if not isinstance(day, int) or day not in DAYS:
            errors.append(f'{where}: „day” trebuie să fie între 1 și 26')
        elif day in seen:
            errors.append(f'{where}: ziua {day} apare de două ori')
        seen.add(day)
        for key in LINKS:
            url = movie.get(key)
            if url is not None and (not isinstance(url, str) or urlparse(url).scheme != 'https' or not urlparse(url).netloc):
                errors.append(f'{where}: „{key}” trebuie să fie un link https')
        cover = movie.get('cover')
        if cover and not (folder / cover).is_file():
            errors.append(f'{where}: nu găsesc posterul „{cover}”')
    missing = sorted(set(DAYS[:-1]) - seen)
    if missing:
        print(f'Atenție: nu au film zilele {missing}. Ușițele lor vor arăta 🎬 fără poster.')
    return errors


def convert_poster(path):
    """WebP de cel mult 400×600, ca pagina să se încarce repede."""
    try:
        with Image.open(path) as image:
            image = image.convert('RGB')
            image.thumbnail(POSTER_SIZE, Image.LANCZOS)
            out = io.BytesIO()
            image.save(out, 'WEBP', quality=82, method=6)
            return out.getvalue()
    except (UnidentifiedImageError, OSError) as e:
        raise ValueError(f'{path.name} nu e o imagine validă: {e}') from e


def main():
    parser = argparse.ArgumentParser(description='Importă filmele calendarului de advent.')
    parser.add_argument('folder', type=Path, help=f'folderul cu {JSON_NAME} și posterele')
    parser.add_argument('--dry-run', action='store_true', help='doar verifică, fără să scrie în baza de date')
    args = parser.parse_args()

    movies = load_movies(args.folder)
    errors = validate(movies, args.folder)
    if errors:
        print('Nu am importat nimic. Probleme găsite:')
        for error in errors:
            print('  -', error)
        sys.exit(1)

    posters = {}
    try:
        for movie in movies:
            posters[movie['day']] = convert_poster(args.folder / movie['cover'])
    except ValueError as e:
        sys.exit(f'Nu am importat nimic. {e}')

    total_kb = sum(len(p) for p in posters.values()) // 1024
    if args.dry_run:
        print(f'Totul e în regulă: {len(movies)} filme, postere de {total_kb} KB în total. Nimic scris (--dry-run).')
        return

    from app import create_app, db
    from app.models import AdventMovie

    app = create_app()
    with app.app_context():
        for movie in movies:
            day = movie['day']
            info = {k: v for k, v in movie.items() if k not in ('day', 'cover')}
            row = db.session.get(AdventMovie, day) or AdventMovie(day=day)
            row.info, row.poster, row.poster_type = info, posters[day], 'image/webp'
            db.session.add(row)
        db.session.commit()
    print(f'Gata: {len(movies)} filme importate, postere de {total_kb} KB în total.')


if __name__ == '__main__':
    main()
