from rest_framework.decorators import api_view
from rest_framework.views import APIView
from django.contrib.auth.models import User
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth import login, logout
from .serializers import UserSignUpSerializer, UserLoginSerializer

@api_view(http_method_names=['POST'])
def sign_up(request):
    serializer = UserSignUpSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LoginLogout(APIView):
    # handles login
    def post(self, request):
        serializer = UserLoginSerializer(data=request.data)
        if serializer.is_valid():   
            login(request, serializer.validated_data['user'])   
            return Response(serializer.data, status=status.HTTP_202_ACCEPTED)
        return Response(serializer.errors, status=status.HTTP_401_UNAUTHORIZED)
    
    # handles logout
    def get(self, request):
        logout(request)
        return Response(status=status.HTTP_202_ACCEPTED)