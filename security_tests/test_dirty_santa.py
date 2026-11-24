"""Dirty Santa: regulile jocului, tokenurile și ștergerea jocurilor vechi."""
import os
import sys
import unittest
from datetime import timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ['DATABASE_URL'] = os.environ.get('TEST_DATABASE_URL', 'sqlite://')
os.environ['SECRET_KEY'] = 'isolated-dirty-santa-test-key'
os.environ['RATELIMIT_ENABLED'] = '0'
os.environ['FLASK_DEBUG'] = '0'

from app import create_app, db
from app.dirty_engine import PHASE_DONE, PHASE_FINAL, Move, RuleError, apply_move, awards, replay
from app.dirty_santa import utcnow
from app.models import DirtyGame, DirtyMove, DirtyPlayer
from app.services.dirty_cleanup import purge_dirty_games


class EngineTests(unittest.TestCase):
    """Regulile, fără server: ordinea e A=1, B=2, C=3."""

    def play(self, moves, steal_limit=3, final_round=True, order=(1, 2, 3)):
        return replay(order, [Move(seq=i + 1, **m) for i, m in enumerate(moves)], steal_limit, final_round)

    def refused(self, state, key, **move):
        before = (dict(state.holder), state.current)
        with self.assertRaises(RuleError) as caught:
            apply_move(state, Move(seq=99, **move))
        self.assertEqual(caught.exception.key, key)
        self.assertEqual((dict(state.holder), state.current), before)

    def test_turns_follow_the_order(self):
        state = self.play([dict(kind='open', actor_id=1)])
        self.assertEqual(state.current, 2)
        self.refused(state, 'dirty_not_your_turn', kind='open', actor_id=3)

    def test_victim_plays_next_and_chain_ends_on_open(self):
        state = self.play([
            dict(kind='open', actor_id=1),
            dict(kind='steal', actor_id=2, target_seq=1),
        ])
        self.assertEqual(state.current, 1)
        self.assertEqual(state.gifts[1].holder_id, 2)
        self.assertNotIn(1, state.holder)
        apply_move(state, Move(seq=3, kind='open', actor_id=1))
        self.assertEqual(state.current, 3)
        # Cadourile n-au nume: sunt numerotate în ordinea în care au fost desfăcute.
        self.assertEqual([g.number for g in state.gifts.values()], [1, 2])

    def test_steal_back_allowed_until_the_limit(self):
        # Ioana și Andrei își fură același cadou înapoi până se blochează.
        state = self.play([
            dict(kind='open', actor_id=1),
            dict(kind='steal', actor_id=2, target_seq=1),
            dict(kind='steal', actor_id=1, target_seq=1),
        ], steal_limit=3)
        self.assertEqual(state.gifts[1].holder_id, 1)
        self.assertEqual(state.current, 2)
        apply_move(state, Move(seq=4, kind='steal', actor_id=2, target_seq=1))
        self.assertTrue(state.is_locked(state.gifts[1]))
        self.assertEqual(state.current, 1)
        # Blocat la 3 furturi: Ioana nu-l mai poate lua, trebuie să deschidă altul.
        self.refused(state, 'dirty_gift_locked', kind='steal', actor_id=1, target_seq=1)
        apply_move(state, Move(seq=5, kind='open', actor_id=1))
        self.assertEqual(state.current, 3)

    def test_gift_locks_at_the_limit(self):
        state = self.play([
            dict(kind='open', actor_id=1),
            dict(kind='steal', actor_id=2, target_seq=1),
            dict(kind='open', actor_id=1),
            dict(kind='steal', actor_id=3, target_seq=1),
        ], steal_limit=2)
        self.assertTrue(state.is_locked(state.gifts[1]))
        apply_move(state, Move(seq=5, kind='open', actor_id=2))
        # Ultima șansă: A poate lua doar ce nu e blocat.
        self.assertEqual(state.phase, PHASE_FINAL)
        self.refused(state, 'dirty_gift_locked', kind='final_swap', actor_id=1, target_seq=1)

    def test_final_swap_and_finish(self):
        state = self.play([
            dict(kind='open', actor_id=1),
            dict(kind='open', actor_id=2),
            dict(kind='open', actor_id=3),
        ])
        self.assertEqual((state.phase, state.current), (PHASE_FINAL, 1))
        apply_move(state, Move(seq=4, kind='final_swap', actor_id=1, target_seq=2))
        self.assertTrue(state.finished)
        self.assertEqual(state.holder, {1: 2, 2: 1, 3: 3})
        self.refused(state, 'dirty_game_over', kind='keep', actor_id=1)

    def test_without_final_round_game_ends_after_last_open(self):
        state = self.play([
            dict(kind='open', actor_id=1),
            dict(kind='open', actor_id=2),
            dict(kind='open', actor_id=3),
        ], final_round=False)
        self.assertEqual(state.phase, PHASE_DONE)

    def test_final_round_skipped_when_own_gift_is_locked(self):
        state = self.play([
            dict(kind='open', actor_id=1),
            dict(kind='open', actor_id=2),
            dict(kind='steal', actor_id=3, target_seq=1),
            dict(kind='steal', actor_id=1, target_seq=2),
            dict(kind='open', actor_id=2),
        ], steal_limit=1)
        # A are cadoul 2, blocat: n-are ce schimba.
        self.assertEqual(state.phase, PHASE_DONE)

    def test_cannot_open_more_gifts_than_players(self):
        state = self.play([
            dict(kind='open', actor_id=1),
            dict(kind='open', actor_id=2),
            dict(kind='open', actor_id=3),
        ])
        self.refused(state, 'dirty_invalid_move', kind='open', actor_id=1)

    def test_awards(self):
        state = self.play([
            dict(kind='open', actor_id=1),
            dict(kind='steal', actor_id=2, target_seq=1),
            dict(kind='open', actor_id=1),
            dict(kind='steal', actor_id=3, target_seq=1),
            dict(kind='steal', actor_id=2, target_seq=3),
            dict(kind='open', actor_id=1),
            dict(kind='keep', actor_id=1),
        ])
        result = awards(state)
        self.assertEqual(result['biggest_thief'], [2])
        self.assertEqual(result['most_wanted_gift'], [1])
        self.assertEqual(result['unlucky'], [1])


class ApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = create_app()

    def setUp(self):
        self.context = self.app.app_context()
        self.context.push()
        db.drop_all()
        db.create_all()
        self.client = self.app.test_client()

    def tearDown(self):
        db.session.remove()
        self.context.pop()

    def create(self, **settings):
        response = self.client.post('/api/dirty', json=settings)
        self.assertEqual(response.status_code, 201)
        return response.json['code'], {'X-Host-Token': response.json['host_token']}

    def join(self, code, nickname):
        response = self.client.post(f'/api/dirty/{code}/join', json={'nickname': nickname})
        self.assertEqual(response.status_code, 201, response.json)
        return response.json['player_id'], {'X-Player-Token': response.json['token']}

    def started(self, players=('Ana', 'Bogdan', 'Cristi'), **settings):
        code, host = self.create(**settings)
        joined = {name: self.join(code, name) for name in players}
        state = self.client.post(f'/api/dirty/{code}/start', headers=host).json
        return code, host, joined, state

    def move(self, code, headers, version, **body):
        return self.client.post(f'/api/dirty/{code}/move', json={'version': version, **body}, headers=headers)

    def headers_of(self, joined, player_id):
        return next(h for pid, h in joined.values() if pid == player_id)

    def test_code_is_readable_and_normalized(self):
        code, _ = self.create()
        self.assertEqual(len(code), 6)
        self.assertFalse(set(code) & set('0O1IL'))
        spaced = code[:3].lower() + ' ' + code[3:].lower()
        self.assertEqual(self.client.get(f'/api/dirty/{spaced}/info').json['code'], code)

    def test_nothing_visible_without_a_token(self):
        code, host, joined, _ = self.started()
        response = self.client.get(f'/api/dirty/{code}')
        self.assertEqual(response.status_code, 403)
        self.assertNotIn('players', response.json)
        info = self.client.get(f'/api/dirty/{code}/info').json
        self.assertNotIn('players', info)
        self.assertEqual(info['status'], 'playing')
        # Tokenul unui joc nu merge la altul.
        other, _ = self.create()
        self.assertEqual(self.client.get(f'/api/dirty/{other}', headers=joined['Ana'][1]).status_code, 403)

    def test_no_new_players_after_start_but_old_ones_come_back(self):
        code, host, joined, _ = self.started()
        late = self.client.post(f'/api/dirty/{code}/join', json={'nickname': 'Dan'})
        self.assertEqual(late.status_code, 409)
        self.assertEqual(late.json['status'], 'playing')
        self.assertTrue(late.json['started_at'].endswith('Z'))
        # „Refresh”: același token, aceeași stare.
        state = self.client.get(f'/api/dirty/{code}', headers=joined['Ana'][1]).json
        self.assertEqual(state['me'], joined['Ana'][0])
        self.assertEqual(state['status'], 'playing')

    def test_duplicate_nickname_and_minimum_players(self):
        code, host = self.create()
        self.join(code, 'Ana')
        self.assertEqual(self.client.post(f'/api/dirty/{code}/join', json={'nickname': 'ana'}).status_code, 400)
        self.join(code, 'Bogdan')
        self.assertEqual(self.client.post(f'/api/dirty/{code}/start', headers=host).status_code, 400)

    def test_only_host_can_start(self):
        code, host = self.create()
        players = [self.join(code, n) for n in ('Ana', 'Bogdan', 'Cristi')]
        self.assertEqual(self.client.post(f'/api/dirty/{code}/start', headers=players[0][1]).status_code, 403)

    def test_full_game_with_steal_undo_and_finish(self):
        code, host, joined, state = self.started()
        version = state['version']
        order = [p['id'] for p in state['players']]
        first, second, third = (self.headers_of(joined, pid) for pid in order)

        # Al doilea nu poate juca în locul primului.
        self.assertEqual(self.move(code, second, version, kind='open').status_code, 400)

        state = self.move(code, first, version, kind='open').json
        gift = state['gifts'][0]['id']
        state = self.move(code, second, state['version'], kind='steal', gift_id=gift).json
        self.assertEqual(state['turn']['player_id'], order[0])
        self.assertEqual(state['moves'][-1]['victim_id'], order[0])
        # Furtul înapoi e permis cât timp nu s-a atins limita.
        back = self.move(code, first, state['version'], kind='steal', gift_id=gift)
        self.assertEqual(back.status_code, 200)
        state = self.move(code, second, back.json['version'], kind='open').json
        self.assertEqual(state['turn']['player_id'], order[2])

        # Dublu-tap: a doua cerere cu aceeași versiune e refuzată.
        stale_version = state['version']
        state = self.move(code, third, stale_version, kind='open').json
        self.assertEqual(self.move(code, third, stale_version, kind='open').status_code, 409)
        self.assertEqual(state['turn']['phase'], 'final')

        # Undo, apoi din nou.
        undone = self.client.post(f'/api/dirty/{code}/undo', json={'version': state['version']}, headers=host).json
        self.assertEqual(len(undone['moves']), 4)
        self.assertEqual(undone['turn']['player_id'], order[2])
        state = self.move(code, third, undone['version'], kind='open').json
        self.assertEqual(state['turn']['phase'], 'final')

        # Organizatorul joacă în locul celui de la rând (ultima șansă: rămâne cu cadoul).
        state = self.move(code, host, state['version'], kind='keep').json
        self.assertTrue(state['moves'][-1]['by_host'])
        self.assertEqual(state['status'], 'finished')
        self.assertIsNotNone(state['finished_at'])
        self.assertEqual(sorted(state['awards']['biggest_thief']), sorted([order[0], order[1]]))
        self.assertEqual(self.move(code, first, state['version'], kind='keep').status_code, 409)

        # Undo după final redeschide jocul.
        undone = self.client.post(f'/api/dirty/{code}/undo', json={'version': state['version']}, headers=host).json
        self.assertEqual(undone['status'], 'playing')

    def test_host_adds_players_without_phones_and_plays_for_them(self):
        code, host = self.create()
        ana_id, ana = self.join(code, 'Ana')
        add = lambda name, headers=host: self.client.post(f'/api/dirty/{code}/players', json={'nickname': name}, headers=headers)

        # Doar organizatorul poate adăuga, iar numele rămân unice.
        self.assertEqual(add('Bunica', ana).status_code, 403)
        self.assertEqual(add('Bunica').status_code, 201)
        self.assertEqual(add('bunica').status_code, 400)
        state = add('Tata').json
        local = {p['nickname']: p['local'] for p in state['players']}
        self.assertEqual(local, {'Ana': False, 'Bunica': True, 'Tata': True})

        state = self.client.post(f'/api/dirty/{code}/start', headers=host).json
        self.assertEqual(add('Unchiul').status_code, 400)

        # Când e rândul unui jucător fără telefon, organizatorul mută pentru el.
        while state['turn']['player_id'] == ana_id:
            state = self.move(code, ana, state['version'], kind='open').json
        current = state['turn']['player_id']
        state = self.move(code, host, state['version'], kind='open').json
        self.assertEqual(state['moves'][-1]['actor_id'], current)
        self.assertTrue(state['moves'][-1]['by_host'])

        # Dacă primește totuși un telefon, joacă singur de acolo.
        bunica = next(p['id'] for p in state['players'] if p['nickname'] == 'Bunica')
        token = self.client.post(f'/api/dirty/{code}/players/{bunica}/reconnect', headers=host).json['token']
        me = self.client.get(f'/api/dirty/{code}', headers={'X-Player-Token': token}).json
        self.assertEqual(me['me'], bunica)
        self.assertFalse(next(p for p in me['players'] if p['id'] == bunica)['local'])

    def test_polling_returns_204_when_nothing_changed(self):
        code, host, joined, state = self.started()
        headers = joined['Ana'][1]
        self.assertEqual(self.client.get(f'/api/dirty/{code}?since={state["version"]}', headers=headers).status_code, 204)
        self.assertEqual(self.client.get(f'/api/dirty/{code}?since={state["version"] - 1}', headers=headers).status_code, 200)

    def test_reconnect_replaces_the_token(self):
        code, host, joined, _ = self.started()
        pid, old = joined['Ana']
        fresh = self.client.post(f'/api/dirty/{code}/players/{pid}/reconnect', headers=host).json
        self.assertEqual(self.client.get(f'/api/dirty/{code}', headers=old).status_code, 403)
        self.assertEqual(self.client.get(f'/api/dirty/{code}', headers={'X-Player-Token': fresh['token']}).json['me'], pid)

    def test_host_can_remove_from_lobby_only(self):
        code, host = self.create()
        pid, _ = self.join(code, 'Ana')
        self.assertEqual(self.client.delete(f'/api/dirty/{code}/players/{pid}', headers=host).status_code, 200)
        code, host, joined, _ = self.started()
        self.assertEqual(self.client.delete(f'/api/dirty/{code}/players/{joined["Ana"][0]}', headers=host).status_code, 400)

    def test_tokens_are_stored_hashed(self):
        code, host = self.create()
        _, player = self.join(code, 'Ana')
        stored = DirtyPlayer.query.one().token_hash
        self.assertNotEqual(stored, player['X-Player-Token'])
        self.assertNotEqual(DirtyGame.query.one().host_token_hash, host['X-Host-Token'])

    def test_settings_are_validated(self):
        for bad in ({'steal_limit': 0}, {'steal_limit': 6}, {'steal_limit': True}, {'final_round': 'da'}):
            self.assertEqual(self.client.post('/api/dirty', json=bad).status_code, 400, bad)

    def test_cleanup(self):
        now = utcnow()
        finished_code, _, _, _ = self.started()
        fresh_code, _, _, _ = self.started(players=('X', 'Y', 'Z'))
        abandoned_code, _ = self.create()
        finished = DirtyGame.query.filter_by(code=finished_code).one()
        finished.status, finished.finished_at = 'finished', now - timedelta(hours=25)
        DirtyGame.query.filter_by(code=abandoned_code).one().updated_at = now - timedelta(hours=49)
        db.session.commit()

        self.assertEqual(purge_dirty_games(now), 2)
        self.assertEqual([g.code for g in DirtyGame.query.all()], [fresh_code])
        remaining = DirtyGame.query.one().id
        self.assertTrue(all(p.game_id == remaining for p in DirtyPlayer.query.all()))
        self.assertEqual(DirtyMove.query.filter(DirtyMove.game_id != remaining).count(), 0)


if __name__ == '__main__':
    unittest.main()
