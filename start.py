"""Pornește web + worker în container; orice proces căzut repornește serviciul."""
import signal
import subprocess
import sys
import threading


def main():
    # Creăm tabelele înainte să pornim procese concurente (inclusiv coada nouă).
    from app import create_app
    create_app()
    stopping = threading.Event()
    for sig in (signal.SIGINT, signal.SIGTERM):
        signal.signal(sig, lambda *_: stopping.set())
    children = []
    result = 0
    try:
        children.append(subprocess.Popen([sys.executable, '-m', 'gunicorn', '--config', 'gunicorn.conf.py', 'run:app']))
        children.append(subprocess.Popen([sys.executable, 'email_worker.py']))
        while not stopping.wait(1):
            if any(child.poll() is not None for child in children):
                result = 1
                break
    finally:
        for child in children:
            if child.poll() is None:
                child.terminate()
        for child in children:
            try:
                child.wait(timeout=30)
            except subprocess.TimeoutExpired:
                child.kill()
                child.wait()
    return result


if __name__ == '__main__':
    sys.exit(main())
