"""Dirty Santa: jocul live din timpul petrecerii, fără conturi și fără emailuri.

Cine intră primește un token anonim, pe care telefonul îl păstrează în
localStorage. Serverul păstrează doar hash-ul lui. Ecranul mare al
organizatorului are un token separat, cu drepturi de organizator, dar nu e
jucător: organizatorul care vrea să joace se înscrie de pe telefonul lui.

Telefoanele întreabă la câteva secunde „s-a schimbat ceva după versiunea X?”.
Dacă nu, răspunsul e un 204 gol, deci cererea e foarte ieftină.
"""
import hashlib
import hmac
import re
import secrets
from datetime import datetime, timezone

from flask import Blueprint, jsonify, request
from flask_limiter.util import get_remote_address

from . import limiter
from .dirty_engine import (
    MAX_STEAL_LIMIT, MIN_STEAL_LIMIT, DEFAULT_STEAL_LIMIT, PHASE_DONE,
    Move, RuleError, apply_move, awards, replay,
)
from .i18n import t
from .models import DirtyGame, DirtyMove, DirtyPlayer, db, generate_dirty_code
from .security import ValidationError, clean_budget, clean_text, json_body
from .services.dirty_cleanup import purge_dirty_games

dirty_bp = Blueprint('dirty', __name__)

MAX_PLAYERS = 30
MIN_PLAYERS = 3
MOVE_KINDS = ('open', 'steal', 'final_swap', 'keep')


def utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def iso(moment):
    """Ora în UTC, marcată explicit, ca browserul s-o afișeze în fusul lui."""
    return moment.isoformat() + 'Z' if moment else None


def hash_token(token):
    return hashlib.sha256(token.encode()).hexdigest()


def new_token():
    return secrets.token_urlsafe(24)


def normalize_code(code):
    """„xmas 24” și „XMAS-24” sunt același cod."""
    return re.sub(r'[\s-]', '', code or '').upper()[:12]


def rate_key():
    """La o petrecere toate telefoanele ies pe internet prin același Wi-Fi, deci cu același IP.

    Pentru cererile cu token, limita se numără pe token, ca 20 de telefoane
    din aceeași cameră să nu se blocheze unul pe altul.
    """
    token = request.headers.get('X-Player-Token') or request.headers.get('X-Host-Token')
    if token:
        return 'dirty:' + hash_token(token)[:32]
    return get_remote_address()


def error(key, http_status, **extra):
    return jsonify({'error': t(key), **extra}), http_status


def find_game(code, lock=False):
    query = DirtyGame.query.filter_by(code=normalize_code(code))
    if lock:
        # Cererile simultane pe același joc așteaptă una după alta.
        query = query.with_for_update()
    return query.first()


def identify(game):
    """('host', None), ('player', jucătorul) sau (None, None)."""
    host_token = request.headers.get('X-Host-Token')
    if host_token and hmac.compare_digest(hash_token(host_token), game.host_token_hash):
        return 'host', None
    player_token = request.headers.get('X-Player-Token')
    if player_token:
        player = DirtyPlayer.query.filter_by(game_id=game.id, token_hash=hash_token(player_token)).first()
        if player:
            return 'player', player
    return None, None


def load_players(game):
    players = DirtyPlayer.query.filter_by(game_id=game.id).order_by(DirtyPlayer.id).all()
    if game.status != 'lobby':
        players.sort(key=lambda p: (p.turn_order is None, p.turn_order or 0, p.id))
    return players


def load_moves(game):
    return DirtyMove.query.filter_by(game_id=game.id).order_by(DirtyMove.seq).all()


def compute_state(game, players, moves):
    if game.status == 'lobby':
        return None
    order = [p.id for p in players if p.turn_order is not None]
    return replay(order, [
        Move(seq=m.seq, kind=m.kind, actor_id=m.actor_id, target_seq=m.target_seq)
        for m in moves
    ], game.steal_limit, game.final_round)


def touch(game):
    game.version += 1
    game.updated_at = utcnow()


