from collections import defaultdict
from math import floor

from django.contrib.auth import authenticate, login, logout
from django.db import IntegrityError, transaction
from django.db.models import Avg, Max
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from django.views.decorators.http import require_GET
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Attempt, AuditLog, Career, Course, CourseCompletion, Lab, Result, User
from .serializers import (
    CareerSerializer, CourseSerializer, LoginSerializer, ProfileSerializer,
    RegisterSerializer, ResultSerializer, SubmitSerializer,
)
from .services import SNAPSHOT_VERSION, grade, lab_results, public_attempt, snapshot_lab
from .access import premium_active, require_lab_access
from .push import enqueue_notification, welcome_once
from .careernet import CareerNet
from .audit import audit
from .permissions import IsAdministrator, IsContentEditor


def welcome_language(request):
    language = request.headers.get("Accept-Language", "en").split(",")[0].split(";")[0].strip().lower().split("-")[0]
    return language if language in ("en", "fr", "ar") else "en"


def csrf_failure(request, reason=""):
    return JsonResponse({"detail": "CSRF verification failed."}, status=403)


@ensure_csrf_cookie
@require_GET
def csrf(request):
    return JsonResponse({"detail": "CSRF cookie set."})


@method_decorator(csrf_protect, name="dispatch")
class RegisterView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            with transaction.atomic():
                user = User.objects.create_user(**serializer.validated_data)
                welcome_once(user, welcome_language(request))
        except IntegrityError:
            if User.objects.filter(email__iexact=serializer.validated_data["email"]).exists():
                raise ValidationError({"email": "An account with this email already exists."})
            raise
        login(request, user)
        audit(request, "auth.registered", user)
        return Response(ProfileSerializer(user).data, status=status.HTTP_201_CREATED)


@method_decorator(csrf_protect, name="dispatch")
class LoginView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = authenticate(
            request,
            email=serializer.validated_data["email"].strip().lower(),
            password=serializer.validated_data["password"],
        )
        if user is None:
            return Response({"detail": "Invalid email or password."}, status=400)
        welcome_once(user, welcome_language(request))
        login(request, user)
        audit(request, "auth.logged_in", user)
        return Response(ProfileSerializer(user).data)


@method_decorator(csrf_protect, name="dispatch")
class LogoutView(APIView):
    def post(self, request):
        user = request.user
        audit(request, "auth.logged_out", object_type="academy.User", object_id=user.pk)
        logout(request)
        return Response({"detail": "Logged out."})


class MeView(APIView):
    def get(self, request):
        return Response(ProfileSerializer(request.user).data)

    def patch(self, request):
        serializer = ProfileSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        audit(request, "profile.updated", request.user)
        return Response(serializer.data)


@method_decorator(csrf_protect, name="dispatch")
class AdminUserListCreateView(APIView):
    permission_classes = [IsAdministrator]

    def get(self, request):
        return Response([
            {
                "id": user.id,
                "email": user.email,
                "name": user.name,
                "is_staff": user.is_staff,
                "is_superuser": user.is_superuser,
                "is_active": user.is_active,
                "role": user.role,
            }
            for user in User.objects.order_by("email")
        ])

    def post(self, request):
        email = str(request.data.get("email", "")).strip().lower()
        name = str(request.data.get("name", "")).strip()
        password = request.data.get("password")
        is_staff = bool(request.data.get("is_staff", False))
        is_superuser = bool(request.data.get("is_superuser", False))
        is_active = bool(request.data.get("is_active", True))
        role = request.data.get("role", User.Role.STUDENT)

        if not email or not name or not password:
            return Response({"detail": "Email, name and password are required."}, status=400)

        if User.objects.filter(email__iexact=email).exists():
            return Response({"email": "An account with this email already exists."}, status=400)

        if role not in User.Role.values:
            return Response({"role": "Invalid role."}, status=400)
        user = User.objects.create_user(
            email=email,
            password=password,
            name=name,
            is_staff=is_staff or is_superuser,
            is_superuser=is_superuser,
            is_active=is_active,
            role=role,
        )
        audit(request, "user.created", user)

        return Response({
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "is_staff": user.is_staff,
            "is_superuser": user.is_superuser,
            "is_active": user.is_active,
            "role": user.role,
        }, status=201)


