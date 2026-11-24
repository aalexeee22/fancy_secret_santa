"""Proces separat: python email_worker.py. Folosește aceeași bază și SECRET_KEY."""
import signal
import threading
import time

from app import create_app, db
from app.services.delivery_service import deliver_one, expire_stale_deliveries, wakeup_path
from app.services.privacy_service import purge_personal_data
from app.services.dirty_cleanup import purge_dirty_games


def main():
    app = create_app()
    stopping = threading.Event()
    for sig in (signal.SIGINT, signal.SIGTERM):
        signal.signal(sig, lambda *_: stopping.set())
    last_signal = None
    next_scan = 0
    draining = True
    while not stopping.is_set():
        try:
            signature = wakeup_path().stat().st_mtime_ns
        except FileNotFoundError:
            signature = 0
        now = time.monotonic()
        if not draining and signature == last_signal and now < next_scan:
            stopping.wait(2)
            continue
        last_signal = signature
        worked = False
        with app.app_context():
            try:
                if now >= next_scan:
                    expire_stale_deliveries()
                    purge_personal_data()
                    purge_dirty_games()
                    next_scan = now + 900
                worked = deliver_one()
            except Exception:
                db.session.rollback()
                app.logger.exception('Workerul de email va reîncerca accesul la coadă.')
            finally:
                db.session.remove()
        if not worked:
            stopping.wait(2)
        draining = worked


if __name__ == '__main__':
    main()
