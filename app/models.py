from datetime import datetime
from sqlalchemy.dialects.postgresql import JSONB
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
    # Limba organizatorului, pentru emailul cu linkul de admin.
    language = db.Column(db.String(5), nullable=True)
    # Păstrat și după ștergerea emailului organizatorului, pentru statistici.
    used_email = db.Column(db.Boolean, nullable=True, default=False)
    # Setat când numele, emailurile și perechile au fost șterse; grupul e apoi închis.
    personal_data_erased_at = db.Column(db.DateTime, nullable=True)
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
        return bool(self.personal_data_erased_at or (self.is_drawn and not self.smtp_password))


class Participant(db.Model):
    __tablename__ = 'participants'
    __table_args__ = (
        db.UniqueConstraint('group_id', 'email', name='uq_participant_group_email'),
    )
    id = db.Column(db.Integer, primary_key=True)
    group_id = db.Column(db.Integer, db.ForeignKey('santa_groups.id'), nullable=False)
    # Goale după ce grupul și-a primit toate mailurile (vezi services/privacy_service.py).
    name = db.Column(db.String(100), nullable=True)
    email = db.Column(db.String(200), nullable=True)
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
    # Limba în care s-a înscris: emailul cu perechea vine în aceeași limbă.
    language = db.Column(db.String(5), nullable=True)
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


class AdventMovie(db.Model):
    """Filmul din spatele unei ușițe de advent. Ziua 26 e ușița bonus."""
    __tablename__ = 'advent_movies'
    day = db.Column(db.Integer, primary_key=True, autoincrement=False)
    # Informațiile filmului, exact ca în JSON-ul de import (titlu, linkuri).
    info = db.Column(db.JSON().with_variant(JSONB(), 'postgresql'), nullable=False)
    poster = db.Column(db.LargeBinary, nullable=True)
    poster_type = db.Column(db.String(32), nullable=True)


# --- Dirty Santa: jocuri temporare, fără conturi; se șterg singure (vezi services/dirty_cleanup.py) ---

# Fără 0/O și 1/I/L, ca să nu poată fi confundate la citit de pe ecran.
DIRTY_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
DIRTY_CODE_LENGTH = 6


def generate_dirty_code():
    return ''.join(secrets.choice(DIRTY_CODE_ALPHABET) for _ in range(DIRTY_CODE_LENGTH))


class DirtyGame(db.Model):
    __tablename__ = 'dirty_games'
    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(DIRTY_CODE_LENGTH), unique=True, nullable=False, default=generate_dirty_code)
    # Doar hash-ul: tokenul în sine stă numai pe ecranul organizatorului.
    host_token_hash = db.Column(db.String(64), unique=True, nullable=False)
    status = db.Column(db.String(16), nullable=False, default='lobby')  # lobby / playing / finished
    steal_limit = db.Column(db.Integer, nullable=False, default=3)
    final_round = db.Column(db.Boolean, nullable=False, default=True)
    budget = db.Column(db.Float, nullable=True)  # doar afișat
    # Crește la orice schimbare; telefoanele întreabă „s-a schimbat ceva după versiunea X?”.
    version = db.Column(db.Integer, nullable=False, default=1)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    started_at = db.Column(db.DateTime, nullable=True)
    finished_at = db.Column(db.DateTime, nullable=True)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False, index=True)


class DirtyPlayer(db.Model):
    __tablename__ = 'dirty_players'
    id = db.Column(db.Integer, primary_key=True)
    game_id = db.Column(db.Integer, db.ForeignKey('dirty_games.id'), nullable=False, index=True)
    nickname = db.Column(db.String(20), nullable=False)
    token_hash = db.Column(db.String(64), unique=True, nullable=False)
    turn_order = db.Column(db.Integer, nullable=True)  # setată la start
    # Adăugat de organizator, fără telefon: joacă organizatorul în locul lui, de pe ecranul mare.
    added_by_host = db.Column(db.Boolean, default=False, nullable=True)
    joined_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)


class DirtyMove(db.Model):
    __tablename__ = 'dirty_moves'
    __table_args__ = (db.UniqueConstraint('game_id', 'seq', name='uq_dirty_move_seq'),)
    id = db.Column(db.Integer, primary_key=True)
    game_id = db.Column(db.Integer, db.ForeignKey('dirty_games.id'), nullable=False, index=True)
    seq = db.Column(db.Integer, nullable=False)
    kind = db.Column(db.String(16), nullable=False)  # open / steal / final_swap / keep
    actor_id = db.Column(db.Integer, db.ForeignKey('dirty_players.id'), nullable=False)
    target_seq = db.Column(db.Integer, nullable=True)  # cadoul luat = seq-ul mutării open
    by_host = db.Column(db.Boolean, nullable=False, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
