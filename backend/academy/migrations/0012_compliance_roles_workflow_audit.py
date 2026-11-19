from django.conf import settings
from django.db import migrations, models
from django.utils import timezone
import django.db.models.deletion


def assign_roles(apps, schema_editor):
    User = apps.get_model("academy", "User")
    Completion = apps.get_model("academy", "CourseCompletion")
    User.objects.filter(is_staff=True).update(role="admin")
    Completion.objects.all().update(status="completed")


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("academy", "0011_premiumcheckout_access_expiry"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="role",
            field=models.CharField(
                choices=[
                    ("student", "Student"),
                    ("editor", "Content editor"),
                    ("admin", "Administrator"),
                ],
                default="student",
                max_length=16,
            ),
        ),
        migrations.AddField(
            model_name="coursecompletion",
            name="started_at",
            field=models.DateTimeField(auto_now_add=True, default=timezone.now),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="coursecompletion",
            name="status",
            field=models.CharField(
                choices=[("in_progress", "In progress"), ("completed", "Completed")],
                default="completed",
                max_length=16,
            ),
        ),
        migrations.AddField(
            model_name="coursecompletion",
            name="updated_at",
            field=models.DateTimeField(auto_now=True, default=timezone.now),
            preserve_default=False,
        ),
        migrations.RunPython(assign_roles, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="coursecompletion",
            name="completed_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name="coursecompletion",
            name="started_at",
            field=models.DateTimeField(auto_now_add=True),
        ),
        migrations.CreateModel(
            name="AuditLog",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("action", models.CharField(max_length=100)),
                ("object_type", models.CharField(max_length=100)),
                ("object_id", models.CharField(blank=True, max_length=100)),
                ("metadata", models.JSONField(blank=True, default=dict)),
                ("ip_address", models.GenericIPAddressField(blank=True, null=True)),
                ("path", models.CharField(blank=True, max_length=500)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "actor",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="audit_events",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={"ordering": ["-created_at", "-id"]},
        ),
    ]
