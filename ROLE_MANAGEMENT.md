# Accounts and quotation approvals

## Roles

- **Admin:** manages accounts, sees all quotations and pending requests, edits quotations, approves them, and previews or prints PDFs.
- **User:** sees and edits their own quotations. Saving submits a pending request. Preview and Print / PDF are enabled only after approval. Unsaved changes block user preview; saving any changes requires fresh approval.
- Approval requests show the submitting account name, customer, product names, quantities, unit prices, and total. The notification count refreshes every 30 seconds, and immediately after saves and approvals.
- Approval and quotation ownership are checked by Flask. Requests cannot approve themselves by changing JSON fields. The preview API checks approval again, and user printing rechecks the approved revision.
- Users can still view the quotation form and their own submitted details while awaiting approval. The application blocks its preview/PDF actions; it cannot prevent someone copying information they are authorized to see.

## Update the Ubuntu server

From `/opt/weider_inventory`, using the root account selected for your existing services:

```bash
systemctl stop weider-frontend weider-backend
git pull --ff-only origin main
.venv/bin/python -m pip install -r backend/requirements.txt
npm --prefix frontend ci
.venv/bin/python backend/manage_db.py init
.venv/bin/python backend/manage_users.py create-admin --username admin --name "Administrator"
systemctl start weider-backend weider-frontend
```

If Git reports an ownership warning because the previous setup made `weider-app` the repository owner, run Git through that account instead: `runuser -u weider-app -- git -C /opt/weider_inventory pull --ff-only origin main`.

The administrator command prompts twice for a password of 10–128 characters. Passwords are hashed; there is no default account or shared password. Run `create-admin` only once for each new admin username. Existing administrators can create users and additional admins in **Accounts** after signing in. Editing an account supports changing its role, disabling it, or resetting its password; existing sessions for that account are invalidated. The final active admin cannot be disabled or demoted through the application.

The database initialization adds account, session, login-limit and approval tables. It preserves the existing quotation table and its records. Historical quotations without ownership are visible only to administrators and start pending approval. Back up the MySQL database before updating the deployed server.

Open the frontend on port 5173 and sign in. Keep the backend bound to localhost as configured in the existing Gunicorn service. Frontend and backend must use the same browser origin through the existing Vite `/api` proxy.

## Local Windows setup

```powershell
.venv\Scripts\python backend/manage_db.py init
.venv\Scripts\python backend/manage_users.py create-admin --username admin --name "Administrator"
.venv\Scripts\python backend/app.py
```

Run `npm run dev` in another terminal, then open `http://localhost:5173`.

## Password recovery

Use the server terminal:

```bash
.venv/bin/python backend/manage_users.py reset-password --username admin
```

This prompts for a replacement password and invalidates the account's sessions.

## Sessions and transport

Sessions expire after eight hours and are stored server-side with hashed session tokens. Cookies use HttpOnly and SameSite=Lax; changing requests also require a CSRF token. Ten failed sign-in attempts for a username and source IP trigger a 15-minute wait.

The current port-5173 HTTP development setup does not encrypt passwords or quotations in transit. Use it over a trusted network/VPN. For HTTPS deployments, set `AUTH_COOKIE_SECURE=true` in the server `.env` and restart the backend. Do not enable secure cookies on an HTTP-only URL, because the browser will not send them. `USER_CAN_PRINT_APPROVED=true` is the default agreed policy.

Vite remains a development server. These changes do not turn the frontend service into production hosting.
