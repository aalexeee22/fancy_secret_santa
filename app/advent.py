"""Calendarul de advent cu filme: serverul decide ce ușițe sunt deschise.

Filmele zilelor încă încuiate nu pleacă deloc spre browser, ca să nu poată fi
văzute dinainte din codul paginii.
"""
import os
from datetime import date, datetime
from zoneinfo import ZoneInfo

from flask import Blueprint, Response, jsonify

from . import limiter
from .models import AdventMovie, db

advent_bp = Blueprint('advent', __name__)

LAST_DAY = 25
BONUS_DAY = 26
# Ziua de calendar „după Crăciun”: în ianuarie toate ușițele rămân deschise.
ALL_OPEN = 32
DEFAULT_TIMEZONE = 'Europe/Bucharest'
POSTER_CACHE_SECONDS = 24 * 60 * 60


def _timezone():
    try:
        return ZoneInfo(os.environ.get('ADVENT_TIMEZONE') or DEFAULT_TIMEZONE)
    except (KeyError, ValueError):
        return ZoneInfo(DEFAULT_TIMEZONE)


def advent_today(now=None):
    """(ziua din decembrie, zile până la 1 decembrie).

    0 = înainte de decembrie; ALL_OPEN = ianuarie, după sărbători.
    Mereu data reală a serverului: nu există niciun parametru care s-o schimbe.
    """
    now = now or datetime.now(_timezone())
    if now.month == 12:
        return now.day, 0
    if now.month == 1:
        return ALL_OPEN, 0
    return 0, (date(now.year, 12, 1) - now.date()).days


def door_state(day, today):
    """'open', 'today', 'locked' sau None (ușița bonus, încă ascunsă)."""
    if day == BONUS_DAY and today < LAST_DAY:
        return None
    if day < today:
        return 'open'
    if day == today:
        return 'today'
    return 'locked'


@advent_bp.route('/api/advent', methods=['GET'])
@limiter.limit('120 per minute')
def advent_calendar():
    today, days_until = advent_today()
    movies = {m.day: m for m in AdventMovie.query.all()}
    doors = []
    for day in range(1, BONUS_DAY + 1):
        state = door_state(day, today)
        if state is None:
            continue
        door = {'day': day, 'state': state, 'bonus': day == BONUS_DAY}
        movie = movies.get(day)
        if state != 'locked' and movie is not None:
            door['movie'] = {
                **movie.info,
                'has_poster': movie.poster is not None,
            }
        doors.append(door)
    db.session.rollback()
    return jsonify({
        'today': today,
        'days_until_start': days_until,
        'doors': doors,
    })


@advent_bp.route('/api/advent/<int:day>/poster', methods=['GET'])
@limiter.limit('300 per minute')
def advent_poster(day):
    today, _ = advent_today()
    if not 1 <= day <= BONUS_DAY:
        return jsonify({'error': 'not found'}), 404
    if door_state(day, today) in (None, 'locked'):
        return jsonify({'error': 'locked'}), 403
    movie = db.session.get(AdventMovie, day)
    if movie is None or movie.poster is None:
        return jsonify({'error': 'not found'}), 404
    response = Response(movie.poster, mimetype=movie.poster_type or 'image/webp')
    # Ziua deschisă rămâne deschisă, deci posterul poate sta în browser o zi.
    response.headers['Cache-Control'] = f'private, max-age={POSTER_CACHE_SECONDS}'
    db.session.rollback()
    return response
