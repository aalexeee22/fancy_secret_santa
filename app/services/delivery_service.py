"""Livrare SMTP în afara cererilor web, cu progres salvat pentru fiecare email."""
import secrets
import os
import tempfile
from pathlib import Path
from datetime import datetime, timedelta, timezone

from ..models import db, EmailDelivery, Participant, SantaGroup
from .email_service import EmailService, DeliveryUncertain


def utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def wakeup_path():
    return Path(os.environ.get('EMAIL_WAKEUP_FILE', os.path.join(tempfile.gettempdir(), 'secret-santa-email-wakeup')))


def notify_worker():
    # Semnal local, fără să ținem baza Neon activă prin polling la fiecare 2 secunde.
    try:
        wakeup_path().touch()
    except OSError:
        # Coada rămâne durabilă; scanarea periodică o va descoperi.
        pass


def enqueue_assignments(group, retry_uncertain=False):
    """Apelantul deține blocarea grupului; nu retrimitem emailuri confirmate."""
    existing = {job.participant_id: job for job in EmailDelivery.query.filter_by(group_id=group.id)}
    for participant in group.participants:
        if participant.email_sent:
            continue
        job = existing.get(participant.id)
        if job is None:
            db.session.add(EmailDelivery(group_id=group.id, participant_id=participant.id, status='pending'))
        elif job.status == 'failed' or (job.status == 'uncertain' and retry_uncertain):
            job.status = 'pending'
            job.attempt_token = None
    # Commitul este făcut de apelant împreună cu tragerea la sorți.


def expire_stale_deliveries():
    # O încercare întreruptă ar fi putut fi acceptată de SMTP. Nu o reluăm automat.
    count = EmailDelivery.query.filter(
        EmailDelivery.status == 'sending',
        EmailDelivery.attempted_at < utcnow() - timedelta(minutes=10),
    ).update({'status': 'uncertain'}, synchronize_session=False)
    db.session.commit()
    return count


def deliver_one():
    """Claim atomic pentru mai mulți workeri. Nicio blocare DB în timpul SMTP."""
    candidate = EmailDelivery.query.filter_by(status='pending').order_by(EmailDelivery.id).with_for_update(skip_locked=True).first()
    if candidate is None:
        db.session.rollback()
        return False
    job_id, group_id, participant_id = candidate.id, candidate.group_id, candidate.participant_id
    token = secrets.token_hex(16)
    # Condiția protejează claimul inclusiv pe SQLite, unde FOR UPDATE nu există.
    claimed = EmailDelivery.query.filter_by(id=job_id, status='pending').update({
        'status': 'sending', 'attempt_token': token, 'attempted_at': utcnow(),
    }, synchronize_session=False)
    db.session.commit()
    if not claimed:
        return True
    group = db.session.get(SantaGroup, group_id)
    giver = db.session.get(Participant, participant_id)
    # Încărcăm datele și închidem tranzacția de citire înainte de rețea.
    receiver = giver.assigned_to
    for entity in (group, giver, receiver):
        if entity is not None:
            db.session.expunge(entity)
    db.session.rollback()
    try:
        status = 'sent' if receiver and EmailService.send_assignment(giver, receiver, group) else 'failed'
    except DeliveryUncertain:
        status = 'uncertain'
    except Exception:
        # Și o eroare neașteptată poate surveni după acceptarea mesajului.
        status = 'uncertain'

    # Aceeași ordine a blocărilor ca în rutele de admin: grup, apoi livrare.
    locked_group = SantaGroup.query.filter_by(id=group_id).with_for_update().one()
    job = EmailDelivery.query.filter_by(id=job_id).with_for_update().one()
    if job.status == 'sending' and job.attempt_token == token:
        job.status = status
        if status == 'sent':
            db.session.get(Participant, participant_id).email_sent = True
        db.session.flush()
        remaining = Participant.query.filter_by(group_id=group_id, email_sent=False).count()
        if remaining == 0:
            locked_group.smtp_password = None
    db.session.commit()
    return True
