"""Regresii pentru selectarea SMTP; fără conexiuni sau emailuri reale."""
import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ['DATABASE_URL'] = os.environ.get('TEST_DATABASE_URL', 'sqlite://')
os.environ['SECRET_KEY'] = 'isolated-email-setup-test-key'
os.environ['RATELIMIT_ENABLED'] = '0'
os.environ['FLASK_DEBUG'] = '0'

from app import create_app, db
from app.models import SantaGroup
from app.security import decrypt_secret
from app.services.email_service import SMTP_SELECTIONS, _detect_smtp


class EmailSetupTests(unittest.TestCase):
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
        self.sender = patch('app.routes.EmailService.send_admin_link', return_value=True)
        self.mock_sender = self.sender.start()

    def tearDown(self):
        self.sender.stop()
        db.session.remove()
        self.context.pop()

    def create(self, **fields):
        return self.client.post('/api/groups', json={
            'name': 'Test', 'smtp_email': 'organizer@company.example',
            'smtp_password': 'app-password-for-test', **fields,
            'smtp_username': 'smtp-login@example.com',
        })

    def test_provider_with_company_domain_persists_correct_smtp(self):
        for provider, (host, port) in SMTP_SELECTIONS.items():
            with self.subTest(provider=provider):
                response = self.create(smtp_provider=provider, smtp_host='ignored.example', smtp_port=25)
                self.assertEqual(response.status_code, 201)
                group = db.session.get(SantaGroup, response.json['id'])
                self.assertEqual(_detect_smtp(group.smtp_email, group), (host, port, False))
                self.assertEqual(decrypt_secret(group.smtp_password), 'app-password-for-test')
                self.assertNotIn('smtp_password', response.json)

    def test_unsupported_and_malformed_providers_are_validation_errors(self):
        for provider in ('outlook', 'proton', 'custom', 'brevo', 'icloud', 'zoho', 'unknown', [], {}, 12):
            with self.subTest(provider=provider):
                self.assertEqual(self.create(smtp_provider=provider).status_code, 400)
        self.mock_sender.assert_not_called()

    def test_client_cannot_choose_smtp_host(self):
        # Protecția SSRF: hostul vine doar din lista serverului.
        response = self.create(smtp_provider='gmail', smtp_host='127.0.0.1', smtp_port=5432)
        self.assertEqual(response.status_code, 201)
        group = db.session.get(SantaGroup, response.json['id'])
        self.assertEqual((group.smtp_host, group.smtp_port), ('smtp.gmail.com', 587))

    def test_provider_requires_email(self):
        self.assertEqual(self.create(smtp_provider='gmail', smtp_email=None).status_code, 400)

    def test_blocked_ports_are_visible_and_enforced(self):
        with patch.dict(self.app.config, {'SMTP_BLOCKED_PORTS': {25, 465, 587}}):
            config = self.client.get('/api/config')
            self.assertEqual(config.status_code, 200)
            self.assertEqual(sorted(config.json['unavailable_providers']), ['gmail', 'yahoo'])
            self.assertEqual(self.create(smtp_provider='gmail').status_code, 400)
            self.assertEqual(self.create(smtp_provider='yahoo').status_code, 400)

    def test_health_and_unknown_api(self):
        self.assertEqual(self.client.get('/health').json, {'status': 'ok'})
        self.assertEqual(self.client.get('/api/does-not-exist').status_code, 404)

    def test_email_is_mandatory(self):
        self.assertEqual(self.create(smtp_email='organizer@gmail.com').status_code, 400)
        response = self.client.post('/api/groups', json={'name': 'Without email'})
        self.assertEqual(response.status_code, 400)
        self.assertIn('Gmail sau Yahoo', response.json['error'])

if __name__ == '__main__':
    unittest.main()
