# Exécution des tests et preuves

## État vérifié le 18 novembre 2026

| Couche | Commande | Résultat |
|---|---|---|
| Backend unitaire/API | `python manage.py test academy` | 121 tests réussis |
| Couverture | `coverage run --source=academy manage.py test academy` | 95 % |
| Sécurité statique | Bandit | 0 alerte |
| Dépendances Python | pip-audit | 0 vulnérabilité |
| Dépendances JavaScript | npm audit | 0 vulnérabilité |
| TypeScript | `npm run typecheck` | Réussi |
| Build production | `npm run build` | Réussi |
| Intégrité frontend | `npm test` | Réussi |
| E2E Chrome/Edge | `npm run test:e2e` | 4/4 réussis |
| DAST | `backend\dast.ps1` | 7/7 contrôles réussis |
| Charge | `backend\performance.ps1` | 731 requêtes, 0 échec, P95 25 ms |
| Compose | `docker compose config --quiet` | Valide |

## Ordre recommandé

```powershell
# Backend
cd backend
.\.venv\Scripts\python.exe -m pip install -r requirements-quality.txt
.\.venv\Scripts\python.exe manage.py migrate
.\.venv\Scripts\python.exe manage.py test academy
.\quality.ps1

# Frontend
cd ..\frontend
npm ci
npm run typecheck
npm test
npm run build
```

Pour l'E2E, démarrer Django sur 8000 et Angular sur 4200, puis exécuter :

```powershell
npm run test:e2e
```

Pour la charge et le DAST, les deux serveurs étant démarrés :

```powershell
cd ..\backend
.\performance.ps1 -Users 20 -Duration 30s
.\dast.ps1
```

## Captures de démonstration

Prendre des captures pour :

1. inscription, connexion et erreur accessible ;
2. tableau de bord filtré ;
3. recherche et détail d'un métier ;
4. workflow de cours `in_progress` puis `completed` ;
5. lab, résultat, correction et notification ;
6. les trois rôles et le journal d'audit ;
7. rapports Playwright, couverture et Locust ;
8. résumés Bandit, pip-audit et npm audit.
