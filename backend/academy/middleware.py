from django.http import JsonResponse


class RequestHeaderLimitMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if len(request.META.get("HTTP_ACCEPT", "")) > 8192:
            return JsonResponse({"detail": "Request headers exceed the allowed size."}, status=431)
        return self.get_response(request)
