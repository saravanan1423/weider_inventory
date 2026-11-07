"""Database-backed login sessions and administrator-managed accounts."""
from datetime import datetime, timedelta, timezone
from functools import wraps
import hashlib
import re
import secrets

from flask import Blueprint, current_app, g, jsonify, request
from sqlalchemy import delete, select, update
from sqlalchemy.dialects.mysql import insert
from sqlalchemy.exc import IntegrityError
from werkzeug.security import check_password_hash, generate_password_hash

from database import auth_sessions, db, login_limits, users

auth_api = Blueprint('auth', __name__)
COOKIE = 'weider_session'


def utcnow():
    # MySQL DATETIME stores UTC without a timezone offset.
    return datetime.now(timezone.utc).replace(tzinfo=None)


def public_user(row):
    return {key: row[key] for key in ['id', 'username', 'name', 'role', 'active']}


def token_hash(token):
    return hashlib.sha256(token.encode()).hexdigest()


def require_login(admin=False):
    def decorate(handler):
        @wraps(handler)
        def wrapped(*args, **kwargs):
            token = request.cookies.get(COOKIE, '')
            with db() as connection:
                row = connection.execute(select(users, auth_sessions.c.csrf).join(
                    auth_sessions, users.c.id == auth_sessions.c.user_id
                ).where(auth_sessions.c.token_hash == token_hash(token),
                        auth_sessions.c.expires_at > utcnow(), users.c.active.is_(True))).mappings().first()
            if row is None:
                return jsonify(error='Please sign in.'), 401
            if admin and row['role'] != 'admin':
                return jsonify(error='Administrator access is required.'), 403
            if request.method not in ['GET', 'HEAD', 'OPTIONS'] and not secrets.compare_digest(
                    request.headers.get('X-CSRF-Token', ''), row['csrf']):
                return jsonify(error='Your session needs to be refreshed. Please sign in again.'), 403
            g.user = public_user(row)
            g.csrf = row['csrf']
            return handler(*args, **kwargs)
        return wrapped
    return decorate


def account_values(data, creating=True):
    if not isinstance(data, dict):
        raise ValueError('Enter account details.')
    username = str(data.get('username', '')).strip().lower()
    name = str(data.get('name', '')).strip()
    role = data.get('role', 'user')
    password = data.get('password', '')
    if not re.fullmatch(r'[a-z0-9._-]{3,80}', username):
        raise ValueError('Username must have 3–80 letters, numbers, dots, underscores or hyphens.')
    if not name or len(name) > 120 or role not in ['admin', 'user']:
        raise ValueError('Enter a name and a valid role.')
    if not isinstance(password, str) or ((creating or password) and not 10 <= len(password) <= 128):
        raise ValueError('Use a password with 10–128 characters.')
    values = dict(username=username, name=name, role=role)
    if 'active' in data and not isinstance(data['active'], bool):
        raise ValueError('Active must be true or false.')
    values['active'] = data.get('active', True)
    if password:
        values['password_hash'] = generate_password_hash(password)
    return values


