from datetime import timedelta

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from .models import AuditLog, Career, Course, CourseCompletion, Lab, Option, Question, Result, User


class ComplianceTests(TestCase):
    password = "Compliance-pass-123!"

    def setUp(self):
        self.student = User.objects.create_user("student@example.test", self.password, name="Student")
        self.editor = User.objects.create_user(
            "editor@example.test", self.password, name="Editor", role=User.Role.EDITOR
        )
        self.admin = User.objects.create_user(
            "admin@example.test", self.password, name="Admin", role=User.Role.ADMIN
        )
        self.career = Career.objects.create(
            slug="quality", title="Quality Engineer", summary="Quality",
            description="Testing", category="Software", tools=[], interests=[],
            salary="Indicative", education="Degree", outlook="Stable",
        )
        self.lab = Lab.objects.create(
            career=self.career, title="Quality lab", level=1, expected_seconds=60,
            scenario="Test", objectives=[],
        )
        self.client = APIClient()

    def authenticate(self, user):
        self.client.force_authenticate(user=user)

    def test_three_distinct_roles_and_permissions(self):
        self.assertFalse(self.student.is_staff)
        self.assertTrue(self.editor.is_staff)
        self.assertTrue(self.admin.is_staff)
        self.authenticate(self.student)
        self.assertEqual(self.client.get("/api/admin/courses/").status_code, 403)
        self.assertEqual(self.client.get("/api/admin/users/").status_code, 403)
        self.authenticate(self.editor)
        self.assertEqual(self.client.get("/api/admin/courses/").status_code, 200)
        self.assertEqual(self.client.get("/api/admin/users/").status_code, 403)
        self.authenticate(self.admin)
        self.assertEqual(self.client.get("/api/admin/users/").status_code, 200)

    def test_complete_crud_for_courses_questions_and_options(self):
        self.authenticate(self.editor)
        course = self.client.post("/api/admin/courses/", {
            "career": self.career.pk, "lab": self.lab.pk, "title": "Course",
            "intro": "Intro", "lessons": [],
        }, format="json")
        self.assertEqual(course.status_code, 201)
        course_id = course.data["id"]
        self.assertEqual(self.client.patch(
            f"/api/admin/courses/{course_id}/", {"title": "Updated"}, format="json"
        ).status_code, 200)

        question = self.client.post("/api/admin/questions/", {
            "lab": self.lab.pk, "position": 1, "prompt": "Question", "multiple": False,
            "explanation": "Because", "skill": "Testing", "kind": "quiz", "workspace": {},
        }, format="json")
        self.assertEqual(question.status_code, 201)
        question_id = question.data["id"]

        option = self.client.post("/api/admin/options/", {
            "question": question_id, "position": 1, "text": "Answer", "correct": True,
        }, format="json")
        self.assertEqual(option.status_code, 201)
        option_id = option.data["id"]
        self.assertEqual(self.client.delete(f"/api/admin/options/{option_id}/").status_code, 204)
        self.assertEqual(self.client.delete(f"/api/admin/questions/{question_id}/").status_code, 204)
        self.assertEqual(self.client.delete(f"/api/admin/courses/{course_id}/").status_code, 204)

    def test_course_workflow_and_audit(self):
        course = Course.objects.create(
            career=self.career, lab=self.lab, title="Course", intro="Intro", lessons=[]
        )
        self.authenticate(self.student)
        started = self.client.post(f"/api/courses/{course.pk}/start/")
        self.assertEqual(started.status_code, 200)
        self.assertEqual(started.data["status"], CourseCompletion.Status.IN_PROGRESS)
        completed = self.client.post(f"/api/courses/{course.pk}/complete/")
        self.assertEqual(completed.status_code, 200)
        progress = CourseCompletion.objects.get(user=self.student, course=course)
        self.assertEqual(progress.status, CourseCompletion.Status.COMPLETED)
        self.assertIsNotNone(progress.completed_at)
        self.assertTrue(AuditLog.objects.filter(
            actor=self.student, action="course.completed", object_id=str(progress.pk)
        ).exists())

    def test_progress_filters_results_and_courses(self):
        course = Course.objects.create(
            career=self.career, lab=self.lab, title="Course", intro="Intro", lessons=[]
        )
        completion = CourseCompletion.objects.create(user=self.student, course=course)
        completion.completed_at = timezone.now() - timedelta(days=10)
        completion.save(update_fields=["completed_at"])
        self.authenticate(self.student)
        recent = self.client.get("/api/progress/", {"since": (timezone.now() - timedelta(days=1)).date().isoformat()})
        self.assertEqual(recent.status_code, 200)
        self.assertEqual(recent.data["completed_courses"], 0)
        old = self.client.get("/api/progress/", {"since": (timezone.now() - timedelta(days=30)).date().isoformat()})
        self.assertEqual(old.data["completed_courses"], 1)

        invalid = self.client.get("/api/progress/", {"since": "not-a-date"})
        self.assertEqual(invalid.status_code, 400)