@method_decorator(csrf_protect, name="dispatch")
class AdminUserDetailView(APIView):
    permission_classes = [IsAdministrator]

    def get(self, request, pk):
        user = get_object_or_404(User, pk=pk)
        return Response({
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "is_staff": user.is_staff,
            "is_superuser": user.is_superuser,
            "is_active": user.is_active,
            "role": user.role,
        })

    def patch(self, request, pk):
        user = get_object_or_404(User, pk=pk)
        payload = request.data or {}
        email = str(payload.get("email", user.email)).strip().lower()
        name = str(payload.get("name", user.name)).strip()
        password = payload.get("password")
        is_staff = payload.get("is_staff", user.is_staff)
        is_superuser = payload.get("is_superuser", user.is_superuser)
        is_active = payload.get("is_active", user.is_active)
        role = str(payload.get("role", user.role))
        if "role" not in payload:
            if bool(payload.get("is_superuser", user.is_superuser)):
                role = User.Role.ADMIN
            elif "is_staff" in payload and bool(payload["is_staff"]):
                role = User.Role.EDITOR

        if not email or not name:
            return Response({"detail": "Email and name are required."}, status=400)
        if role not in User.Role.values:
            return Response({"role": "Invalid role."}, status=400)
        if email != user.email and User.objects.filter(email__iexact=email).exists():
            return Response({"email": "An account with this email already exists."}, status=400)

        user.email = email
        user.name = name
        user.is_staff = bool(is_staff) or bool(is_superuser)
        user.is_superuser = bool(is_superuser)
        user.is_active = bool(is_active)
        user.role = role
        if password:
            user.set_password(str(password))
        user.save(update_fields=["email", "name", "is_staff", "is_superuser", "is_active", "role", "password"])
        audit(request, "user.updated", user)
        return Response({
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "is_staff": user.is_staff,
            "is_superuser": user.is_superuser,
            "is_active": user.is_active,
            "role": user.role,
        })

    def delete(self, request, pk):
        user = get_object_or_404(User, pk=pk)
        if user == request.user:
            return Response({"detail": "You cannot delete your own admin account."}, status=400)
        user.delete()
        audit(request, "user.deleted", object_type="academy.User", object_id=pk)
        return Response(status=204)


@method_decorator(csrf_protect, name="dispatch")
class AdminCareerListCreateView(APIView):
    permission_classes = [IsContentEditor]

    def get(self, request):
        return Response([
            {
                "id": career.id,
                "slug": career.slug,
                "title": career.title,
                "summary": career.summary,
                "description": career.description,
                "category": career.category,
                "tools": career.tools,
                "interests": career.interests,
                "salary": career.salary,
                "education": career.education,
                "outlook": career.outlook,
            }
            for career in Career.objects.order_by("title")
        ])

    def post(self, request):
        payload = request.data or {}
        required = ["slug", "title", "summary", "description", "category", "salary", "education", "outlook"]
        if not all(str(payload.get(field, "")).strip() for field in required):
            return Response({"detail": "Missing required career fields."}, status=400)
        slug = str(payload["slug"]).strip()
        data = {
            "slug": slug,
            "title": str(payload["title"]).strip(),
            "summary": str(payload["summary"]).strip(),
            "description": str(payload["description"]).strip(),
            "category": str(payload["category"]).strip(),
            "tools": payload.get("tools", []) if isinstance(payload.get("tools", []), list) else [str(payload.get("tools", ""))],
            "interests": payload.get("interests", []) if isinstance(payload.get("interests", []), list) else [str(payload.get("interests", ""))],
            "salary": str(payload["salary"]).strip(),
            "education": str(payload["education"]).strip(),
            "outlook": str(payload["outlook"]).strip(),
        }
        if Career.objects.filter(slug__iexact=slug).exists():
            return Response({"slug": "A career with this slug already exists."}, status=400)
        career = Career.objects.create(**data)
        audit(request, "career.created", career)
        return Response({
            "id": career.id,
            "slug": career.slug,
            "title": career.title,
            "summary": career.summary,
            "description": career.description,
            "category": career.category,
            "tools": career.tools,
            "interests": career.interests,
            "salary": career.salary,
            "education": career.education,
            "outlook": career.outlook,
        }, status=201)


