"""Create the first administrator or reset an account password interactively."""
import argparse
from getpass import getpass

from sqlalchemy import delete, select

from auth import account_values
from config import load_settings
from database import auth_sessions, get_engine, users


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['create-admin', 'reset-password'])
    parser.add_argument('--username', required=True)
    parser.add_argument('--name')
    args = parser.parse_args()
    password = getpass('Password (10–128 characters): ')
    if password != getpass('Confirm password: '):
        parser.exit(1, 'Passwords do not match.\n')
    try:
        engine = get_engine(load_settings())
        with engine.begin() as connection:
            row = connection.execute(select(users).where(users.c.username == args.username.strip().lower())).mappings().first()
            if args.command == 'create-admin' and row:
                parser.exit(1, 'Username already exists; use reset-password if needed.\n')
            if args.command == 'reset-password' and not row:
                parser.exit(1, 'Account not found.\n')
            values = account_values(dict(username=args.username, name=args.name or (row['name'] if row else args.username),
                                         role=row['role'] if row else 'admin', password=password))
            if row:
                connection.execute(users.update().where(users.c.id == row['id']).values(password_hash=values['password_hash']))
                connection.execute(delete(auth_sessions).where(auth_sessions.c.user_id == row['id']))
            else:
                connection.execute(users.insert().values(**values))
        print('Account updated. Sign in using your username and password.')
    except ValueError as error:
        parser.exit(1, str(error) + '\n')


if __name__ == '__main__':
    main()
