from .models import AuditLog


def audit(request, action, instance=None, object_type="", object_id="", metadata=None):
    actor = request.user if getattr(request, "user", None) and request.user.is_authenticated else None
    address = request.META.get("REMOTE_ADDR") or None
    AuditLog.objects.create(
        actor=actor,
        action=action,
        object_type=object_type or (instance._meta.label if instance is not None else ""),
        object_id=str(object_id or (instance.pk if instance is not None else "")),
        metadata=metadata or {},
        ip_address=address,
        path=request.path[:500],
    )
