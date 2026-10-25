"""Teste izolate: coadă durabilă, opriri, retrimiteri și confirmări SMTP."""
import os
import sys
import smtplib
import unittest
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ['DATABASE_URL'] = os.environ.get('TEST_DATABASE_URL', 'sqlite://')
os.environ['SECRET_KEY'] = 'isolated-email-setup-test-key'
os.environ['RATELIMIT_ENABLED'] = '0'
os.environ['FLASK_DEBUG'] = '0'

from app import create_app, db
from app.models import EmailDelivery, SantaGroup, Participant
from app.security import encrypt_secret
from app.services.delivery_service import deliver_one, expire_stale_deliveries, utcnow
from app.services.email_service import _send, DeliveryUncertain


class DeliveryQueueTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = create_app()

    @classmethod
    def tearDownClass(cls):
        with cls.app.app_context():
            db.session.remove()
            db.engine.dispose()

    def setUp(self):
        self.context = self.app.app_context()
        self.context.push()
        db.drop_all()
        db.create_all()
        self.client = self.app.test_client()
        with patch('app.routes.EmailService.send_admin_link', return_value=True):
            response = self.client.post('/api/groups', json={
                'name': 'Queue test', 'smtp_provider': 'gmail',
                'smtp_email': 'org@gmail.com', 'smtp_password': 'test-password',
            })
        self.group_id = response.json['id']
        self.headers = {'X-Admin-Code': response.json['admin_code']}

    def tearDown(self):
        db.session.remove()
        self.context.pop()

    def add_participants(self, count=3):
        db.session.add_all([Participant(group_id=self.group_id, name=f'P{i}', email=f'p{i}@example.com') for i in range(count)])
        db.session.commit()

    def draw(self):
        return self.client.post('/api/admin/draw', headers=self.headers)

    def resend(self, **body):
        return self.client.post('/api/admin/resend', headers=self.headers, json=body)

    def test_hundred_participants_are_queued_without_smtp_in_web_request(self):
        self.add_participants(100)
        with patch('app.services.delivery_service.EmailService.send_assignment') as sender:
            response = self.draw()
            sender.assert_not_called()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json['emails_pending'], 100)
        self.assertEqual(response.json['failed_emails'], [])
        self.assertEqual(EmailDelivery.query.count(), 100)
        self.assertEqual(self.draw().status_code, 409)
        for participant in Participant.query.all():
            self.assertNotEqual(participant.id, participant.assigned_to_id)

    def test_draw_and_queue_are_atomic(self):
        self.add_participants()
        with self.assertLogs(self.app.logger, level='ERROR'), patch('app.routes.enqueue_assignments', side_effect=RuntimeError('queue failure')):
            self.assertEqual(self.draw().status_code, 500)
        db.session.rollback()
        self.assertFalse(db.session.get(SantaGroup, self.group_id).is_drawn)
        self.assertTrue(all(p.assigned_to_id is None for p in Participant.query.all()))

    def test_partial_progress_survives_and_confirmed_messages_are_not_retried(self):
        self.add_participants()
        self.draw()
        with patch('app.services.delivery_service.EmailService.send_assignment', return_value=True) as sender:
            self.assertTrue(deliver_one())
            db.session.remove()
            self.assertEqual(Participant.query.filter_by(email_sent=True).count(), 1)
            response = self.resend()
            self.assertEqual(response.json['emails_pending'], 2)
            self.assertTrue(deliver_one())
            self.assertTrue(deliver_one())
            self.assertFalse(deliver_one())
            self.assertEqual(sender.call_count, 3)
        self.assertIsNone(db.session.get(SantaGroup, self.group_id).smtp_password)
        self.assertEqual(self.client.get('/api/admin', headers=self.headers).status_code, 410)

    def test_crash_after_claim_needs_explicit_confirmation_before_retry(self):
        self.add_participants(2)
        self.draw()
        with patch('app.services.delivery_service.EmailService.send_assignment', side_effect=SystemExit()):
            with self.assertRaises(SystemExit):
                deliver_one()
        job = EmailDelivery.query.filter_by(status='sending').one()
        job.attempted_at = utcnow() - timedelta(minutes=11)
        db.session.commit()
        self.assertEqual(expire_stale_deliveries(), 1)
        self.resend()
        self.assertEqual(EmailDelivery.query.filter_by(status='uncertain').count(), 1)
        response = self.resend(retry_uncertain=True)
        self.assertEqual(response.json['emails_pending'], 2)
        self.assertEqual(EmailDelivery.query.filter_by(status='uncertain').count(), 0)

    def test_known_failures_can_be_retried_without_resetting_sent_messages(self):
        self.add_participants(2)
        self.draw()
        with patch('app.services.delivery_service.EmailService.send_assignment', side_effect=[False, True]):
            deliver_one()
            deliver_one()
        self.assertEqual(EmailDelivery.query.filter_by(status='failed').count(), 1)
        self.assertEqual(self.resend().json['emails_pending'], 1)
        with patch('app.services.delivery_service.EmailService.send_assignment', return_value=True) as sender:
            deliver_one()
            self.assertEqual(sender.call_count, 1)
        self.assertEqual(Participant.query.filter_by(email_sent=True).count(), 2)

    def test_unknown_smtp_outcome_is_not_auto_retried(self):
        self.add_participants(2)
        self.draw()
        with patch('app.services.delivery_service.EmailService.send_assignment', side_effect=DeliveryUncertain()):
            deliver_one()
        self.assertEqual(EmailDelivery.query.filter_by(status='uncertain').count(), 1)
        self.assertEqual(len(self.resend().json['uncertain_emails']), 1)

    def test_empty_queue_is_idle(self):
        self.assertFalse(deliver_one())

    def test_smtp_quit_failure_does_not_invalidate_accepted_email(self):
        with patch('app.services.email_service.is_loopback_host', return_value=False), patch('app.services.email_service.smtplib.SMTP') as smtp:
            smtp.return_value.__exit__.side_effect = OSError('quit disconnected')
            group = SimpleNamespace(id=1, smtp_email='org@gmail.com', smtp_password=encrypt_secret('test'), smtp_host=None, smtp_port=None)
            self.assertTrue(_send(group, 'recipient@example.com', 'Subject', 'Body'))

    def test_smtp_timeout_during_submission_is_uncertain(self):
        with patch('app.services.email_service.is_loopback_host', return_value=False), patch('app.services.email_service.smtplib.SMTP') as smtp:
            smtp.return_value.__enter__.return_value.sendmail.side_effect = TimeoutError()
            group = SimpleNamespace(id=1, smtp_email='org@gmail.com', smtp_password=encrypt_secret('test'), smtp_host=None, smtp_port=None)
            with self.assertRaises(DeliveryUncertain):
                _send(group, 'recipient@example.com', 'Subject', 'Body')

    def test_smtp_explicit_rejection_is_a_known_failure(self):
        with patch('app.services.email_service.is_loopback_host', return_value=False), patch('app.services.email_service.smtplib.SMTP') as smtp:
            smtp.return_value.__enter__.return_value.sendmail.side_effect = smtplib.SMTPDataError(550, b'rejected')
            group = SimpleNamespace(id=1, smtp_email='org@gmail.com', smtp_password=encrypt_secret('test'), smtp_host=None, smtp_port=None)
            self.assertFalse(_send(group, 'recipient@example.com', 'Subject', 'Body'))

    def test_custom_smtp_login_is_used_without_changing_sender(self):
        with patch('app.services.email_service.is_loopback_host', return_value=False), patch('app.services.email_service.smtplib.SMTP') as smtp:
            group = SimpleNamespace(id=1, smtp_email='org@gmail.com', smtp_username='technical-login@example.com', smtp_password=encrypt_secret('test'), smtp_host=None, smtp_port=None)
            self.assertTrue(_send(group, 'recipient@example.com', 'Subject', 'Body'))
            server = smtp.return_value.__enter__.return_value
            server.login.assert_called_once_with('technical-login@example.com', 'test')
            self.assertEqual(server.sendmail.call_args.args[0], 'org@gmail.com')

    def test_concurrent_workers_claim_each_participant_once(self):
        if db.engine.dialect.name != 'postgresql':
            self.skipTest('Blocările concurente sunt verificate pe Postgres.')
        self.add_participants(100)
        self.draw()
        db.session.remove()
        sent = []
        guard = threading.Lock()

        def sender(giver, receiver, group):
            with guard:
                sent.append(giver.id)
            time.sleep(0.005)
            return True

        def drain():
            with self.app.app_context():
                while deliver_one():
                    pass
                db.session.remove()

        with patch('app.services.delivery_service.EmailService.send_assignment', side_effect=sender):
            with ThreadPoolExecutor(max_workers=4) as pool:
                list(pool.map(lambda _: drain(), range(4)))
        self.assertEqual(len(sent), 100)
        self.assertEqual(len(set(sent)), 100)
        self.assertEqual(Participant.query.filter_by(email_sent=True).count(), 100)
        self.assertIsNone(db.session.get(SantaGroup, self.group_id).smtp_password)

    def test_simultaneous_draw_requests_create_one_draw_and_one_queue(self):
        if db.engine.dialect.name != 'postgresql':
            self.skipTest('Blocările concurente sunt verificate pe Postgres.')
        self.add_participants(10)
        db.session.remove()

        def draw_request(_):
            with self.app.test_client() as client:
                return client.post('/api/admin/draw', headers=self.headers).status_code

        with ThreadPoolExecutor(max_workers=2) as pool:
            statuses = list(pool.map(draw_request, range(2)))
        self.assertEqual(sorted(statuses), [200, 409])
        self.assertEqual(EmailDelivery.query.count(), 10)


if __name__ == '__main__':
    unittest.main()
