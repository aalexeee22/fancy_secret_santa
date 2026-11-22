from flask import Flask, jsonify, request
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from werkzeug.exceptions import HTTPException
from werkzeug.middleware.proxy_fix import ProxyFix
from dotenv import load_dotenv
from sqlalchemy import inspect, text
import os

load_dotenv()

db = SQLAlchemy()
# Memoria e per proces: cu 4 workeri gunicorn, limita efectivă e de până la 4x.
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=['300 per minute'],
    storage_uri=os.environ.get('RATELIMIT_STORAGE_URI', 'memory://'),
)

CSP = (
    "default-src 'self'; "
    "script-src 'self'; "
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
    "font-src https://fonts.gstatic.com; "
    "img-src 'self' data:; "
    "connect-src 'self'; "
    "worker-src 'self' blob:; "  # canvas-confetti desenează într-un worker creat din blob

    "frame-ancestors 'none'; "
    "base-uri 'none'; "
    "form-action 'self'"
)


def create_app():
    app = Flask(__name__)
    debug = os.environ.get('FLASK_DEBUG') == '1'

    secret_key = os.environ.get('SECRET_KEY')
    if not secret_key:
        if not debug:
            raise RuntimeError('SECRET_KEY lipsește. Setează-l în .env (vezi .env.example).')
        secret_key = 'dev-secret-key-doar-local'
    database_url = os.environ.get('DATABASE_URL')
    if not database_url:
        raise RuntimeError('DATABASE_URL lipsește. Setează-l în .env (vezi .env.example).')
    for prefix in ('postgres://', 'postgresql://'):
        if database_url.startswith(prefix):
            database_url = 'postgresql+psycopg://' + database_url[len(prefix):]
            break

    app.config['SECRET_KEY'] = secret_key
    app.config['SQLALCHEMY_DATABASE_URI'] = database_url
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {'pool_pre_ping': True}
    app.config['MAX_CONTENT_LENGTH'] = 64 * 1024
    app.config['RATELIMIT_ENABLED'] = os.environ.get('RATELIMIT_ENABLED', '1') == '1'
    app.config['SMTP_BLOCKED_PORTS'] = {int(p.strip()) for p in os.environ.get('SMTP_BLOCKED_PORTS', '').split(',') if p.strip()}

    # Pe Render/Railway aplicația stă în spatele unui proxy; fără asta toți ar avea același IP.
    if os.environ.get('BEHIND_PROXY') == '1':
        app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)

    origins = [o.strip() for o in os.environ.get(
        'CORS_ORIGINS', 'http://localhost:5173,http://localhost:5174'
    ).split(',') if o.strip()]
    app.config['CORS_ORIGINS_LIST'] = origins
    render_url = os.environ.get('RENDER_EXTERNAL_URL', '').rstrip('/')
    if render_url and render_url not in origins:
        origins.append(render_url)
    CORS(app, resources={r"/api/*": {"origins": origins}}, allow_headers=['Content-Type', 'Accept-Language', 'X-Admin-Code'])

    limiter.init_app(app)
    db.init_app(app)

    from .routes import bp
    from .advent import advent_bp
    # Înaintea rutei catch-all a frontendului din bp.
    app.register_blueprint(advent_bp)
    app.register_blueprint(bp)

    from .security import ValidationError
    from .i18n import t

    @app.errorhandler(ValidationError)
    def handle_validation_error(e):
        return jsonify({'error': str(e)}), 400

    @app.errorhandler(HTTPException)
    def handle_http_error(e):
        messages = {413: 'request_too_large', 429: 'too_many_requests'}
        return jsonify({'error': t(messages[e.code]) if e.code in messages else e.description}), e.code

    @app.errorhandler(Exception)
    def handle_unexpected_error(e):
        db.session.rollback()
        app.logger.exception('Eroare neașteptată')
        return jsonify({'error': t('server_error')}), 500

    @app.after_request
    def security_headers(response):
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'DENY'
        response.headers['Referrer-Policy'] = 'no-referrer'
        response.headers['Content-Security-Policy'] = CSP
        # /api/admin are aceeași adresă pentru toate grupurile (codul e în header), deci
        # un 410 „expirat” păstrat de browser ar apărea și la un grup nou. Nimic din API nu se salvează.
        # Excepție: posterele deja deschise își pun singure un cache scurt.
        if request.path.startswith('/api/'):
            response.headers.setdefault('Cache-Control', 'no-store')
        return response

    with app.app_context():
        db.create_all()
        # Migrări aditive pentru bazele existente; parola și repartizările se păstrează.
        optional = 'IF NOT EXISTS ' if db.engine.dialect.name == 'postgresql' else ''
        for table, column, sql_type in (
            ('santa_groups', 'smtp_username', 'VARCHAR(200)'),
            ('santa_groups', 'language', 'VARCHAR(5)'),
            ('participants', 'language', 'VARCHAR(5)'),
        ):
            if column not in {c['name'] for c in inspect(db.engine).get_columns(table)}:
                db.session.execute(text(f'ALTER TABLE {table} ADD COLUMN {optional}{column} {sql_type}'))
                db.session.commit()
        # gunicorn face fork după create_app (preload_app=True); fiecare worker
        # trebuie să-și deschidă propriile conexiuni, nu să le moștenească.
        db.engine.dispose()

    return app
