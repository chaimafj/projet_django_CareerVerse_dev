# Installation reproductible

## Option recommandée : Docker Compose

Prérequis : Docker Desktop ou un démon Docker, Git et 4 Go de mémoire.

```powershell
docker compose up --build
```

L'application est ensuite disponible sur <http://localhost:8080>.

Compose démarre PostgreSQL, Gunicorn/Django, Nginx et le worker de notifications.
La configuration est validée par `docker compose config`. Le secret et le mot de
passe fournis dans Compose sont strictement réservés à l'environnement local.

Avant production, définir des secrets externes, activer HTTPS, remplacer
`DJANGO_ALLOWED_HOSTS`, configurer les sauvegardes, Stripe, Google, SMTP et VAPID.

## Option locale Windows

```powershell
cd backend
py -3.13 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe manage.py migrate
.\.venv\Scripts\python.exe manage.py seed_demo
.\.venv\Scripts\python.exe manage.py seed_extended
.\.venv\Scripts\python.exe manage.py seed_premium
.\.venv\Scripts\python.exe manage.py runserver 127.0.0.1:8000
```

Dans un autre terminal :

```powershell
cd frontend
npm ci
npm start
```

Ouvrir <http://127.0.0.1:4200>.

## Justification technique

- Django REST Framework fournit sessions, permissions, sérialisation et administration.
- Angular/Ionic offre une SPA typée, responsive et accessible.
- SQLite simplifie l'installation locale ; PostgreSQL est retenu pour la portabilité
  et le déploiement reproductible.
- Playwright, Django Test, Locust, Coverage, Bandit, pip-audit et npm audit couvrent
  les couches exigées par le cahier ISO/IEC 25010.
