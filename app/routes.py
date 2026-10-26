from flask import Blueprint, current_app, request, jsonify, send_from_directory
from sqlalchemy.exc import IntegrityError
from . import limiter
from .models import db, SantaGroup, Participant, EmailDelivery
from .security import (
    MAX_PARTICIPANTS, ValidationError, clean_budget, clean_email,
    clean_text, encrypt_secret, json_body,
)
from .services.santa_service import SantaService
from .services.email_service import EmailService, SMTP_SELECTIONS
from .services.delivery_service import enqueue_assignments, notify_worker
from .i18n import request_language, t
import os

bp = Blueprint('main', __name__)

FRONTEND_DIST = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'frontend', 'dist')


def public_base_url():
    """Adresa frontendului, pentru linkurile din emailuri."""
    configured_url = os.environ.get('PUBLIC_URL') or os.environ.get('RENDER_EXTERNAL_URL')
    if configured_url:
        return configured_url.rstrip('/')
    origin = request.headers.get('Origin')
    if origin in current_app.config['CORS_ORIGINS_LIST']:
        return origin.rstrip('/')
    return request.host_url.rstrip('/')


def public_group_to_dict(group):
    """Ce vede oricine are linkul de invitație: fără participanți, fără codul de admin."""
    return {
        'name': group.name,
        'code': group.code,
        'min_budget_ron': group.min_budget_ron,
        'is_drawn': group.is_drawn,
        'participant_count': len(group.participants),
    }


def admin_group_to_dict(group):
    """Ce vede doar organizatorul: plus lista participanților (nume + email)."""
    participants = []
    for p in group.participants:
        participants.append({
            'id': p.id,
            'name': p.name,
            'email': p.email,
            'joined_at': p.joined_at.isoformat(),
        })
    jobs = EmailDelivery.query.filter_by(group_id=group.id).all()
    pending_ids = {job.participant_id for job in jobs if job.status in ('pending', 'sending')}
    uncertain_ids = {job.participant_id for job in jobs if job.status == 'uncertain'}
    return {
        **public_group_to_dict(group),
        'id': group.id,
        'admin_code': group.admin_code,
        'created_at': group.created_at.isoformat(),
        'has_email': bool(group.smtp_email),
        'participants': participants,
        'emails_sent': sum(1 for p in group.participants if p.email_sent),
        'emails_pending': len(pending_ids),
        'uncertain_emails': [p.name for p in group.participants if p.id in uncertain_ids],
        'failed_emails': [
            p.name for p in group.participants
            if group.is_drawn and group.smtp_email and not p.email_sent and p.id not in pending_ids
        ],
        'admin_link_expired': group.admin_link_expired,
    }


def find_admin_group():
    """Grupul după codul de admin din headerul X-Admin-Code, blocat pentru scriere.

    Codul vine în header, nu în URL, ca să nu apară în logurile serverului.
    FOR UPDATE face ca cererile simultane pe același grup să aștepte una după alta.
    """
    code = request.headers.get('X-Admin-Code', '')
    if not code:
        return None
    return SantaGroup.query.filter_by(admin_code=code).with_for_update().first()


@bp.route('/api/groups', methods=['POST'])
@limiter.limit('10 per hour')
def create_group():
    data = json_body()
    name = clean_text(data.get('name'), 'group_name')
    budget = clean_budget(data.get('budget'))

    smtp_email = smtp_password = smtp_host = smtp_port = None
    provider = data.get('smtp_provider')
    if provider is not None and (not isinstance(provider, str) or provider not in SMTP_SELECTIONS):
        raise ValidationError('provider_invalid')
    # Fără email, nimeni n-ar afla perechile: nici organizatorul nu le vede.
    if not provider:
        raise ValidationError('provider_required')
    if provider:
        smtp_email = clean_email(data.get('smtp_email'), 'smtp_email')
        smtp_password = clean_text(data.get('smtp_password'), 'smtp_password')
        # Hostul vine din lista serverului; orice smtp_host trimis de client e ignorat.
        smtp_host, smtp_port = SMTP_SELECTIONS[provider]
        if smtp_port in current_app.config['SMTP_BLOCKED_PORTS']:
            raise ValidationError('provider_port_blocked')

    group = SantaGroup(
        name=name,
        min_budget_ron=budget,
        smtp_email=smtp_email,
        smtp_password=encrypt_secret(smtp_password) if smtp_password else None,
        smtp_host=smtp_host,
        smtp_port=smtp_port,
        language=request_language(),
    )
    db.session.add(group)
    db.session.commit()

    admin_email_sent = False
    if group.smtp_email:
        admin_url = f"{public_base_url()}/admin#{group.admin_code}"
        admin_email_sent = EmailService.send_admin_link(group, admin_url)

    return jsonify({**admin_group_to_dict(group), 'admin_email_sent': admin_email_sent}), 201


