"""Initialize and check the application's MySQL database."""
import argparse

from sqlalchemy import create_engine, text

from config import load_settings
from database import database_url, get_engine


def server_engine(settings):
    return create_engine(database_url(settings, include_database=False),
                         connect_args={'connect_timeout': settings['DB_CONNECT_TIMEOUT']},
                         hide_parameters=True)


def init_database(settings):
    engine = server_engine(settings)
    try:
        with engine.begin() as connection:
            # DB_NAME is restricted to letters, digits and underscores by config.py.
            connection.execute(text(f"CREATE DATABASE IF NOT EXISTS `{settings['DB_NAME']}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"))
    finally:
        engine.dispose()
    return get_engine(settings)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['init', 'check'])
    args = parser.parse_args()
    settings = load_settings()
    try:
        if args.command == 'init':
            init_database(settings)
            print('MySQL database and quotations table are ready.')
        else:
            with get_engine(settings).connect() as connection:
                connection.execute(text('SELECT 1'))
                print('MySQL database connection OK.')
    except Exception as error:
        if isinstance(error, ValueError):
            parser.exit(1, f'{error}\n')
        parser.exit(1, f'Database operation failed ({type(error).__name__}). Check MySQL and the DB_* settings in .env.\n')


if __name__ == '__main__':
    main()
