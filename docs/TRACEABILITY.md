# Matrice de traçabilité

| ID | Exigence | Implémentation | Test / outil | Résultat |
|---|---|---|---|---|
| F01 | Authentification | `academy/views.py`, `auth_extra.py` | Django `tests.py`, `test_auth_extra.py` | Passé |
| F02 | 3 rôles différenciés | `User.Role`, `permissions.py` | `test_compliance.py::test_three_distinct_roles_and_permissions` | Passé |
| F03 | Entités et relations | `models.py`, migration 0012 | Tests modèle/API | 12+ entités, 1-N et associations N-N |
| F04 | CRUD complet | APIs `admin/users`, `careers`, `labs`, `courses`, `questions`, `options` | `test_compliance.py::test_complete_crud_for_courses_questions_and_options` | Passé |
| F05 | Workflow à statuts | `CourseCompletion.Status` | `test_compliance.py::test_course_workflow_and_audit` | Passé |
| F06 | Tableau de bord | `ProgressView`, dashboard Angular | Tests frontend + API filtrée | Passé |
| F07 | Recherche/filtrage | `CareersPage` | Tests d'intégration frontend + E2E | Passé |
| F08 | Journal d'audit | `AuditLog`, `audit.py` | Test workflow et audit, API admin/audit | Passé |
| F09 | Règles métier | Services, accès, modèles | 121 tests Django | Passé |
| Q01 | Efficacité | API catalogue | Locust, 20 utilisateurs, 30 s | 731 requêtes, 0 échec, P95 25 ms |
| Q02 | Compatibilité | Build SPA | Playwright Chrome + Edge | 4/4 scénarios passés |
| Q03 | Facilité d'usage | Routes, labels, i18n, erreurs | Playwright + `verify-locales` | 1 042 entrées vérifiées |
| Q04 | Fiabilité | Transactions/snapshots/retry queue | Tests Stripe, labs, notifications | Passé |
| Q05 | Sécurité statique | Backend Python | Bandit | 0 alerte |
| Q06 | Sécurité dépendances | Manifests verrouillés | pip-audit + npm audit | 0 vulnérabilité |
| Q07 | Sécurité dynamique | Application en exécution | `dast_smoke.py` | 7 contrôles PASS |
| Q08 | Maintenabilité | Architecture en couches | Coverage, TypeScript, build | Couverture 95 % |
| Q09 | Portabilité | Dockerfiles + Compose | `docker compose config --quiet` | Configuration valide |

## Règles de preuve

- Les fichiers de rapport générés ne doivent pas être remplacés par des valeurs écrites à la main.
- Une commande non exécutable doit être marquée « non exécuté » avec sa cause.
- Les captures de soutenance doivent conserver navigateur, date, URL et résultat visible.