def game_to_dict(game, role, me=None):
    players = load_players(game)
    moves = load_moves(game)
    state = compute_state(game, players, moves)

    result = {
        'code': game.code,
        'status': game.status,
        'version': game.version,
        'created_at': iso(game.created_at),
        'started_at': iso(game.started_at),
        'finished_at': iso(game.finished_at),
        'settings': {
            'steal_limit': game.steal_limit,
            'final_round': game.final_round,
            'budget': game.budget,
        },
        'is_host': role == 'host',
        'me': me.id if me else None,
        'players': [{
            'id': p.id,
            'nickname': p.nickname,
            'turn_order': p.turn_order,
            'local': bool(p.added_by_host),
            'gift_id': state.holder.get(p.id) if state else None,
        } for p in players],
        'gifts': [],
        'moves': [],
        'turn': None,
        'unopened': len(players),
        'awards': None,
    }
    if state is None:
        return result

    result['gifts'] = [{
        'id': g.id,
        'number': g.number,
        'opened_by': g.opened_by,
        'holder_id': g.holder_id,
        'steals': g.steals,
        'locked': state.is_locked(g),
        'can_take': state.can_steal(g.id),
    } for g in state.gifts.values()]
    result['moves'] = [{
        'seq': m.seq,
        'kind': m.kind,
        'actor_id': m.actor_id,
        'gift_id': m.seq if m.kind == 'open' else m.target_seq,
        'victim_id': state.victims.get(m.seq),
        'by_host': m.by_host,
        'at': iso(m.created_at),
    } for m in moves]
    result['unopened'] = state.unopened_count
    if state.current is not None:
        result['turn'] = {
            'player_id': state.current,
            'phase': state.phase,
            'round': min(state.opened_count + 1, len(state.order)),
            'rounds': len(state.order),
        }
    if state.phase == PHASE_DONE:
        result['awards'] = awards(state)
    return result


def read_version(data):
    version = data.get('version')
    if isinstance(version, bool) or not isinstance(version, int):
        raise ValidationError('invalid_request')
    return version


@dirty_bp.route('/api/dirty', methods=['POST'])
@limiter.limit('10 per hour')
def create_game():
    data = json_body()
    steal_limit = data.get('steal_limit', DEFAULT_STEAL_LIMIT)
    if isinstance(steal_limit, bool) or not isinstance(steal_limit, int) \
            or not MIN_STEAL_LIMIT <= steal_limit <= MAX_STEAL_LIMIT:
        raise ValidationError('dirty_steal_limit', min=MIN_STEAL_LIMIT, max=MAX_STEAL_LIMIT)
    final_round = data.get('final_round', True)
    if not isinstance(final_round, bool):
        raise ValidationError('invalid_request')
    budget = clean_budget(data.get('budget'))

    # Ocazie bună să ștergem jocurile vechi, chiar dacă workerul de email nu rulează.
    purge_dirty_games()

    host_token = new_token()
    code = next((c for c in (generate_dirty_code() for _ in range(10))
                 if not DirtyGame.query.filter_by(code=c).first()), None)
    if code is None:
        return error('server_error', 500)

    game = DirtyGame(code=code, host_token_hash=hash_token(host_token), steal_limit=steal_limit,
                     final_round=final_round, budget=budget)
    db.session.add(game)
    db.session.commit()
    return jsonify({'code': game.code, 'host_token': host_token}), 201


@dirty_bp.route('/api/dirty/<code>/info', methods=['GET'])
@limiter.limit('60 per minute')
def game_info(code):
    """Ce vede oricine are codul: doar dacă se mai poate intra. Fără nume și fără cadouri."""
    game = find_game(code)
    if not game:
        return error('dirty_not_found', 404)
    result = {
        'code': game.code,
        'status': game.status,
        'started_at': iso(game.started_at),
        'player_count': DirtyPlayer.query.filter_by(game_id=game.id).count(),
        'budget': game.budget,
        'steal_limit': game.steal_limit,
    }
    db.session.rollback()
    return jsonify(result)


