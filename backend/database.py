from contextlib import contextmanager
from functools import lru_cache

from flask import current_app
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, MetaData, Numeric, String, Table, Text, create_engine, func, select, text
from sqlalchemy.dialects.mysql import LONGTEXT
from sqlalchemy.engine import URL

metadata = MetaData()
quotations = Table(
    'quotations', metadata,
    Column('id', Integer, primary_key=True, autoincrement=True),
    Column('number', String(32), unique=True),
    Column('date', String(10), nullable=False),
    Column('customer', Text, nullable=False),
    Column('total', Numeric(18, 2), nullable=False),
    Column('payload', LONGTEXT(), nullable=False),
    mysql_engine='InnoDB', mysql_charset='utf8mb4', mysql_collate='utf8mb4_unicode_ci',
)

users = Table(
    'users', metadata,
    Column('id', Integer, primary_key=True, autoincrement=True),
    Column('username', String(80), nullable=False, unique=True),
    Column('name', String(120), nullable=False),
    Column('password_hash', String(255), nullable=False),
    Column('role', String(16), nullable=False),
    Column('active', Boolean, nullable=False, default=True),
    mysql_engine='InnoDB', mysql_charset='utf8mb4', mysql_collate='utf8mb4_unicode_ci',
)

auth_sessions = Table(
    'auth_sessions', metadata,
    Column('token_hash', String(64), primary_key=True),
    Column('user_id', Integer, ForeignKey('users.id'), nullable=False, index=True),
    Column('csrf', String(64), nullable=False),
    Column('expires_at', DateTime, nullable=False),
    mysql_engine='InnoDB',
)

quotation_reviews = Table(
    'quotation_reviews', metadata,
    Column('quote_id', Integer, ForeignKey('quotations.id'), primary_key=True),
    Column('owner_id', Integer, ForeignKey('users.id'), nullable=True, index=True),
    Column('status', String(16), nullable=False, default='pending', index=True),
    Column('revision', Integer, nullable=False, default=1),
    Column('submitted_at', DateTime, nullable=False),
    Column('approved_by', Integer, ForeignKey('users.id'), nullable=True),
    Column('approved_at', DateTime, nullable=True),
    mysql_engine='InnoDB',
)

login_limits = Table(
    'login_limits', metadata,
    Column('key', String(64), primary_key=True),
    Column('attempts', Integer, nullable=False),
    Column('started_at', DateTime, nullable=False),
    mysql_engine='InnoDB',
)


def database_url(settings, include_database=True):
    return URL.create(
        'mysql+pymysql', username=settings['DB_USER'], password=settings['DB_PASSWORD'],
        host=settings['DB_HOST'], port=settings['DB_PORT'],
        database=settings['DB_NAME'] if include_database else None,
        query={'charset': 'utf8mb4'},
    )


@lru_cache(maxsize=16)
def _engine(url, timeout):
    engine = create_engine(url, pool_pre_ping=True, pool_recycle=1800,
                           connect_args={'connect_timeout': int(timeout)}, hide_parameters=True)
    metadata.create_all(engine)
    return engine


def get_engine(settings=None):
    settings = current_app.config if settings is None else settings
    timeout = settings['DB_CONNECT_TIMEOUT']
    return _engine(database_url(settings), timeout)


@contextmanager
def db():
    with get_engine().begin() as connection:
        yield connection


def next_quote_id(connection):
    minimum = int(connection.execute(select(func.coalesce(func.max(quotations.c.id), 0))).scalar_one()) + 1
    sequence = connection.execute(text(
        "SELECT AUTO_INCREMENT FROM information_schema.TABLES WHERE TABLE_SCHEMA = :schema AND TABLE_NAME = 'quotations'"
    ), {'schema': connection.engine.url.database}).scalar_one_or_none()
    return max(minimum, int(sequence or 1))
