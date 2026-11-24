"""Jocurile Dirty Santa sunt temporare: după petrecere nu mai rămâne nimic.

- un joc terminat se șterge la 24 de ore după final;
- un joc abandonat (în lobby sau în desfășurare) se șterge după 48 de ore fără nicio activitate.
"""
from datetime import datetime, timedelta, timezone

from flask import current_app

from ..models import DirtyGame, DirtyMove, DirtyPlayer, db

FINISHED_TTL = timedelta(hours=24)
ABANDONED_TTL = timedelta(hours=48)


def utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def purge_dirty_games(now=None):
    """Șterge complet jocurile expirate. Întoarce câte jocuri a șters."""
    now = now or utcnow()
    expired = [gid for (gid,) in db.session.query(DirtyGame.id).filter(
        ((DirtyGame.status == 'finished') & (DirtyGame.finished_at < now - FINISHED_TTL))
        | (DirtyGame.updated_at < now - ABANDONED_TTL)
    ).all()]
    if not expired:
        db.session.rollback()
        return 0
    DirtyMove.query.filter(DirtyMove.game_id.in_(expired)).delete(synchronize_session=False)
    DirtyPlayer.query.filter(DirtyPlayer.game_id.in_(expired)).delete(synchronize_session=False)
    DirtyGame.query.filter(DirtyGame.id.in_(expired)).delete(synchronize_session=False)
    db.session.commit()
    current_app.logger.info('Am șters %s jocuri Dirty Santa expirate.', len(expired))
    return len(expired)
