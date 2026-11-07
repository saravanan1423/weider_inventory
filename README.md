# Weider ERP — Sales Quotation

A React and Flask quotation application with a compact light interface, MySQL storage, and printable quotations.

## Accounts and approvals

The workspace requires sign-in. Administrators manage accounts and approve quotations; users can preview and print their own quotations only after approval. Saved edits require approval again. See [ROLE_MANAGEMENT.md](ROLE_MANAGEMENT.md) for first-admin setup, server update commands, permissions, and password recovery.

## Project structure

```text
inventory software/
├── frontend/
│   ├── src/
│   │   ├── components/       # Address forms, items, terms, summary, list, preview
│   │   ├── lib/              # API client and quotation calculations
│   │   ├── App.jsx           # Quotation state and screen layout
│   │   ├── main.jsx          # React entry point
│   │   ├── styles.css        # Responsive application styles
│   │   └── print.css         # Preview and print styles
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── backend/
│   ├── app.py                # Flask API only
│   ├── database.py           # MySQL connections and schema
│   ├── pricing.py            # Validation and authoritative totals
│   ├── instance/             # Local logs and historical backups (not committed)
│   ├── tests/
│   └── requirements.txt
├── package.json              # Frontend command shortcuts
└── start.ps1                 # Prepare and run the backend on Windows
```

## Run

Start MySQL in XAMPP first. On a new checkout, copy `.env.example` to `.env`, create your MySQL database account, and enter its credentials as described in [MYSQL_SETUP.md](MYSQL_SETUP.md). From this folder in PowerShell:

```powershell
.\start.ps1
```

This starts only the backend on port 5050. In a second terminal, run:

```powershell
# Install once, and again when the lockfile changes:
npm --prefix frontend ci
npm run dev
```

Open **http://localhost:5173**. Keep both terminals running. React edits refresh automatically; no build is needed while developing.

Other devices on the same Wi-Fi or LAN can use `http://<this-computer-IPv4>:5173` when permitted by the firewall. Use `ipconfig` to find the server computer's IPv4 address. Vite forwards `/api` to Flask on port 5050, so the browser uses port 5173 for both UI and API requests.

The app uses the Aceternity expanding sidebar. The supplied reference demo is available at `http://localhost:5173/?sidebar-demo` and its dark variant at `http://localhost:5173/?sidebar-demo&theme=dark`. See [SIDEBAR_IMPLEMENTATION.md](SIDEBAR_IMPLEMENTATION.md) for all changes from the supplied source.

Or set up manually:

```powershell
python -m venv .venv
.venv\Scripts\python -m pip install -r backend/requirements.txt
# On a new checkout, then edit .env with your MySQL credentials:
Copy-Item .env.example .env
.venv\Scripts\python backend/manage_db.py init
npm --prefix frontend ci
.venv\Scripts\python backend/app.py
```

Keep Flask running and run `npm run dev` in another terminal. On Linux, use `.venv/bin/python` instead of `.venv\Scripts\python`.

`npm run build` creates optimized frontend files in `frontend/dist` only when needed. Flask no longer hosts these files. `npm run preview` checks a build on port 5173 with the API proxy enabled; stop the dev server first because both use that port. Vite dev and preview are for development and build verification. Public deployment needs a separate production frontend server that forwards `/api` to Flask/Gunicorn.

Tabler icons are imported individually to avoid processing the whole icon collection. Run `npm run typecheck` separately for TypeScript checks.

After pulling GitHub updates, run `npm --prefix frontend ci` when dependencies change. Restart Flask after backend changes, and Vite after configuration or dependency changes. Ordinary React edits refresh automatically.

## Verification

```powershell
npm run build
npm test
npm run typecheck
Set-Location backend
$env:RUN_MYSQL_TESTS = '1'
..\.venv\Scripts\python -m unittest discover -s tests -v
```

## MySQL database

The application database is MySQL (`weider_erp`), configured through the root `.env`. XAMPP MariaDB is also supported. See [MYSQL_SETUP.md](MYSQL_SETUP.md) for startup, credentials, and integration-test instructions.

## Environment configuration

The project root `.env` is loaded automatically by Flask and the Vite development configuration. The local `.env` is ignored by Git; `.env.example` is the shareable template. `start.ps1` copies the example if `.env` is missing.

```powershell
# Only needed when setting up another copy of the project:
Copy-Item .env.example .env
```

| Setting | Default | Purpose |
| --- | --- | --- |
| `FLASK_HOST` | `0.0.0.0` | Backend binding; permits access from the LAN |
| `FLASK_PORT` | `5050` | Flask application port |
| `FLASK_DEBUG` | `false` | Enables Flask development debugging when set to `true` |
| `DB_HOST` | `127.0.0.1` | MySQL server address |
| `DB_PORT` | `3306` | MySQL port |
| `DB_NAME` | `weider_erp` | MySQL database |
| `DB_USER` | `weider_erp_app` | Application database account |
| `DB_PASSWORD` | configured locally | Database password (not stored in the example) |
| `DB_CONNECT_TIMEOUT` | `10` | MySQL connection timeout in seconds |
| `FRONTEND_HOST` | `0.0.0.0` | Vite development/preview binding |
| `FRONTEND_PORT` | `5173` | Vite development port |
| `API_PROXY_TARGET` | blank | Optional backend URL override; blank derives `http://127.0.0.1:<FLASK_PORT>` |

Restart Flask after changing backend settings, and restart Vite after changing development settings. MySQL uses the `DB_*` settings; changing connection settings selects a different database and does not move existing data. Process environment variables override `.env` values. These settings are read on the server and are not injected into the React bundle.

## Quotation behavior

- Dashboard lists saved quotations, with customer and quotation-number search.
- The quotation screen supports billing and shipping details, GST and contacts, and a same-as-billing checkbox.
- Items support HSN, quantities, No's/kg/m, unit prices, percentage discounts, and 0%, 0.1%, 5%, 12%, or 18% tax.
- Warranty and service/replacement coverage are stored per item in the Warranty & Service panel.
- Delivery, quote validity, freight payment status, freight charges, and notes are saved with each quotation.
- Save assigns a quotation number; opening a saved quotation allows updates.
- Preview includes Print / PDF, using the browser print dialog.

Discounts apply before tax. The configured business state is Tamil Nadu. For a Tamil Nadu (or TN) billing address, the selected item tax rate is split equally into CGST and SGST, with each component rounded per item. For other billing states, the requested business rule applies IGST at 18% and locks the displayed item tax rate. The original selected rate is retained so switching back to Tamil Nadu restores it. With no billing state selected, the selected item rate is shown as unsplit GST. The summary, print preview, and Flask totals use the same rules. Freight is added without additional freight tax. The final amount including freight is rounded to the nearest whole rupee (50 paise rounds up). A signed Round Off row appears below GST in the summary and print preview, and the adjustment and rounded grand total are saved with the quotation.

Data is now stored in the MySQL database configured by `DB_NAME`. Historical database backup files remain untouched in `backend/instance`. Back up MySQL regularly with your database administration tools; old local backup files do not include new MySQL quotations.

Authentication uses database-backed sessions and server-side role checks. Use HTTPS or a trusted VPN for credentials and quotation data, and a production WSGI/frontend server for public deployment.