@bp.route('/api/groups/<code>', methods=['GET'])
@limiter.limit('60 per minute')
def get_group(code):
    group = SantaGroup.query.filter_by(code=code).first()
    if not group:
        return jsonify({'error': t('group_not_found')}), 404
    return jsonify(public_group_to_dict(group))


@bp.route('/api/admin', methods=['GET'])
@limiter.limit('60 per minute')
def get_admin_group():
    group = find_admin_group()
    if not group:
        return jsonify({'error': t('group_not_found')}), 404
    if group.admin_link_expired:
        return jsonify({'error': t('admin_link_expired'), 'expired': True}), 410
    result = admin_group_to_dict(group)
    db.session.commit()  # eliberează blocarea
    return jsonify(result)


@bp.route('/api/admin/draw', methods=['POST'])
@limiter.limit('10 per minute')
def draw_names():
    group = find_admin_group()
    if not group:
        return jsonify({'error': t('group_not_found')}), 404
    if group.is_drawn:
        db.session.rollback()
        return jsonify({'error': t('already_drawn')}), 409
    try:
        SantaService.draw_names(group)
    except ValueError as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400

    if group.smtp_password:
        enqueue_assignments(group)
    db.session.commit()
    notify_worker()
    return jsonify(admin_group_to_dict(group))


@bp.route('/api/admin/resend', methods=['POST'])
@limiter.limit('10 per minute')
def resend_emails():
    group = find_admin_group()
    if not group:
        return jsonify({'error': t('group_not_found')}), 404
    if group.admin_link_expired:
        return jsonify({'error': t('admin_link_expired'), 'expired': True}), 410
    if not group.is_drawn:
        db.session.rollback()
        return jsonify({'error': t('not_drawn_yet')}), 400

    # Organizatorul poate corecta parola dacă emailurile au eșuat din cauza ei.
    data = json_body()
    if data.get('retry_uncertain') not in (None, True, False):
        raise ValidationError('retry_flag_invalid')
    if data.get('smtp_password'):
        group.smtp_password = encrypt_secret(clean_text(data['smtp_password'], 'smtp_password'))

    enqueue_assignments(group, retry_uncertain=data.get('retry_uncertain') is True)
    db.session.commit()
    notify_worker()
    return jsonify(admin_group_to_dict(group))


@bp.route('/api/admin/participants/<int:participant_id>', methods=['DELETE'])
@limiter.limit('30 per minute')
def delete_participant(participant_id):
    group = find_admin_group()
    if not group:
        return jsonify({'error': t('group_not_found')}), 404
    if group.is_drawn:
        db.session.rollback()
        return jsonify({'error': t('cannot_remove_after_draw')}), 400
    participant = Participant.query.filter_by(id=participant_id, group_id=group.id).first()
    if not participant:
        db.session.rollback()
        return jsonify({'error': t('participant_not_found')}), 404
    db.session.delete(participant)
    db.session.commit()
    db.session.refresh(group)
    return jsonify(admin_group_to_dict(group))


@bp.route('/api/groups/<code>/participants', methods=['POST'])
@limiter.limit('10 per minute; 60 per hour')
def add_participant(code):
    data = json_body()
    name = clean_text(data.get('name'), 'name')
    email = clean_email(data.get('email'))
    wishlist = clean_text(data.get('wishlist'), 'wishlist', required=False, multiline=True)

    # Blocăm grupul ca o înscriere să nu se strecoare în timpul tragerii.
    group = SantaGroup.query.filter_by(code=code).with_for_update().first()
    if not group:
        return jsonify({'error': t('group_not_found')}), 404
    if group.is_drawn:
        db.session.rollback()
        return jsonify({'error': t('registration_closed')}), 400
    if len(group.participants) >= MAX_PARTICIPANTS:
        db.session.rollback()
        return jsonify({'error': t('group_full', max=MAX_PARTICIPANTS)}), 400
    if any(p.email == email for p in group.participants):
        db.session.rollback()
        return jsonify({'error': t('duplicate_email')}), 400

    p = Participant(group_id=group.id, name=name, email=email, wishlist=wishlist, language=request_language())
    db.session.add(p)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({'error': t('duplicate_email')}), 400
    return jsonify({
        'id': p.id, 'name': p.name, 'email': p.email,
        'wishlist': p.wishlist, 'joined_at': p.joined_at.isoformat(),
        'group_name': group.name, 'min_budget_ron': group.min_budget_ron,
        'participant_count': Participant.query.filter_by(group_id=group.id).count(),
    }), 201


