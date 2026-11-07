# MySQL setup

The application uses MySQL exclusively through SQLAlchemy and PyMySQL. On this computer, XAMPP provides MariaDB 10.4, a MySQL-compatible server.

- Database: `weider_erp`
- Application account: `weider_erp_app`, limited to this database
- Host/port: `127.0.0.1:3306`
- The application password is stored in the Git-ignored root `.env`.
- The database listens on localhost; other devices connect through the Flask application.

## Run

Start **MySQL** in XAMPP, then run:

```powershell
.\start.ps1
```

This starts only the backend. Run `npm run dev` in another terminal and open port 5173 for the frontend.

For manual backend startup:

```powershell
.venv\Scripts\python -m pip install -r backend/requirements.txt
.venv\Scripts\python backend/manage_db.py init
.venv\Scripts\python backend/manage_db.py check
.venv\Scripts\python backend/app.py
```

`init` creates the configured database and table if they do not exist; it does not clear existing data. `check` verifies connectivity. These are the only database management commands.

Initialization also adds the account, session and quotation approval tables. Create the first administrator with `backend/manage_users.py create-admin --username admin --name "Administrator"`; it prompts for a password. See [ROLE_MANAGEMENT.md](ROLE_MANAGEMENT.md).

## Environment variables

```dotenv
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=weider_erp
DB_USER=weider_erp_app
DB_PASSWORD=your-application-database-password
DB_CONNECT_TIMEOUT=10
```

For another MySQL server, create a database and a user with permissions on that database, then update these values. Passwords with special characters do not need URL encoding. Keep `.env` private; share `.env.example` instead. Restart Flask to apply configuration changes.

Existing quotations have already been transferred to MySQL. Historical `.db` backup files remain untouched; the application does not read or write them. Back up the active MySQL database using your database administration tools.

## Tests

Configuration tests run without a database server. API tests use uniquely named disposable MySQL schemas and are enabled explicitly:

```powershell
Set-Location backend
$env:RUN_MYSQL_TESTS = '1'
..\.venv\Scripts\python -m unittest discover -s tests -v
```

The test account must have permission to create and drop schemas. Set `MYSQL_TEST_USER` and `MYSQL_TEST_PASSWORD` when needed; defaults are `root` and an empty password for this local XAMPP installation. Tests create random `weider_erp_test_*` schemas and remove only those schemas afterward. They never modify `weider_erp`.
