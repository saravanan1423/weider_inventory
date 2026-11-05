$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
if (-not (Test-Path -LiteralPath '.env')) {
    Copy-Item -LiteralPath '.env.example' -Destination '.env'
}
$python = Join-Path $PSScriptRoot '.venv\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $python)) {
    python -m venv .venv
    if ($LASTEXITCODE -ne 0) { throw 'Could not create the Python environment.' }
}
& $python -m pip install -r backend/requirements.txt
if ($LASTEXITCODE -ne 0) { throw 'Could not install backend dependencies.' }
& $python backend/manage_db.py init
if ($LASTEXITCODE -ne 0) { throw 'Could not initialize the database. Check MySQL and the DB_* settings in .env.' }
if (-not (Test-Path -LiteralPath 'frontend/node_modules')) {
    npm --prefix frontend ci
    if ($LASTEXITCODE -ne 0) { throw 'Could not install frontend dependencies.' }
}
npm run build
if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed.' }
& $python backend/app.py
