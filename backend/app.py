import json
from pathlib import Path

from flask import Flask, g, jsonify, request
from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError

from database import db, quotations, quotation_reviews, users, next_quote_id
from auth import auth_api, require_login, utcnow
from pricing import validate
from config import load_settings

ROOT = Path(__file__).resolve().parent
(ROOT / 'instance').mkdir(exist_ok=True)
app = Flask(__name__, static_folder=None)
app.config.update(load_settings())
app.config['MAX_CONTENT_LENGTH'] = 2 * 1024 * 1024
app.register_blueprint(auth_api)


@app.after_request
def prevent_private_caching(response):
    if request.path.startswith('/api/'):
        response.headers['Cache-Control'] = 'no-store'
    return response


def review_data(review):
    return {
        'status': review['status'] if review else 'pending',
        'revision': review['revision'] if review else 0,
        'ownerId': review['owner_id'] if review else None,
        'approvedBy': review['approved_by'] if review else None,
        'approvedAt': review['approved_at'].isoformat() if review and review['approved_at'] else None,
    }


def read_quote(connection, quote_id, lock=False):
    statement = select(quotations).where(quotations.c.id == quote_id)
    if lock:
        statement = statement.with_for_update()
    row = connection.execute(statement).mappings().first()
    review = connection.execute(select(quotation_reviews).where(quotation_reviews.c.quote_id == quote_id)).mappings().first()
    if row is None or (g.user['role'] != 'admin' and (not review or review['owner_id'] != g.user['id'])):
        return None, None
    return row, review


def quote_payload(row, review):
    return {**json.loads(row['payload']), **review_data(review)}


@app.get('/api/quotations')
@require_login()
def list_quotes():
    with db() as connection:
        statement = select(
            quotations.c.id, quotations.c.number, quotations.c.date, quotations.c.customer, quotations.c.total,
            func.json_extract(quotations.c.payload, '$.validity').label('validity'),
            quotation_reviews.c.status, quotation_reviews.c.revision,
        ).outerjoin(quotation_reviews, quotations.c.id == quotation_reviews.c.quote_id)
        if g.user['role'] != 'admin':
            statement = statement.where(quotation_reviews.c.owner_id == g.user['id'])
        rows = connection.execute(statement.order_by(quotations.c.id.desc())).mappings().all()
    result = []
    for row in rows:
        record = dict(row)
        record['total'] = float(record['total'])
        record['status'] = record['status'] or 'pending'
        record['revision'] = record['revision'] or 0
        if isinstance(record['validity'], str) and record['validity'].startswith('"'):
            record['validity'] = json.loads(record['validity'])
        result.append(record)
    return jsonify(result)


@app.get('/api/quotations/<int:quote_id>')
@require_login()
def get_quote(quote_id):
    with db() as connection:
        row, review = read_quote(connection, quote_id)
    return (jsonify(quote_payload(row, review)) if row else (jsonify(error='Quotation not found.'), 404))


@app.get('/api/quotations/<int:quote_id>/preview')
@require_login()
def preview_quote(quote_id):
    with db() as connection:
        row, review = read_quote(connection, quote_id)
    if row is None:
        return jsonify(error='Quotation not found.'), 404
    if g.user['role'] != 'admin' and (not app.config['USER_CAN_PRINT_APPROVED'] or not review or review['status'] != 'approved'):
        return jsonify(error='Administrator approval is required before preview or printing.'), 403
    return jsonify(quote_payload(row, review))


@app.get('/api/quotations/next-number')
@require_login()
def next_number():
    with db() as connection:
        next_id = next_quote_id(connection)
    return jsonify(number=f'QT-{next_id:05d}')