@method_decorator(csrf_protect, name="dispatch")
class AdminCareerDetailView(APIView):
    permission_classes = [IsContentEditor]

    def patch(self, request, pk):
        career = get_object_or_404(Career, pk=pk)
        payload = request.data or {}
        slug = str(payload.get("slug", career.slug)).strip()
        title = str(payload.get("title", career.title)).strip()
        summary = str(payload.get("summary", career.summary)).strip()
        description = str(payload.get("description", career.description)).strip()
        category = str(payload.get("category", career.category)).strip()
        salary = str(payload.get("salary", career.salary)).strip()
        education = str(payload.get("education", career.education)).strip()
        outlook = str(payload.get("outlook", career.outlook)).strip()

        required = [slug, title, summary, description, category, salary, education, outlook]
        if not all(required):
            return Response({"detail": "Missing required career fields."}, status=400)

        def parse_list(value, existing):
            if value is None:
                return existing
            if isinstance(value, list):
                return [str(item).strip() for item in value if str(item).strip()]
            if isinstance(value, str):
                items = [part.strip() for part in value.split(",")]
                return [item for item in items if item]
            return existing

        tools = parse_list(payload.get("tools", career.tools), career.tools)
        interests = parse_list(payload.get("interests", career.interests), career.interests)

        if slug != career.slug and Career.objects.filter(slug__iexact=slug).exists():
            return Response({"slug": "A career with this slug already exists."}, status=400)

        career.slug = slug
        career.title = title
        career.summary = summary
        career.description = description
        career.category = category
        career.tools = tools
        career.interests = interests
        career.salary = salary
        career.education = education
        career.outlook = outlook
        career.save()
        audit(request, "career.updated", career)
        return Response({
            "id": career.id,
            "slug": career.slug,
            "title": career.title,
            "summary": career.summary,
            "description": career.description,
            "category": career.category,
            "tools": career.tools,
            "interests": career.interests,
            "salary": career.salary,
            "education": career.education,
            "outlook": career.outlook,
        })

    def delete(self, request, pk):
        career = get_object_or_404(Career, pk=pk)
        career.delete()
        audit(request, "career.deleted", object_type="academy.Career", object_id=pk)
        return Response(status=204)


@method_decorator(csrf_protect, name="dispatch")
class AdminLabListCreateView(APIView):
    permission_classes = [IsContentEditor]

    def get(self, request):
        return Response([
            {
                "id": lab.id,
                "career_id": lab.career_id,
                "career_title": lab.career.title,
                "title": lab.title,
                "level": lab.level,
                "scenario": lab.scenario,
                "objectives": lab.objectives,
                "expected_seconds": lab.expected_seconds,
                "is_premium": lab.is_premium,
                "question_count": lab.questions.count(),
            }
            for lab in Lab.objects.select_related("career").order_by("career__title", "title")
        ])

    def post(self, request):
        payload = request.data or {}
        career_id = payload.get("career_id")
        title = str(payload.get("title", "")).strip()
        scenario = str(payload.get("scenario", "")).strip()
        objectives = payload.get("objectives", [])
        level = payload.get("level", 1)
        expected_seconds = payload.get("expected_seconds", 180)
        is_premium = bool(payload.get("is_premium", False))

        if not career_id or not title:
            return Response({"detail": "Career and title are required."}, status=400)
        try:
            career = Career.objects.get(pk=career_id)
        except Career.DoesNotExist:
            return Response({"career_id": "Career not found."}, status=400)
        if not isinstance(objectives, list):
            objectives = [str(objectives)] if str(objectives).strip() else []
        lab = Lab.objects.create(
            career=career,
            title=title,
            level=int(level),
            scenario=scenario,
            objectives=[str(item).strip() for item in objectives if str(item).strip()],
            expected_seconds=int(expected_seconds),
            is_premium=is_premium,
        )
        audit(request, "lab.created", lab)
        return Response({
            "id": lab.id,
            "career_id": lab.career_id,
            "career_title": lab.career.title,
            "title": lab.title,
            "level": lab.level,
            "scenario": lab.scenario,
            "objectives": lab.objectives,
            "expected_seconds": lab.expected_seconds,
            "is_premium": lab.is_premium,
            "question_count": lab.questions.count(),
        }, status=201)


