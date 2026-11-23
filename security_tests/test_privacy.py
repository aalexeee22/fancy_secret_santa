"""Datele personale dispar după ce toate mailurile au plecat (sau după sezon)."""
import os
import sys
import unittest
from datetime import datetime
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ['DATABASE_URL'] = os.environ.get('TEST_DATABASE_URL', 'sqlite://')
os.environ['SECRET_KEY'] = 'isolated-privacy-test-key'
os.environ['RATELIMIT_ENABLED'] = '0'
os.environ['FLASK_DEBUG'] = '0'

from app import create_app, db
from app.models import EmailDelivery, Participant, SantaGroup
from app.services.delivery_service import deliver_one
from app.services.privacy_service import ERASED_GROUP_NAME, purge_personal_data, season_cutoff

SEND = 'app.services.delivery_service.EmailService.send_assignment'


class PrivacyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = create_app()

    def setUp(self):
        self.context = self.app.app_context()
        self.context.push()
        db.drop_all()
        db.create_all()
        self.client = self.app.test_client()
        self.group_id, self.headers = self.create_group('Familia Popescu')

    def tearDown(self):
        db.session.remove()
        self.context.pop()

    def create_group(self, name):
        with patch('app.routes.EmailService.send_admin_link', return_value=True):
            response = self.client.post('/api/groups', json={
                'name': name, 'smtp_provider': 'gmail',
                'smtp_email': 'org@gmail.com', 'smtp_password': 'app-password',
            })
        return response.json['id'], {'X-Admin-Code': response.json['admin_code']}

    def join(self, count=3, group_id=None):
        group = db.session.get(SantaGroup, group_id or self.group_id)
        for i in range(count):
            response = self.client.post(f'/api/groups/{group.code}/participants', json={
                'name': f'Ion {i}', 'email': f'ion{i}@example.com', 'wishlist': 'șosete',
            })
            self.assertEqual(response.status_code, 201)

    def draw_and_deliver(self, results):
        self.assertEqual(self.client.post('/api/admin/draw', headers=self.headers).status_code, 200)
        with patch(SEND, side_effect=results):
            while deliver_one():
                pass
        db.session.remove()

    def assert_erased(self, group_id=None):
        group = db.session.get(SantaGroup, group_id or self.group_id)
        self.assertIsNotNone(group.personal_data_erased_at)
        self.assertEqual(group.name, ERASED_GROUP_NAME)
        for field in ('smtp_email', 'smtp_username', 'smtp_password', 'smtp_host', 'smtp_port'):
            self.assertIsNone(getattr(group, field), field)
        participants = Participant.query.filter_by(group_id=group.id).all()
        self.assertTrue(participants)
        for p in participants:
            self.assertEqual((p.name, p.email, p.wishlist, p.assigned_to_id), (None, None, None, None))

    def test_everything_personal_is_erased_after_the_last_email(self):
        self.join(3)
        stats_before = self.client.get('/api/stats').json
        self.draw_and_deliver([True, True, True])
        self.assert_erased()
        self.assertEqual(EmailDelivery.query.filter_by(status='sent').count(), 3)
        # Nimic personal în baza de date, sub nicio formă.
        dump = repr([(p.name, p.email, p.wishlist) for p in Participant.query.all()])
        self.assertNotIn('Ion', dump)
        self.assertNotIn('example.com', dump)
        # Statisticile publice nu se schimbă.
        stats_after = self.client.get('/api/stats').json
        for key in ('total_participants', 'groups_with_email', 'drawn_groups', 'group_size_distribution'):
            self.assertEqual(stats_after[key], stats_before[key] if key != 'drawn_groups' else 1, key)

    def test_data_stays_while_an_email_failed(self):
        self.join(3)
        self.draw_and_deliver([True, False, True])
        group = db.session.get(SantaGroup, self.group_id)
        self.assertIsNone(group.personal_data_erased_at)
        self.assertEqual(group.name, 'Familia Popescu')
        self.assertIsNotNone(group.smtp_password)
        self.assertEqual(Participant.query.filter(Participant.email.isnot(None)).count(), 3)
        # Organizatorul retrimite; abia acum se șterge totul.
        self.assertEqual(self.client.post('/api/admin/resend', headers=self.headers, json={}).status_code, 200)
        with patch(SEND, return_value=True):
            while deliver_one():
                pass
        db.session.remove()
        self.assert_erased()

    def test_erased_group_is_closed(self):
        self.join(3)
        self.draw_and_deliver([True, True, True])
        self.assertEqual(self.client.get('/api/admin', headers=self.headers).status_code, 410)
        self.assertEqual(self.client.post('/api/admin/resend', headers=self.headers, json={}).status_code, 410)
        self.assertEqual(self.client.post('/api/admin/draw', headers=self.headers).status_code, 410)
        code = db.session.get(SantaGroup, self.group_id).code
        response = self.client.post(f'/api/groups/{code}/participants', json={'name': 'Nou', 'email': 'nou@example.com'})
        self.assertEqual(response.status_code, 400)

    def test_old_seasons_are_purged_on_february_first(self):
        self.join(2)  # grup nefinalizat, creat acum
        old_id, _ = self.create_group('Grup vechi')
        self.join(2, group_id=old_id)
        db.session.get(SantaGroup, old_id).created_at = datetime(2025, 12, 1)
        db.session.commit()

        self.assertEqual(purge_personal_data(now=datetime(2026, 1, 31, 23, 0)), 0)
        self.assertEqual(purge_personal_data(now=datetime(2026, 2, 1, 0, 30)), 1)
        db.session.remove()
        self.assert_erased(old_id)
        self.assertIsNone(db.session.get(SantaGroup, self.group_id).personal_data_erased_at)

    def test_season_cutoff(self):
        self.assertEqual(season_cutoff(datetime(2026, 12, 20)), datetime(2026, 2, 1))
        self.assertEqual(season_cutoff(datetime(2027, 1, 15)), datetime(2026, 2, 1))
        self.assertEqual(season_cutoff(datetime(2027, 2, 1)), datetime(2027, 2, 1))

    def test_groups_finished_before_the_update_are_cleaned(self):
        # Ca înainte de actualizare: totul trimis, parola ștearsă, dar numele încă acolo.
        self.join(2)
        group = db.session.get(SantaGroup, self.group_id)
        group.is_drawn, group.smtp_password = True, None
        for p in Participant.query.all():
            p.email_sent = True
        db.session.commit()
        self.assertEqual(purge_personal_data(), 1)
        db.session.remove()
        self.assert_erased()


    def test_finished_group_without_stored_organizer_email_is_cleaned(self):
        # Ca grupul real din baza locală: mailuri trimise, dar smtp_email deja gol și used_email fals.
        self.join(2)
        self.draw_and_deliver([True, True])
        group = db.session.get(SantaGroup, self.group_id)
        group.personal_data_erased_at = None
        group.smtp_email, group.used_email, group.name = None, False, 'Grup vechi'
        participants = Participant.query.order_by(Participant.id).all()
        for p, other in zip(participants, reversed(participants)):
            p.name, p.email, p.assigned_to_id = 'Ion', f'ion{p.id}@example.com', other.id
        db.session.commit()
        self.assertEqual(purge_personal_data(), 1)
        db.session.remove()
        self.assert_erased()


if __name__ == '__main__':
    unittest.main()