@app.post('/api/quotations')
@require_login()
def save_quote():
    try:
        payload = validate(request.get_json(silent=True))
        with db() as connection:
            quote_id = payload.get('id')
            if quote_id is not None and (type(quote_id) is not int or quote_id < 1):
                return jsonify(error='Invalid quotation ID.'), 400
            if quote_id is not None:
                row, review = read_quote(connection, quote_id, lock=True)
                if row is None:
                    return jsonify(error='Quotation not found.'), 404
                if payload.get('revision') != (review['revision'] if review else 0):
                    return jsonify(error='This quotation has changed. Reopen it before saving.'), 409
                payload['number'] = row['number']
            else:
                cursor = connection.execute(quotations.insert().values(date=payload['date'], customer=payload['billTo']['name'], total=payload['totals']['total'], payload='{}'))
                quote_id = cursor.inserted_primary_key[0]
                payload['id'] = quote_id
                payload['number'] = f'QT-{quote_id:05d}'
                review = None
            # Ignore client-supplied approval fields; each saved edit requires review.
            state = dict(owner_id=review['owner_id'] if review else g.user['id'], status='pending',
                         revision=(review['revision'] if review else 0) + 1, submitted_at=utcnow(),
                         approved_by=None, approved_at=None)
            if review:
                connection.execute(quotation_reviews.update().where(quotation_reviews.c.quote_id == quote_id).values(**state))
            else:
                connection.execute(quotation_reviews.insert().values(quote_id=quote_id, **state))
            for key in ['status', 'revision', 'ownerId', 'approvedBy', 'approvedAt']:
                payload.pop(key, None)
            connection.execute(quotations.update().where(quotations.c.id == quote_id).values(number=payload['number'], date=payload['date'], customer=payload['billTo']['name'], total=payload['totals']['total'], payload=json.dumps(payload)))
        return jsonify({**payload, **review_data(state)}), 200
    except ValueError as error:
        return jsonify(error=str(error)), 400


@app.get('/api/approval-requests')
@require_login(admin=True)
def approval_requests():
    with db() as connection:
        rows = connection.execute(select(quotations, quotation_reviews.c.revision,
                                         quotation_reviews.c.submitted_at, users.c.name.label('requested_by'))
                                  .outerjoin(quotation_reviews, quotation_reviews.c.quote_id == quotations.c.id)
                                  .outerjoin(users, users.c.id == quotation_reviews.c.owner_id)
                                  .where((quotation_reviews.c.status == 'pending') | quotation_reviews.c.status.is_(None))
                                  .order_by(quotations.c.id.desc())).mappings().all()
    return jsonify([dict(id=row['id'], number=row['number'], customer=row['customer'], total=float(row['total']),
                         revision=row['revision'] or 0, requestedBy=row['requested_by'] or 'Existing quotation',
                         submittedAt=row['submitted_at'].isoformat() if row['submitted_at'] else None,
                         products=[dict(name=item.get('name', ''), quantity=item.get('quantity', 0),
                                        price=item.get('price', 0)) for item in json.loads(row['payload']).get('items', [])]) for row in rows])


@app.post('/api/quotations/<int:quote_id>/approve')
@require_login(admin=True)
def approve_quote(quote_id):
    data = request.get_json(silent=True) or {}
    if not isinstance(data, dict):
        return jsonify(error='Invalid approval request.'), 400
    with db() as connection:
        row, review = read_quote(connection, quote_id, lock=True)
        if row is None:
            return jsonify(error='Quotation not found.'), 404
        if data.get('revision') != (review['revision'] if review else 0):
            return jsonify(error='This quotation has changed. Review the latest version before approving.'), 409
        state = dict(owner_id=review['owner_id'] if review else None, status='approved',
                     revision=review['revision'] if review else 0,
                     submitted_at=review['submitted_at'] if review else utcnow(),
                     approved_by=g.user['id'], approved_at=utcnow())
        if review:
            connection.execute(quotation_reviews.update().where(quotation_reviews.c.quote_id == quote_id).values(**state))
        else:
            connection.execute(quotation_reviews.insert().values(quote_id=quote_id, **state))
    return jsonify(quote_payload(row, state))


@app.errorhandler(SQLAlchemyError)
def database_error(error):
    app.logger.error('Database operation failed (%s). Check database configuration and availability.', type(error).__name__)
    return jsonify(error='Database unavailable. Check the database server and .env connection settings.'), 503


@app.get('/')
def index():
    return jsonify(service='Weider ERP API', frontend='Run npm run dev separately on port 5173.')


@app.get('/<path:path>')
def not_found(path):
    return jsonify(error='Not found.'), 404


if __name__ == '__main__':
    app.run(host=app.config['HOST'], port=app.config['PORT'], debug=app.config['DEBUG'], load_dotenv=False)
