from rest_framework.permissions import BasePermission
from rest_framework.exceptions import PermissionDenied

class IsCreatorOrAdmin(BasePermission):
    def has_object_permission(self, request, view, obj):
        return obj.creator == request.user or request.user.is_staff
