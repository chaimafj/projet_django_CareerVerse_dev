from locust import HttpUser, between, task


class CareerVerseReader(HttpUser):
    wait_time = between(0.2, 1)

    @task(4)
    def list_careers(self):
        with self.client.get("/api/careers/", name="GET /api/careers/", catch_response=True) as response:
            if response.status_code != 200 or not isinstance(response.json(), list):
                response.failure(f"Unexpected catalogue response: {response.status_code}")

    @task(2)
    def career_health(self):
        with self.client.get("/api/careers/", name="GET catalogue compatibility", catch_response=True) as response:
            if "Content-Type" not in response.headers or "application/json" not in response.headers["Content-Type"]:
                response.failure("JSON response expected")

    @task(1)
    def csrf_bootstrap(self):
        with self.client.get("/api/csrf/", name="GET /api/csrf/", catch_response=True) as response:
            if response.status_code != 200:
                response.failure("CSRF bootstrap failed")
