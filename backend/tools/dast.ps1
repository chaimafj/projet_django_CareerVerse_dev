param([string]$HostUrl = "http://127.0.0.1:8000")

$ErrorActionPreference = 'Stop'
New-Item -ItemType Directory -Force reports\security | Out-Null
& .\.venv\Scripts\python.exe tools\dast_smoke.py $HostUrl | Tee-Object reports\security\dast.json
