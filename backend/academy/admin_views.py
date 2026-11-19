from rest_framework import viewsets

from .audit import audit
from .models import Course, Option, Question
from .permissions import IsContentEditor
from .serializers import AdminCourseSerializer, AdminOptionSerializer, AdminQuestionSerializer


class AuditedModelViewSet(viewsets.ModelViewSet):
    permission_classes = [IsContentEditor]

    def perform_create(self, serializer):
        instance = serializer.save()
        audit(self.request, f"{instance._meta.model_name}.created", instance)

    def perform_update(self, serializer):
        instance = serializer.save()
        audit(self.request, f"{instance._meta.model_name}.updated", instance)

    def perform_destroy(self, instance):
        model_name = instance._meta.model_name
        instance_id = instance.pk
        instance.delete()
        audit(self.request, f"{model_name}.deleted", object_type=model_name, object_id=instance_id)


class AdminCourseViewSet(AuditedModelViewSet):
    queryset = Course.objects.select_related("career", "lab").order_by("career__title", "id")
    serializer_class = AdminCourseSerializer


class AdminQuestionViewSet(AuditedModelViewSet):
    queryset = Question.objects.select_related("lab").order_by("lab_id", "position")
    serializer_class = AdminQuestionSerializer


class AdminOptionViewSet(AuditedModelViewSet):
    queryset = Option.objects.select_related("question").order_by("question_id", "position")
    serializer_class = AdminOptionSerializer
