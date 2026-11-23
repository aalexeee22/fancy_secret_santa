"""Ștergerea datelor personale când nu mai sunt necesare.

Un grup e anonimizat:
- imediat după ce ultimul mail cu perechea a plecat cu succes;
- din 1 februarie, dacă a fost creat într-un sezon de Crăciun trecut (plasă de siguranță
  pentru grupurile care nu termină niciodată, de exemplu cu un mail eșuat).

Rândurile rămân, ca statisticile să fie corecte, dar fără nume, emailuri, wishlist-uri și perechi.
"""
from datetime import datetime, timezone

from flask import current_app

from ..models import db, Participant, SantaGroup

ERASED_GROUP_NAME = 'Secret Santa'


def utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def season_cutoff(now):
    """Grupurile create înainte de data asta aparțin unui sezon încheiat (după 31 ianuarie)."""
    february = datetime(now.year, 2, 1)
    return february if now >= february else datetime(now.year - 1, 2, 1)


def all_emails_sent(group):
    # Nu depinde de used_email/smtp_email: contează doar că fiecare participant și-a primit mailul.
    if not group.is_drawn:
        return False
    unsent = Participant.query.filter_by(group_id=group.id, email_sent=False).count()
    return unsent == 0 and Participant.query.filter_by(group_id=group.id).count() > 0


def erase_personal_data(group, now=None):
    """Apelantul deține blocarea grupului și face commit."""
    Participant.query.filter_by(group_id=group.id).update({
        'name': None,
        'email': None,
        'wishlist': None,
        'assigned_to_id': None,
    }, synchronize_session=False)
    group.name = ERASED_GROUP_NAME
    group.smtp_email = None
    group.smtp_username = None
    group.smtp_password = None
    group.smtp_host = None
    group.smtp_port = None
    group.language = None
    group.personal_data_erased_at = now or utcnow()
    current_app.logger.info('Datele personale ale grupului %s au fost șterse.', group.id)


def purge_personal_data(now=None):
    """Grupurile terminate sau din sezoanele trecute. Întoarce câte grupuri a curățat."""
    now = now or utcnow()
    cutoff = season_cutoff(now)
    candidate_ids = [gid for (gid,) in db.session.query(SantaGroup.id).filter(
        SantaGroup.personal_data_erased_at.is_(None),
        (SantaGroup.created_at < cutoff) | SantaGroup.is_drawn.is_(True),
    ).all()]
    db.session.rollback()
    erased = 0
    for group_id in candidate_ids:
        # Aceeași blocare ca workerul de email: nu curățăm un grup în mijlocul unei livrări.
        group = SantaGroup.query.filter_by(id=group_id).with_for_update().first()
        if group and group.personal_data_erased_at is None and (
            (group.created_at and group.created_at < cutoff) or all_emails_sent(group)
        ):
            erase_personal_data(group, now)
            erased += 1
        db.session.commit()
    return erased
