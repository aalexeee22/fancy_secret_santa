"""Validări de input, criptarea parolei SMTP și verificarea serverului SMTP."""
import base64
import hashlib
import ipaddress
import math
import re
import socket

from cryptography.fernet import Fernet, InvalidToken
from flask import current_app, request

from .i18n import t


class ValidationError(ValueError):
    """Input invalid de la utilizator; devine un răspuns 400 cu mesajul în limba cererii.

    Primește cheia mesajului din app/i18n.py, nu textul, ca să poată fi tradus.
    """

    def __init__(self, key, **params):
        super().__init__(key)
        self.key = key
        self.params = params

    def __str__(self):
        return t(self.key, **self.params)


MAX_LENGTHS = {
    'group_name': 100,
    'name': 100,
    'email': 200,
    'wishlist': 2000,
    'smtp_host': 200,
    'smtp_password': 200,
    'nickname': 20,
}

MAX_BUDGET_RON = 100_000
MAX_PARTICIPANTS = 100

# Porturi de email, pentru grupurile vechi create cu „SMTP custom”.
ALLOWED_SMTP_PORTS = {25, 465, 587, 2525, 1025}

_EMAIL_RE = re.compile(r'^[^@\s]+@[^@\s]+\.[^@\s]+$')
_CONTROL_CHARS_RE = re.compile(r'[\x00-\x1f\x7f]')


def json_body():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        raise ValidationError('invalid_request')
    return data


def clean_text(value, field, label=None, required=True, multiline=False):
    """`label` e câmpul afișat în mesajul de eroare, dacă diferă de cel după care se ia lungimea maximă."""
    label = label or field
    if value is None:
        value = ''
    if not isinstance(value, str):
        raise ValidationError('field_not_text', field=label)
    value = value.strip()
    if required and not value:
        raise ValidationError('field_required', field=label)
    if len(value) > MAX_LENGTHS[field]:
        raise ValidationError('field_too_long', field=label, max=MAX_LENGTHS[field])
    checked = re.sub(r'[\r\n\t]', '', value) if multiline else value
    if _CONTROL_CHARS_RE.search(checked):
        raise ValidationError('field_bad_chars', field=label)
    return value


def clean_email(value, label='email'):
    email = clean_text(value, 'email', label).lower()
    if not _EMAIL_RE.match(email):
        raise ValidationError('email_invalid', field=label)
    return email


def clean_budget(value):
    """Bugetul e opțional: gol înseamnă fără buget (None)."""
    if value is None or (isinstance(value, str) and not value.strip()):
        return None
    try:
        budget = float(value)
    except (TypeError, ValueError):
        raise ValidationError('budget_not_number')
    if not math.isfinite(budget) or budget <= 0 or budget > MAX_BUDGET_RON:
        raise ValidationError('budget_range')
    return budget


def check_smtp_target(host, port):
    """Refuză porturile care nu sunt de email și adresele din rețeaua internă.

    Folosit doar pentru grupurile vechi „SMTP custom”. Localhost e permis,
    dar tot doar pe porturi de email, deci nu se poate ajunge la Postgres etc.
    """
    if port not in ALLOWED_SMTP_PORTS:
        ports = ', '.join(str(p) for p in sorted(ALLOWED_SMTP_PORTS))
        raise ValidationError('smtp_port_invalid', ports=ports)
    try:
        infos = socket.getaddrinfo(host, port, proto=socket.IPPROTO_TCP)
    except (socket.gaierror, UnicodeError):
        raise ValidationError('smtp_not_found')
    for info in infos:
        ip = ipaddress.ip_address(info[4][0])
        if ip.is_loopback:
            continue
        if ip.is_private or ip.is_link_local or ip.is_reserved or ip.is_multicast or ip.is_unspecified:
            raise ValidationError('smtp_internal')


def is_loopback_host(host):
    try:
        return all(ipaddress.ip_address(i[4][0]).is_loopback for i in socket.getaddrinfo(host, None))
    except (socket.gaierror, UnicodeError, ValueError):
        return False


def _fernet():
    key = hashlib.sha256(('smtp-password:' + current_app.config['SECRET_KEY']).encode()).digest()
    return Fernet(base64.urlsafe_b64encode(key))


def encrypt_secret(plain):
    return _fernet().encrypt(plain.encode()).decode()


def decrypt_secret(token):
    """None dacă tokenul nu poate fi decriptat (ex. SECRET_KEY schimbat)."""
    try:
        return _fernet().decrypt(token.encode()).decode()
    except (InvalidToken, AttributeError):
        return None
