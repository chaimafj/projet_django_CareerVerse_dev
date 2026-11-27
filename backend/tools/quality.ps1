$ErrorActionPreference = 'Stop'
New-Item -ItemType Directory -Force reports\quality | Out-Null

& .\.venv\Scripts\python.exe -m coverage erase
& .\.venv\Scripts\python.exe -m coverage run manage.py test academy
& .\.venv\Scripts\python.exe -m coverage report -m | Tee-Object reports\quality\coverage.txt
& .\.venv\Scripts\python.exe -m coverage xml -o reports\quality\coverage.xml
& .\.venv\Scripts\python.exe -m bandit -r academy -x academy\migrations,academy\tests -f json -o reports\quality\bandit.json
& .\.venv\Scripts\python.exe -m pip_audit -r requirements.txt -f json -o reports\quality\pip-audit.json
& .\.venv\Scripts\python.exe manage.py check --deploy
