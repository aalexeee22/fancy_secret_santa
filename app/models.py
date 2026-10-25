from datetime import datetime
from . import db
import secrets
import string


def generate_code():
    alphabet = string.ascii_uppercase + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(8))


def generate_admin_code():
    return secrets.token_urlsafe(24)


class SantaGroup(db.Model):
    __tablename__ = 'santa_groups'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    code = db.Column(db.String(8), unique=True, nullable=False, default=generate_code)
    admin_code = db.Column(db.String(64), unique=True, nullable=False, default=generate_admin_code)
    min_budget_ron = db.Column(db.Float, nullable=True)  # opțional
    is_drawn = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    smtp_email = db.Column(db.String(200), nullable=True)
    smtp_username = db.Column(db.String(200), nullable=True)
    # Criptată (Fernet); ștearsă după ce toate emailurile au plecat.
    smtp_password = db.Column(db.Text, nullable=True)
    smtp_host = db.Column(db.String(200), nullable=True)
    smtp_port = db.Column(db.Integer, nullable=True)
    participants = db.relationship(
        'Participant',
        backref='group',
        lazy=True,
        foreign_keys='Participant.group_id',
        order_by='Participant.id',
    )

    @property
    def admin_link_expired(self):
        # După tragere, linkul rămâne valid doar cât mai sunt emailuri de retrimis.
        return bool(self.is_drawn and not self.smtp_password)


class Participant(db.Model):
    __tablename__ = 'participants'
    __table_args__ = (
        db.UniqueConstraint('group_id', 'email', name='uq_participant_group_email'),
    )
    id = db.Column(db.Integer, primary_key=True)
    group_id = db.Column(db.Integer, db.ForeignKey('santa_groups.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(200), nullable=False)
    wishlist = db.Column(db.Text, nullable=True)
    assigned_to_id = db.Column(db.Integer, db.ForeignKey('participants.id'), nullable=True)
    assigned_to = db.relationship(
        'Participant',
        foreign_keys=[assigned_to_id],
        remote_side='Participant.id',
        # Perechile formează cercuri (A→B→A); fără asta SQLAlchemy nu știe în ce ordine să salveze.
        post_update=True,
    )
    email_sent = db.Column(db.Boolean, nullable=False, default=False)
    joined_at = db.Column(db.DateTime, default=datetime.utcnow)


class EmailDelivery(db.Model):
    """Coada durabilă: o singură înregistrare pentru fiecare participant."""
    __tablename__ = 'email_deliveries'
    id = db.Column(db.Integer, primary_key=True)
    participant_id = db.Column(db.Integer, db.ForeignKey('participants.id'), nullable=False, unique=True)
    group_id = db.Column(db.Integer, db.ForeignKey('santa_groups.id'), nullable=False, index=True)
    status = db.Column(db.String(16), nullable=False, default='pending', index=True)
    attempted_at = db.Column(db.DateTime, nullable=True)
    attempt_token = db.Column(db.String(32), nullable=True)