@method_decorator(csrf_protect, name="dispatch")
class AdminLabDetailView(APIView):
    permission_classes = [IsContentEditor]

    def patch(self, request, pk):
        lab = get_object_or_404(Lab, pk=pk)
        payload = request.data or {}
        if "career_id" in payload:
            career_id = payload.get("career_id")
            try:
                career = Career.objects.get(pk=career_id)
            except Career.DoesNotExist:
                return Response({"career_id": "Career not found."}, status=400)
            lab.career = career
        if "title" in payload:
            title = str(payload.get("title", lab.title)).strip()
            if not title:
                return Response({"detail": "Title is required."}, status=400)
            lab.title = title
        if "level" in payload:
            lab.level = int(payload.get("level", lab.level))
        if "scenario" in payload:
            lab.scenario = str(payload.get("scenario", lab.scenario)).strip()
        if "objectives" in payload:
            objectives = payload.get("objectives", lab.objectives)
            if not isinstance(objectives, list):
                objectives = [str(objectives)] if str(objectives).strip() else []
            lab.objectives = [str(item).strip() for item in objectives if str(item).strip()]
        if "expected_seconds" in payload:
            lab.expected_seconds = int(payload.get("expected_seconds", lab.expected_seconds))
        if "is_premium" in payload:
            lab.is_premium = bool(payload.get("is_premium", lab.is_premium))
        lab.full_clean()
        lab.save()
        audit(request, "lab.updated", lab)
        return Response({
            "id": lab.id,
            "career_id": lab.career_id,
            "career_title": lab.career.title,
            "title": lab.title,
            "level": lab.level,
            "scenario": lab.scenario,
            "objectives": lab.objectives,
            "expected_seconds": lab.expected_seconds,
            "is_premium": lab.is_premium,
            "question_count": lab.questions.count(),
        })

    def delete(self, request, pk):
        lab = get_object_or_404(Lab, pk=pk)
        lab.delete()
        audit(request, "lab.deleted", object_type="academy.Lab", object_id=pk)
        return Response(status=204)


class CareerListView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response(CareerSerializer(Career.objects.all(), many=True).data)


class CareerDetailView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, slug):
        career = get_object_or_404(Career, slug=slug)
        completed = set()
        best = {}
        history = lab_results(request.user, attempt__lab__career=career)
        if request.user.is_authenticated:
            completed = set(
                CourseCompletion.objects.filter(user=request.user, course__career=career, status=CourseCompletion.Status.COMPLETED)
                .values_list("course_id", flat=True)
            )
            best = dict(
                Result.objects.filter(attempt__user=request.user, attempt__lab__career=career)
                .values("attempt__lab_id")
                .annotate(best=Max("score"))
                .values_list("attempt__lab_id", "best")
            )
        data = CareerSerializer(career).data
        from .assessment import career_assessment
        data["assessment"] = career_assessment(request.user, career)
        data["courses"] = [
            {"id": course.id, "title": course.title, "completed": course.id in completed, "lab_id": course.lab_id,
             "is_premium": course.lab.is_premium, "locked": course.lab.is_premium and not premium_active(request.user)}
            for course in career.courses.select_related("lab").all()
        ]
        data["labs"] = [
            {
                "id": lab.id, "title": lab.title, "level": lab.get_level_display(),
                "question_count": lab.questions.count(), "best_score": best.get(lab.id),
                "is_premium": lab.is_premium, "locked": lab.is_premium and not premium_active(request.user),
                "scenario": lab.scenario, "objectives": lab.objectives, "expected_seconds": lab.expected_seconds,
                "completed": bool(history.get(lab.id)), "attempt_count": len(history.get(lab.id, [])),
                "latest_result": history.get(lab.id, [None])[0],
            }
            for lab in career.labs.prefetch_related("questions").all()
        ]
        return Response(data)


class CareerAssessmentView(APIView):
    def get(self, request, slug):
        from .assessment import career_assessment
        career = get_object_or_404(Career, slug=slug)
        return Response(career_assessment(request.user, career))


class CareerAssessmentListView(APIView):
    def get(self, request):
        from .assessment import career_assessment
        return Response([career_assessment(request.user, career) for career in Career.objects.all()])


class CourseView(APIView):
    def get(self, request, pk):
        course = get_object_or_404(Course.objects.select_related("career", "lab"), pk=pk)
        require_lab_access(request.user, course.lab)
        data = CourseSerializer(course).data
        data["completed"] = CourseCompletion.objects.filter(
            user=request.user, course=course, status=CourseCompletion.Status.COMPLETED
        ).exists()
        return Response(data)


