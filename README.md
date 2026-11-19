# CareerVerse Web

A separate web implementation of CareerVerse, using **Ionic 8 + Angular 20**
for the frontend and **Django + Django REST Framework** for the API. 


## Prerequisites

- Node.js supported by Angular 20 (Node 24 is used locally).
- Python 3.12+.
- PostgreSQL is optional for local development; SQLite is the default.

## Run on Windows

Open two PowerShell terminals inside `CareerVerseAppWeb`.

### Backend

```powershell
Set-Location .\backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe manage.py migrate
.\.venv\Scripts\python.exe manage.py seed_demo
.\.venv\Scripts\python.exe manage.py seed_extended
.\.venv\Scripts\python.exe manage.py seed_premium
.\.venv\Scripts\python.exe manage.py runserver 127.0.0.1:8000
```

### Frontend

```powershell
Set-Location .\frontend
npm ci
npm start
```

Open **http://127.0.0.1:4200**. Register your own student account. There is no
hardcoded demo password.

Development creates an ignored local session-signing key in
`backend/.dev-secret-key`. Preserve it to keep sessions valid across restarts.
Production requires your own `DJANGO_SECRET_KEY` and `DJANGO_DEBUG=0`.

The frontend dev server proxies `/api/`, `/admin/` and `/static/` to Django.
Use the frontend origin for student requests so Django session and CSRF cookies
work together. Do not switch between `localhost` and `127.0.0.1` mid-session.

### Administration

```powershell
Set-Location .\backend
.\.venv\Scripts\python.exe manage.py createsuperuser
```

Visit **http://127.0.0.1:4200/admin/** and sign in with the staff account.
Student accounts cannot write catalogue content. Angular navigation guards are
only UX controls; actual access permissions are enforced by Django.

## Architecture

```text
frontend/src/app/
  core/              typed API client, session service, auth guard, models
  pages/             authentication, dashboard, careers, courses, quizzes,
                     results, recommendations, profile, career assistant
  app.component.ts   responsive navigation and theme
  app.routes.ts      Angular routes and unfinished-quiz exit guard
backend/
  config/            Django settings and URL configuration
  academy/           domain models, API views, serializers, admin, migrations,
                     catalogue seed command and automated tests
```

See [the backend README](backend/README.md) for the exact API and environment
configuration.

## Conformité ISO/IEC 25010

- [Rapport de conformité et architecture](docs/ISO25010.md)
- [Matrice de traçabilité](docs/TRACEABILITY.md)
- [Résultats et exécution des tests](docs/TEST-EXECUTION.md)
- [Installation reproductible](docs/INSTALLATION.md)

### PostgreSQL

SQLite requires no extra configuration. To use an existing PostgreSQL database,
set `DATABASE_URL` before running migrations and starting Django:

```powershell
$env:DATABASE_URL = 'postgresql://careerverse:<password>@127.0.0.1:5432/careerverse'
.\.venv\Scripts\python.exe manage.py migrate
.\.venv\Scripts\python.exe manage.py seed_demo
.\.venv\Scripts\python.exe manage.py seed_extended
.\.venv\Scripts\python.exe manage.py seed_premium
.\.venv\Scripts\python.exe manage.py runserver 127.0.0.1:8000
```

Replace the connection values with your own credentials. For a hosted database,
set `POSTGRES_SSLMODE` according to your provider's requirements.

## Quiz behavior

1. Starting a quiz creates a server-side attempt and a snapshot of its content.
2. Initial API responses contain options but never the correct answer flags.
3. The browser collects selections; Django validates question and option IDs.
4. On submission, Django determines elapsed time and calculates the score.
5. Each multiple-choice question requires the exact correct selection.
6. Submission is final; the result cannot be rewritten by another submission.
7. Feedback and explanations are returned after grading.

## Notifications interface

The signed-in header includes a bell with a red badge for the exact unread count;
the sidebar repeats the badge. Zero unread notifications hide the badge. The
owner-private `GET /api/notifications/count/` counts all unread records, even
though the inbox displays only the latest 50. Counts refresh on sign-in,
navigation, inbox refresh, successful read/deletion and every 30 seconds while
the page is visible. Account changes clear the count and discard stale responses.
Failures show a warning on the bell and an explicit retry in the inbox rather
than pretending there are no unread notifications. The redesigned inbox includes
read/unread filters, dated updates, keyboard access and a mobile/dark/RTL layout.

## Your matches interface