@dirty_bp.route('/api/dirty/<code>/join', methods=['POST'])
@limiter.limit('60 per minute')
def join_game(code):
    data = json_body()
    nickname = clean_text(data.get('nickname'), 'nickname')

    game = find_game(code, lock=True)
    if not game:
        return error('dirty_not_found', 404)
    if game.status != 'lobby':
        db.session.rollback()
        key = 'dirty_already_started' if game.status == 'playing' else 'dirty_already_finished'
        return error(key, 409, status=game.status, started_at=iso(game.started_at))
    refused = refuse_new_player(game, nickname)
    if refused:
        return refused

    token = new_token()
    player = DirtyPlayer(game_id=game.id, nickname=nickname, token_hash=hash_token(token))
    db.session.add(player)
    touch(game)
    db.session.commit()
    return jsonify({'player_id': player.id, 'nickname': player.nickname, 'token': token, 'code': game.code}), 201


def refuse_new_player(game, nickname):
    """Jocul e plin sau numele e luat: răspunsul de eroare (cu rollback), altfel None."""
    players = DirtyPlayer.query.filter_by(game_id=game.id).all()
    if len(players) >= MAX_PLAYERS:
        db.session.rollback()
        return jsonify({'error': t('dirty_full', max=MAX_PLAYERS)}), 400
    if any(p.nickname.casefold() == nickname.casefold() for p in players):
        db.session.rollback()
        return error('dirty_nickname_taken', 400)
    return None


@dirty_bp.route('/api/dirty/<code>', methods=['GET'])
@limiter.limit('150 per minute', key_func=rate_key)
def get_game(code):
    game = find_game(code)
    if not game:
        return error('dirty_not_found', 404)
    role, me = identify(game)
    if role is None:
        db.session.rollback()
        return error('dirty_forbidden', 403, status=game.status)
    since = request.args.get('since', type=int)
    if since is not None and since == game.version:
        db.session.rollback()
        return '', 204
    result = game_to_dict(game, role, me)
    db.session.rollback()
    return jsonify(result)


def host_game(code):
    """Jocul blocat pentru scriere, doar pentru ecranul organizatorului; altfel răspunsul de eroare."""
    game = find_game(code, lock=True)
    if not game:
        return None, error('dirty_not_found', 404)
    role, _ = identify(game)
    if role != 'host':
        db.session.rollback()
        return None, error('dirty_forbidden', 403)
    return game, None


@dirty_bp.route('/api/dirty/<code>/players', methods=['POST'])
@limiter.limit('60 per minute', key_func=rate_key)
def add_local_player(code):
    """Organizatorul adaugă un jucător fără telefon; când îi vine rândul, joacă organizatorul pentru el."""
    nickname = clean_text(json_body().get('nickname'), 'nickname')
    game, failure = host_game(code)
    if failure:
        return failure
    if game.status != 'lobby':
        db.session.rollback()
        return error('dirty_not_lobby', 400)
    refused = refuse_new_player(game, nickname)
    if refused:
        return refused
    # Tokenul nu ajunge la nimeni; dacă jucătorul primește totuși un telefon, organizatorul îl reconectează.
    db.session.add(DirtyPlayer(game_id=game.id, nickname=nickname, token_hash=hash_token(new_token()), added_by_host=True))
    touch(game)
    db.session.commit()
    return jsonify(game_to_dict(game, 'host')), 201


@dirty_bp.route('/api/dirty/<code>/players/<int:player_id>', methods=['DELETE'])
@limiter.limit('60 per minute', key_func=rate_key)
def remove_player(code, player_id):
    game, failure = host_game(code)
    if failure:
        return failure
    if game.status != 'lobby':
        db.session.rollback()
        return error('dirty_not_lobby', 400)
    player = DirtyPlayer.query.filter_by(id=player_id, game_id=game.id).first()
    if not player:
        db.session.rollback()
        return error('participant_not_found', 404)
    db.session.delete(player)
    touch(game)
    db.session.commit()
    return jsonify(game_to_dict(game, 'host'))