class CourseListView(APIView):
    def get(self, request):
        completed = set(CourseCompletion.objects.filter(
            user=request.user, status=CourseCompletion.Status.COMPLETED
        ).values_list("course_id", flat=True))
        premium = premium_active(request.user)
        return Response([
            {
                "id": course.id, "title": course.title, "career_slug": course.career.slug,
                "career_title": course.career.title, "completed": course.id in completed,
                "is_premium": course.lab.is_premium, "locked": course.lab.is_premium and not premium,
            }
            for course in Course.objects.select_related("career", "lab").all()
        ])


class LabListView(APIView):
    def get(self, request):
        history = lab_results(request.user)
        premium = premium_active(request.user)
        return Response([
            {
                "id": lab.id, "title": lab.title, "career_slug": lab.career.slug,
                "career_title": lab.career.title, "level": lab.get_level_display(),
                "scenario": lab.scenario, "question_count": lab.questions.count(),
                "expected_seconds": lab.expected_seconds, "is_premium": lab.is_premium,
                "locked": lab.is_premium and not premium, "completed": bool(history.get(lab.id)),
                "attempt_count": len(history.get(lab.id, [])), "latest_result": history.get(lab.id, [None])[0],
            }
            for lab in Lab.objects.select_related("career").prefetch_related("questions").all()
        ])


class CompleteCourseView(APIView):
    def post(self, request, pk):
        course = get_object_or_404(Course, pk=pk)
        require_lab_access(request.user, course.lab)
        completion, _ = CourseCompletion.objects.get_or_create(
            user=request.user, course=course, defaults={"status": CourseCompletion.Status.IN_PROGRESS}
        )
        if completion.status != CourseCompletion.Status.IN_PROGRESS:
            if completion.status == CourseCompletion.Status.COMPLETED:
                return Response({"id": course.id, "completed": True})
            return Response({"detail": "Invalid course transition."}, status=409)
        completion.status = CourseCompletion.Status.COMPLETED
        completion.completed_at = timezone.now()
        completion.save(update_fields=["status", "completed_at", "updated_at"])
        audit(request, "course.completed", completion)
        return Response({"id": course.id, "completed": True})


class StartCourseView(APIView):
    def post(self, request, pk):
        course = get_object_or_404(Course, pk=pk)
        require_lab_access(request.user, course.lab)
        completion, created = CourseCompletion.objects.get_or_create(
            user=request.user, course=course, defaults={"status": CourseCompletion.Status.IN_PROGRESS}
        )
        if created:
            audit(request, "course.started", completion)
        return Response({
            "id": course.id,
            "status": completion.status,
            "completed": completion.status == CourseCompletion.Status.COMPLETED,
        })


class StartLabView(APIView):
    def post(self, request, pk):
        lab = get_object_or_404(Lab.objects.select_related("career"), pk=pk)
        require_lab_access(request.user, lab)
        snapshot = snapshot_lab(lab)
        attempt = Attempt.objects.create(
            user=request.user, lab=lab, snapshot=snapshot, schema_version=SNAPSHOT_VERSION
        )
        return Response(public_attempt(attempt), status=201)


class LabDetailView(APIView):
    def get(self, request, pk):
        lab = get_object_or_404(Lab.objects.select_related("career"), pk=pk)
        history = lab_results(request.user, attempt__lab=lab).get(lab.id, [])
        return Response({
            "id": lab.id, "title": lab.title, "career_title": lab.career.title,
            "career_slug": lab.career.slug, "level": lab.get_level_display(),
            "is_premium": lab.is_premium, "locked": lab.is_premium and not premium_active(request.user),
            "scenario": lab.scenario, "objectives": lab.objectives,
            "expected_seconds": lab.expected_seconds, "question_count": lab.questions.count(),
            "completed": bool(history), "attempt_count": len(history),
            "latest_result": history[0] if history else None, "results": history,
        })


