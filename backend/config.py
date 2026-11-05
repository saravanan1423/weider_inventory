import os
import re
from pathlib import Path

from dotenv import dotenv_values

PROJECT_ROOT = Path(__file__).resolve().parent.parent


def load_settings(project_root=PROJECT_ROOT, environ=None):
    """Read root .env settings; process environment variables take precedence."""
    project_root = Path(project_root).resolve()
    file_values = dotenv_values(project_root / '.env')
    values = {**file_values, **(os.environ if environ is None else environ)}

    def setting(name, default):
        value = values.get(name)
        text = str(value).strip() if value is not None else ''
        return text or str(default)

    def port(name, default):
        try:
            result = int(setting(name, default))
            if not 1 <= result <= 65535:
                raise ValueError()
            return result
        except ValueError:
            raise ValueError(f'{name} must be an integer between 1 and 65535.') from None

    debug = setting('FLASK_DEBUG', 'false').lower()
    if debug not in ['true', 'false', '1', '0', 'yes', 'no', 'on', 'off']:
        raise ValueError('FLASK_DEBUG must be true or false.')
    database_name = setting('DB_NAME', 'weider_erp')
    if not re.fullmatch(r'[A-Za-z0-9_]{1,64}', database_name):
        raise ValueError('DB_NAME must contain only letters, digits, and underscores (up to 64 characters).')
    try:
        connect_timeout = int(setting('DB_CONNECT_TIMEOUT', 10))
        if connect_timeout <= 0:
            raise ValueError()
    except ValueError:
        raise ValueError('DB_CONNECT_TIMEOUT must be a positive integer.') from None

    return {
        'DB_HOST': setting('DB_HOST', '127.0.0.1'),
        'DB_PORT': port('DB_PORT', 3306),
        'DB_NAME': database_name,
        'DB_USER': setting('DB_USER', 'weider_erp_app'),
        'DB_PASSWORD': str(values.get('DB_PASSWORD') or ''),
        'DB_CONNECT_TIMEOUT': connect_timeout,
        'HOST': setting('FLASK_HOST', '0.0.0.0'),
        'PORT': port('FLASK_PORT', 5050),
        'DEBUG': debug in ['true', '1', 'yes', 'on'],
    }