@dirty_bp.route('/api/dirty/<code>/start', methods=['POST'])
@limiter.limit('30 per minute', key_func=rate_key)
def start_game(code):
    game, failure = host_game(code)
    if failure:
        return failure
    if game.status != 'lobby':
        db.session.rollback()
        return error('dirty_not_lobby', 400)
    players = DirtyPlayer.query.filter_by(game_id=game.id).all()
    if len(players) < MIN_PLAYERS:
        db.session.rollback()
        return jsonify({'error': t('dirty_min_players', min=MIN_PLAYERS)}), 400
    # Ordinea se trage pe server, cu generatorul criptografic.
    secrets.SystemRandom().shuffle(players)
    for index, player in enumerate(players):
        player.turn_order = index + 1
    game.status = 'playing'
    game.started_at = utcnow()
    touch(game)
    db.session.commit()
    return jsonify(game_to_dict(game, 'host'))


@dirty_bp.route('/api/dirty/<code>/move', methods=['POST'])
@limiter.limit('60 per minute', key_func=rate_key)
def make_move(code):
    data = json_body()
    kind = data.get('kind')
    if kind not in MOVE_KINDS:
        raise ValidationError('invalid_request')
    version = read_version(data)
    target = data.get('gift_id') if kind in ('steal', 'final_swap') else None
    if kind in ('steal', 'final_swap') and (isinstance(target, bool) or not isinstance(target, int)):
        raise ValidationError('invalid_request')

    game = find_game(code, lock=True)
    if not game:
        return error('dirty_not_found', 404)
    role, me = identify(game)
    if role is None:
        db.session.rollback()
        return error('dirty_forbidden', 403)
    if game.status != 'playing':
        db.session.rollback()
        return error('dirty_not_playing', 409, version=game.version)
    # Telefonul a văzut o stare veche (dublu-tap, sau altcineva a mutat în aceeași secundă).
    if version != game.version:
        db.session.rollback()
        return error('dirty_stale', 409, version=game.version)

    players = load_players(game)
    moves = load_moves(game)
    state = compute_state(game, players, moves)
    actor_id = state.current if role == 'host' else me.id
    seq = (moves[-1].seq if moves else 0) + 1
    move = Move(seq=seq, kind=kind, actor_id=actor_id, target_seq=target)
    try:
        apply_move(state, move)
    except RuleError as e:
        db.session.rollback()
        return error(e.key, 400)

    db.session.add(DirtyMove(game_id=game.id, seq=seq, kind=kind, actor_id=actor_id,
                             target_seq=target, by_host=role == 'host'))
    if state.phase == PHASE_DONE:
        game.status = 'finished'
        game.finished_at = utcnow()
    touch(game)
    db.session.commit()
    return jsonify(game_to_dict(game, role, me))


@dirty_bp.route('/api/dirty/<code>/undo', methods=['POST'])
@limiter.limit('30 per minute', key_func=rate_key)
def undo_move(code):
    version = read_version(json_body())
    game, failure = host_game(code)
    if failure:
        return failure
    if game.status not in ('playing', 'finished'):
        db.session.rollback()
        return error('dirty_nothing_to_undo', 400)
    if version != game.version:
        db.session.rollback()
        return error('dirty_stale', 409, version=game.version)
    last = DirtyMove.query.filter_by(game_id=game.id).order_by(DirtyMove.seq.desc()).first()
    if not last:
        db.session.rollback()
        return error('dirty_nothing_to_undo', 400)
    db.session.delete(last)
    game.status = 'playing'
    game.finished_at = None
    touch(game)
    db.session.commit()
    return jsonify(game_to_dict(game, 'host'))


@dirty_bp.route('/api/dirty/<code>/players/<int:player_id>/reconnect', methods=['POST'])
@limiter.limit('30 per minute', key_func=rate_key)
def reconnect_player(code, player_id):
    """Token nou pentru un jucător care și-a pierdut telefonul; cel vechi nu mai merge."""
    game, failure = host_game(code)
    if failure:
        return failure
    if game.status == 'finished':
        db.session.rollback()
        return error('dirty_already_finished', 400)
    player = DirtyPlayer.query.filter_by(id=player_id, game_id=game.id).first()
    if not player:
        db.session.rollback()
        return error('participant_not_found', 404)
    token = new_token()
    player.token_hash = hash_token(token)
    if player.added_by_host:
        # Acum are telefon: joacă singur.
        player.added_by_host = False
        touch(game)
    db.session.commit()
    return jsonify({'player_id': player.id, 'nickname': player.nickname, 'token': token, 'code': game.code})
