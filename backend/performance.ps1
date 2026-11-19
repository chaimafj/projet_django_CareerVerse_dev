param(
    [string]$HostUrl = "http://127.0.0.1:8000",
    [int]$Users = 20,
    [int]$SpawnRate = 5,
    [string]$Duration = "30s"
)

$ErrorActionPreference = 'Stop'
New-Item -ItemType Directory -Force reports\performance | Out-Null
& .\.venv\Scripts\python.exe -m locust `
    --headless `
    --host $HostUrl `
    --users $Users `
    --spawn-rate $SpawnRate `
    --run-time $Duration `
    --csv reports\performance\locust `
    --html reports\performance\locust.html `
    --exit-code-on-error 1
