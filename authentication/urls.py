from django.urls import path
from .views import SignUp, Login, Logout

urlpatterns = [
    path('sign-up/', SignUp.as_view(), name='sign-up'),
    path('login/', Login.as_view(), name='login'),
    path('logout/', Logout.as_view(), name='logout'),
]