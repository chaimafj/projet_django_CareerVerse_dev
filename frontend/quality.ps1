$ErrorActionPreference = 'Stop'
New-Item -ItemType Directory -Force reports\quality | Out-Null

npm run typecheck
npm run build
npm test
