import json
import sys
from urllib.parse import quote

import requests


def check(condition, message):
    if not condition:
        raise AssertionError(message)


base = sys.argv[1].rstrip("/") if len(sys.argv) > 1 else "http://127.0.0.1:8000"
session = requests.Session()

csrf = session.get(f"{base}/api/csrf/", timeout=10)
check(csrf.status_code == 200, "CSRF bootstrap is unavailable")
check(session.cookies.get("csrftoken"), "CSRF cookie is missing")

anonymous = session.get(f"{base}/api/me/", headers={"Accept": "application/json"}, timeout=10)
check(anonymous.status_code in (401, 403), "Anonymous profile access was not denied")

csrf_missing = session.post(f"{base}/api/auth/register/", json={
    "name": "DAST", "email": "dast@example.test", "password": "Dast-password-123!",
}, headers={"Accept": "application/json"}, timeout=10)
check(csrf_missing.status_code in (403, 400), "Registration without CSRF was not rejected")

for payload in ("' OR 1=1 --", "<script>alert(1)</script>", quote("../../etc/passwd")):
    response = session.get(f"{base}/api/careers/{payload}/", headers={"Accept": "application/json"}, timeout=10)
    check(response.status_code in (400, 404), f"Injection-like request was unexpectedly accepted: {response.status_code}")
    check("<script>alert(1)</script>" not in response.text, "Reflected script payload was returned")

oversized_headers = ",".join(["application/json"] * 2000)
header_response = session.get(
    f"{base}/api/careers/",
    headers={"Accept": oversized_headers},
    timeout=10,
)
check(header_response.status_code in (406, 400, 431), "Oversized Accept header was not rejected safely")

result = {
    "target": base,
    "checks": 7,
    "csrf_cookie": True,
    "anonymous_access_denied": True,
    "csrf_enforced": True,
    "injection_payloads_rejected": True,
    "oversized_header_rejected": True,
    "result": "PASS",
}
print(json.dumps(result, indent=2))
