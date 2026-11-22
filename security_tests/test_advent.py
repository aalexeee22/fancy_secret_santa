"""Calendarul de advent: ce ușițe sunt deschise și ce ajunge în browser."""
import os
import sys
import unittest
from datetime import datetime
from pathlib import Path
from unittest.mock import patch
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ['DATABASE_URL'] = os.environ.get('TEST_DATABASE_URL', 'sqlite://')
os.environ['SECRET_KEY'] = 'isolated-advent-test-key'
os.environ['RATELIMIT_ENABLED'] = '0'
os.environ['FLASK_DEBUG'] = '0'

from app import create_app, db
from app.advent import ALL_OPEN, door_state
from app.models import AdventMovie

BUCHAREST = ZoneInfo('Europe/Bucharest')


class AdventTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = create_app()

    def setUp(self):
        self.context = self.app.app_context()
        self.context.push()
        db.drop_all()
        db.create_all()
        for day in range(1, 27):
            db.session.add(AdventMovie(day=day, info={'title': f'Film {day}', 'movie_link': 'https://example.com'},
                                       poster=b'poster', poster_type='image/webp'))
        db.session.commit()
        self.client = self.app.test_client()

    def tearDown(self):
        db.session.remove()
        self.context.pop()
        os.environ['FLASK_DEBUG'] = '0'

    def at(self, *when):
        moment = datetime(*when, tzinfo=BUCHAREST)
        return patch('app.advent.datetime', **{'now.return_value': moment})

    def calendar(self, *when, query=''):
        with self.at(*when):
            return self.client.get('/api/advent' + query).json

    def test_door_states(self):
        self.assertEqual([door_state(d, 2) for d in (1, 2, 3, 25)], ['open', 'today', 'locked', 'locked'])
        self.assertIsNone(door_state(26, 24))
        self.assertEqual(door_state(26, 25), 'locked')
        self.assertEqual(door_state(26, 26), 'today')
        self.assertEqual(door_state(26, ALL_OPEN), 'open')

    def test_locked_movies_never_reach_the_browser(self):
        data = self.calendar(2026, 12, 2, 10, 0)
        self.assertEqual(data['today'], 2)
        doors = {d['day']: d for d in data['doors']}
        self.assertEqual(len(doors), 25)  # bonusul e încă ascuns
        self.assertEqual(doors[1]['movie']['title'], 'Film 1')
        self.assertEqual(doors[2]['state'], 'today')
        self.assertIn('movie', doors[2])
        for day in range(3, 26):
            self.assertNotIn('movie', doors[day])

    def test_before_and_after_december(self):
        before = self.calendar(2026, 11, 22, 12, 0)
        self.assertEqual((before['today'], before['days_until_start']), (0, 9))
        self.assertTrue(all(d['state'] == 'locked' for d in before['doors']))
        after = self.calendar(2027, 1, 3, 12, 0)
        self.assertEqual(len(after['doors']), 26)
        self.assertTrue(all(d['state'] == 'open' for d in after['doors']))

    def test_bonus_door_appears_on_christmas(self):
        christmas = {d['day']: d for d in self.calendar(2026, 12, 25, 9, 0)['doors']}
        self.assertEqual(christmas[26]['state'], 'locked')
        self.assertTrue(christmas[26]['bonus'])
        self.assertNotIn('movie', christmas[26])
        boxing_day = {d['day']: d for d in self.calendar(2026, 12, 26, 9, 0)['doors']}
        self.assertEqual(boxing_day[26]['state'], 'today')
        self.assertEqual(boxing_day[26]['movie']['title'], 'Film 26')

    def test_romanian_midnight_decides(self):
        # 22:30 UTC pe 4 decembrie = 00:30 pe 5 decembrie la București.
        with patch('app.advent.datetime', **{'now.return_value': datetime(2026, 12, 4, 22, 30, tzinfo=ZoneInfo('UTC')).astimezone(BUCHAREST)}):
            self.assertEqual(self.client.get('/api/advent').json['today'], 5)

    def test_posters_are_locked_with_their_doors(self):
        with self.at(2026, 12, 2, 10, 0):
            self.assertEqual(self.client.get('/api/advent/1/poster').status_code, 200)
            self.assertEqual(self.client.get('/api/advent/2/poster').status_code, 200)
            self.assertEqual(self.client.get('/api/advent/3/poster').status_code, 403)
            self.assertEqual(self.client.get('/api/advent/26/poster').status_code, 403)
            self.assertEqual(self.client.get('/api/advent/99/poster').status_code, 404)
            ok = self.client.get('/api/advent/1/poster')
        self.assertEqual(ok.mimetype, 'image/webp')
        self.assertIn('max-age', ok.headers['Cache-Control'])
        with self.at(2026, 12, 2, 10, 0):
            self.assertEqual(self.client.get('/api/advent').headers['Cache-Control'], 'no-store')

    def test_date_cannot_be_forced(self):
        # Nici măcar local, cu FLASK_DEBUG=1: data vine doar de la ceasul serverului.
        os.environ['FLASK_DEBUG'] = '1'
        for query in ('?zi=25', '?day=25', '?today=25'):
            data = self.calendar(2026, 11, 22, 12, 0, query=query)
            self.assertEqual(data['today'], 0, query)
            self.assertNotIn('test_mode', data)
            with self.at(2026, 11, 22, 12, 0):
                self.assertEqual(self.client.get('/api/advent/1/poster' + query).status_code, 403, query)


if __name__ == '__main__':
    unittest.main()