The recommendations page presents the existing server ranking in illustrated
cards: three columns on desktop, two on tablets and one on mobile. A summary shows
the returned career count, tested careers and highest score. Each card keeps the
server score, lab evidence, shared interests and career link; the top result is
highlighted without changing the scoring algorithm. The score explanation is
expandable. Dark mode, RTL and reduced-motion preferences are supported.

## Career assistant

The floating blue/violet guidance button opens the assistant in an Ionic modal without
leaving the current page. It is available to signed-in students, not in the
AppBar or main navigation. Suggested links close the modal and open the relevant
page; the saved conversation is restored when reopened. `/chat` remains a
direct full-page route and hides the floating button to avoid duplicate chats.
Both views share a professional conversation layout: guidance header, privacy
notice, suggested-question cards, distinct user/assistant messages, dated replies,
resource links and a focused question composer with a character counter.
Choosing a suggestion fills and focuses the input without sending it automatically.
The layout supports mobile, dark mode, RTL and reduced-motion preferences.

The assistant uses an authenticated Django endpoint:
`GET /api/chat/` loads history, `POST /api/chat/` accepts a `message`,
and `DELETE /api/chat/` clears only the signed-in student's history.
Messages are limited to 2,000 characters; the latest 50 exchanges are retained.
Replies, suggested routes and timestamps are saved alongside each message.

This is a transparent **rule-based assistant**, not a trained model or an
autonomous agent. It uses catalogue data and the student's own profile/results,
does not reveal quiz answers, and sends no data to external services.
English replies recognize some French topic keywords; full translated dialogue
is not implemented. Unknown topics receive an explicit limitations message.
Deleting an account also deletes its chat history.

## Languages

Choose English, French or Arabic in the header, including before sign-in.
The choice is persisted locally; Arabic sets the document to RTL. Interface
labels, controls, confirmation dialogs and dates follow the selected language.
Profile interests retain canonical stored values rather than translated IDs.
User-entered text is not translated.

Catalogue lessons, quiz questions/explanations and the local chatbot's replies
remain in English. A translated notice makes this limitation explicit.
Administrators may author additional content, but this version does not provide
automatic translation of database text or Django administration.

## Web Push and Stripe

These integrations require server configuration; they do not simulate successful
delivery or payment when credentials are missing. See
[backend setup](backend/README.md) for VAPID keys, the push delivery worker, test
Stripe credentials/price and Stripe CLI webhook forwarding.

### Local integration configuration (PowerShell)

From the backend directory, generate your own VAPID pair into an ignored file:

```powershell
.\.venv\Scripts\python.exe manage.py generate_vapid_keys > vapid-keys.local
```

Create the ignored `local-settings.ps1` locally and fill it with your own values:

```powershell
$env:VAPID_PUBLIC_KEY = '<generated public key>'
$env:VAPID_PRIVATE_KEY = '<generated private key>'
$env:VAPID_SUBJECT = 'mailto:<your contact email>'
$env:STRIPE_SECRET_KEY = '<your sk_test_ key>'
$env:STRIPE_WEBHOOK_SECRET = '<your test webhook signing secret>'
$env:STRIPE_PRICE_ID = '<your one-off test price ID>'
$env:WEB_APP_ORIGIN = 'http://127.0.0.1:4200'
```

This file is not loaded automatically. In each API/worker PowerShell terminal,
load it before starting the process:

```powershell
. .\local-settings.ps1
.\.venv\Scripts\python.exe manage.py runserver 127.0.0.1:8000
```

Use another terminal for delivery (the command is single-run, not a daemon):

```powershell
. .\local-settings.ps1
while ($true) {
  .\.venv\Scripts\python.exe manage.py send_push_notifications --limit 100
  Start-Sleep -Seconds 30
}
```

For Stripe test events, with the Stripe CLI installed and authenticated:

```powershell
stripe listen --events checkout.session.completed,checkout.session.async_payment_succeeded --forward-to http://127.0.0.1:8000/api/billing/webhook/
```

Use the signing secret from this listener in your local server environment,
then restart Django. No VAPID or Stripe credentials are supplied by the
repository. Never commit the local settings or key file. Tests mock providers;
they do not prove real payment or browser delivery.

## Validate

```powershell
# backend directory
.\.venv\Scripts\python.exe manage.py test
.\.venv\Scripts\python.exe manage.py check

# frontend directory
npm run typecheck
npm run build
npm test
```