@auth_api.post('/api/auth/login')
def login():
    # Reject cross-site login submissions. The application uses same-origin JSON.
    if request.headers.get('Sec-Fetch-Site') == 'cross-site' or not request.is_json:
        return jsonify(error='Use the sign-in form.'), 403
    data = request.get_json(silent=True) or {}
    if not isinstance(data, dict):
        return jsonify(error='Enter your username and password.'), 400
    username = str(data.get('username', '')).strip().lower()[:80]
    password = data.get('password', '')
    if not isinstance(password, str) or len(password) > 128:
        return jsonify(error='Invalid username or password.'), 401
    now = utcnow()
    key = token_hash(f'{request.remote_addr}:{username}')
    # Atomic, database-backed throttling also works across Gunicorn workers.
    with db() as connection:
        connection.execute(insert(login_limits).values(key=key, attempts=0, started_at=now).on_duplicate_key_update(key=key))
        limit = connection.execute(select(login_limits).where(login_limits.c.key == key).with_for_update()).mappings().one()
        attempts = limit['attempts'] if now - limit['started_at'] < timedelta(minutes=15) else 0
        if attempts >= 10:
            return jsonify(error='Too many sign-in attempts. Try again in 15 minutes.'), 429
        connection.execute(update(login_limits).where(login_limits.c.key == key).values(
            attempts=attempts + 1, started_at=limit['started_at'] if attempts else now))
        row = connection.execute(select(users).where(users.c.username == username)).mappings().first()
    if row is None or not row['active'] or not check_password_hash(row['password_hash'], password):
        return jsonify(error='Invalid username or password.'), 401
    token, csrf = secrets.token_urlsafe(32), secrets.token_hex(32)
    with db() as connection:
        connection.execute(delete(auth_sessions).where(auth_sessions.c.expires_at <= now))
        connection.execute(delete(auth_sessions).where(auth_sessions.c.token_hash == token_hash(request.cookies.get(COOKIE, ''))))
        connection.execute(auth_sessions.insert().values(token_hash=token_hash(token), user_id=row['id'], csrf=csrf,
                                                       expires_at=now + timedelta(hours=8)))
        connection.execute(delete(login_limits).where(login_limits.c.key == key))
    response = jsonify(user=public_user(row), csrf=csrf, userCanPrintApproved=current_app.config['USER_CAN_PRINT_APPROVED'])
    response.set_cookie(COOKIE, token, max_age=8 * 3600, httponly=True,
                        secure=current_app.config['AUTH_COOKIE_SECURE'], samesite='Lax', path='/api')
    return response


@auth_api.get('/api/auth/me')
@require_login()
def me():
    return jsonify(user=g.user, csrf=g.csrf, userCanPrintApproved=current_app.config['USER_CAN_PRINT_APPROVED'])


@auth_api.post('/api/auth/logout')
@require_login()
def logout():
    with db() as connection:
        connection.execute(delete(auth_sessions).where(auth_sessions.c.token_hash == token_hash(request.cookies.get(COOKIE, ''))))
    response = jsonify(ok=True)
    response.delete_cookie(COOKIE, path='/api')
    return response


@auth_api.get('/api/users')
@require_login(admin=True)
def list_users():
    with db() as connection:
        rows = connection.execute(select(users).order_by(users.c.name)).mappings().all()
    return jsonify([public_user(row) for row in rows])


@auth_api.post('/api/users')
@require_login(admin=True)
def create_user():
    try:
        values = account_values(request.get_json(silent=True))
        with db() as connection:
            result = connection.execute(users.insert().values(**values))
        return jsonify(id=result.inserted_primary_key[0]), 201
    except ValueError as error:
        return jsonify(error=str(error)), 400
    except IntegrityError:
        return jsonify(error='That username already exists.'), 409


@auth_api.put('/api/users/<int:user_id>')
@require_login(admin=True)
def edit_user(user_id):
    try:
        values = account_values(request.get_json(silent=True), creating=False)
        with db() as connection:
            # Serialize administrator changes, including simultaneous demotions.
            admins = connection.execute(select(users.c.id).where(users.c.role == 'admin', users.c.active.is_(True)).with_for_update()).scalars().all()
            row = connection.execute(select(users).where(users.c.id == user_id).with_for_update()).mappings().first()
            if row is None:
                return jsonify(error='Account not found.'), 404
            if user_id in admins and len(admins) == 1 and (values['role'] != 'admin' or not values['active']):
                return jsonify(error='Keep at least one active administrator.'), 400
            connection.execute(users.update().where(users.c.id == user_id).values(**values))
            connection.execute(delete(auth_sessions).where(auth_sessions.c.user_id == user_id))
        return jsonify(ok=True)
    except ValueError as error:
        return jsonify(error=str(error)), 400
    except IntegrityError:
        return jsonify(error='That username already exists.'), 409