@bp.route('/api/stats', methods=['GET'])
def get_stats():
    from sqlalchemy import func
    total_groups = SantaGroup.query.count()
    total_participants = Participant.query.count()
    drawn_groups = SantaGroup.query.filter_by(is_drawn=True).count()
    groups_with_email = SantaGroup.query.filter(SantaGroup.smtp_email.isnot(None)).count()

    budgets = [g.min_budget_ron for g in SantaGroup.query.all()]
    # Cheia „none” e tradusă de frontend; intervalele se afișează ca atare.
    budget_buckets = {'none': 0, '0-50': 0, '51-100': 0, '101-200': 0, '201-500': 0, '500+': 0}
    for b in budgets:
        if b is None:
            budget_buckets['none'] += 1
        elif b <= 50:
            budget_buckets['0-50'] += 1
        elif b <= 100:
            budget_buckets['51-100'] += 1
        elif b <= 200:
            budget_buckets['101-200'] += 1
        elif b <= 500:
            budget_buckets['201-500'] += 1
        else:
            budget_buckets['500+'] += 1

    size_dist = db.session.query(
        SantaGroup.id,
        func.count(Participant.id).label('cnt')
    ).outerjoin(Participant, Participant.group_id == SantaGroup.id).group_by(SantaGroup.id).all()
    size_buckets = {'1': 0, '2-5': 0, '6-10': 0, '11-20': 0, '20+': 0}
    for _, cnt in size_dist:
        if cnt <= 1:
            size_buckets['1'] += 1
        elif cnt <= 5:
            size_buckets['2-5'] += 1
        elif cnt <= 10:
            size_buckets['6-10'] += 1
        elif cnt <= 20:
            size_buckets['11-20'] += 1
        else:
            size_buckets['20+'] += 1

    avg_participants = round(total_participants / total_groups, 1) if total_groups else 0

    # Fără numele grupurilor: statisticile sunt publice.
    recent = SantaGroup.query.order_by(SantaGroup.created_at.desc()).limit(5).all()
    recent_list = [{
        'participant_count': len(g.participants),
        'is_drawn': g.is_drawn,
        'created_at': g.created_at.isoformat(),
    } for g in recent]

    return jsonify({
        'total_groups': total_groups,
        'total_participants': total_participants,
        'drawn_groups': drawn_groups,
        'pending_groups': total_groups - drawn_groups,
        'groups_with_email': groups_with_email,
        'avg_participants_per_group': avg_participants,
        'budget_distribution': budget_buckets,
        'group_size_distribution': size_buckets,
        'recent_groups': recent_list,
    })


# --- Serve React SPA ---
@bp.route('/api/config', methods=['GET'])
def email_config():
    blocked = current_app.config['SMTP_BLOCKED_PORTS']
    return jsonify({
        'blocked_smtp_ports': sorted(blocked),
        'unavailable_providers': [key for key, (_, port) in SMTP_SELECTIONS.items() if port in blocked],
    })


@bp.route('/health', methods=['GET'])
def health():
    # Fără acces DB: verificările periodice nu trezesc Neon din repaus.
    return jsonify({'status': 'ok'})


@bp.route('/', defaults={'path': ''})
@bp.route('/<path:path>')
def serve_react(path):
    if path == 'api' or path.startswith('api/'):
        return jsonify({'error': t('api_route_missing')}), 404
    if path and os.path.exists(os.path.join(FRONTEND_DIST, path)):
        return send_from_directory(FRONTEND_DIST, path)
    index_path = os.path.join(FRONTEND_DIST, 'index.html')
    if os.path.exists(index_path):
        return send_from_directory(FRONTEND_DIST, 'index.html')
    return jsonify({'message': 'API is running. Build the React frontend to serve the UI.'}), 200