class SubmitAttemptView(APIView):
    def post(self, request, pk):
        with transaction.atomic():
            attempt = get_object_or_404(
                Attempt.objects.select_for_update().filter(user=request.user), pk=pk
            )
            if attempt.submitted_at:
                return Response({"detail": "This attempt has already been submitted."}, status=409)
            if attempt.schema_version != SNAPSHOT_VERSION:
                return Response({"detail": "Unsupported attempt snapshot version."}, status=409)
            serializer = SubmitSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            submitted_at = timezone.now()
            elapsed = max(0, int((submitted_at - attempt.started_at).total_seconds()))
            graded = grade(attempt.snapshot, serializer.validated_data["answers"], elapsed)
            # Conditional claim also guards replay where row locks are unavailable.
            claimed = Attempt.objects.filter(pk=pk, submitted_at__isnull=True).update(
                submitted_at=submitted_at
            )
            if not claimed:
                return Response({"detail": "This attempt has already been submitted."}, status=409)
            result = Result.objects.create(attempt=attempt, **graded)
            audit(request, "lab.submitted", result)
            enqueue_notification(request.user, "lab", f"/results/{result.pk}")
        return Response(ResultSerializer(result).data, status=201)


class ResultView(APIView):
    def get(self, request, pk):
        result = get_object_or_404(Result.objects.select_related("attempt").filter(attempt__user=request.user), pk=pk)
        return Response(ResultSerializer(result).data)


class ProgressView(APIView):
    def get(self, request):
        results = Result.objects.filter(attempt__user=request.user)
        career_slug = request.query_params.get("career")
        since = request.query_params.get("since")
        if career_slug:
            results = results.filter(career_slug=career_slug)
        if since:
            try:
                since_date = timezone.datetime.fromisoformat(since.replace("Z", "+00:00")).date()
            except ValueError:
                return Response({"since": "Use an ISO-8601 date."}, status=400)
            results = results.filter(completed_at__date__gte=since_date)
        completions = CourseCompletion.objects.filter(
            user=request.user, status=CourseCompletion.Status.COMPLETED
        )
        labs = Lab.objects.all()
        if career_slug:
            completions = completions.filter(course__career__slug=career_slug)
            labs = labs.filter(career__slug=career_slug)
        if since:
            completions = completions.filter(completed_at__date__gte=since_date)
        return Response({
            "completed_labs": results.filter(attempt__lab__isnull=False)
            .values("attempt__lab_id").distinct().count(),
            "total_labs": labs.count(),
            "average_score": round(results.aggregate(value=Avg("score"))["value"] or 0, 2),
            "completed_courses": completions.count(),
            "results": [
                {
                    "id": result.id, "career_title": result.career_title,
                    "lab_title": result.lab_title, "score": result.score,
                    "completed_at": result.completed_at.isoformat(),
                }
                for result in results
            ],
        })


class AdminAuditLogView(APIView):
    permission_classes = [IsAdministrator]

    def get(self, request):
        return Response([
            {
                "id": event.id,
                "actor": event.actor.email if event.actor else None,
                "action": event.action,
                "object_type": event.object_type,
                "object_id": event.object_id,
                "metadata": event.metadata,
                "ip_address": event.ip_address,
                "path": event.path,
                "created_at": event.created_at.isoformat(),
            }
            for event in AuditLog.objects.select_related("actor")[:200]
        ])


class RecommendationsView(APIView):
    def get(self, request):
        best = defaultdict(dict)
        for result in Result.objects.filter(attempt__user=request.user).select_related("attempt"):
            slug = result.career_slug
            lab_id = result.attempt.snapshot["lab_id"]
            best[slug][lab_id] = max(best[slug].get(lab_id, 0), result.score)

        user_interests = request.user.interests or []
        model = CareerNet()
        recommendations = []
        for career in Career.objects.all():
            career_interests = career.interests or []
            shared = sorted({value.strip().lower() for value in user_interests if isinstance(value, str)} &
                            {value.strip().lower() for value in career_interests if isinstance(value, str)})
            interest_score = model.score(user_interests, career_interests)
            scores = list(best[career.slug].values())
            performance = round(sum(scores) / len(scores), 2) if scores else 0
            match_score = (
                0.75 * performance + 0.25 * interest_score
                if scores else 0.6 * interest_score
            )
            recommendations.append({
                "career_slug": career.slug, "career_title": career.title,
                "score": floor(match_score + 0.5),
                "tested": bool(scores), "performance": performance, "shared_interests": shared,
            })
        recommendations.sort(key=lambda item: (-item["score"], item["career_slug"]))
        return Response(recommendations)
