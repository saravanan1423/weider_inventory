import json
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory
from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError

from database import db, quotations, next_quote_id
from pricing import validate
from config import load_settings

ROOT = Path(__file__).resolve().parent
(ROOT / 'instance').mkdir(exist_ok=True)
app = Flask(__name__, static_folder=str(ROOT.parent / 'frontend' / 'dist'), static_url_path='')
app.config.update(load_settings())


@app.get('/api/quotations')
def list_quotes():
    with db() as connection:
        rows = connection.execute(select(
            quotations.c.id, quotations.c.number, quotations.c.date, quotations.c.customer, quotations.c.total,
            func.json_extract(quotations.c.payload, '$.validity').label('validity')
        ).order_by(quotations.c.id.desc())).mappings().all()
    result = []
    for row in rows:
        record = dict(row)
        record['total'] = float(record['total'])
        if isinstance(record['validity'], str) and record['validity'].startswith('"'):
            record['validity'] = json.loads(record['validity'])
        result.append(record)
    return jsonify(result)


@app.get('/api/quotations/<int:quote_id>')
def get_quote(quote_id):
    with db() as connection:
        row = connection.execute(select(quotations.c.payload).where(quotations.c.id == quote_id)).mappings().first()
    return (jsonify(json.loads(row['payload'])) if row else (jsonify(error='Quotation not found.'), 404))


@app.get('/api/quotations/next-number')
def next_number():
    with db() as connection:
        next_id = next_quote_id(connection)
    return jsonify(number=f'QT-{next_id:05d}')


@app.post('/api/quotations')
def save_quote():
    try:
        payload = validate(request.get_json(silent=True))
        with db() as connection:
            quote_id = payload.get('id')
            if quote_id is not None:
                row = connection.execute(select(quotations.c.number).where(quotations.c.id == quote_id)).mappings().first()
                if row is None:
                    return jsonify(error='Quotation not found.'), 404
                payload['number'] = row['number']
            else:
                cursor = connection.execute(quotations.insert().values(date=payload['date'], customer=payload['billTo']['name'], total=payload['totals']['total'], payload='{}'))
                quote_id = cursor.inserted_primary_key[0]
                payload['id'] = quote_id
                payload['number'] = f'QT-{quote_id:05d}'
            connection.execute(quotations.update().where(quotations.c.id == quote_id).values(number=payload['number'], date=payload['date'], customer=payload['billTo']['name'], total=payload['totals']['total'], payload=json.dumps(payload)))
        return jsonify(payload), 200
    except ValueError as error:
        return jsonify(error=str(error)), 400


@app.errorhandler(SQLAlchemyError)
def database_error(error):
    app.logger.error('Database operation failed (%s). Check database configuration and availability.', type(error).__name__)
    return jsonify(error='Database unavailable. Check the database server and .env connection settings.'), 503


@app.get('/')
def index():
    return send_from_directory(app.static_folder, 'index.html')


@app.get('/<path:path>')
def assets(path):
    if path.startswith('api/'):
        return jsonify(error='Not found.'), 404
    return send_from_directory(app.static_folder, path)


if __name__ == '__main__':
    app.run(host=app.config['HOST'], port=app.config['PORT'], debug=app.config['DEBUG'], load_dotenv=False)
