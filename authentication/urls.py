from django.urls import path
from .views import sign_up, LoginLogout

urlpatterns = [
    path('sign-up/', sign_up, name='sign-up'),
    path('login/', LoginLogout.as_view(), name='login'),
    path('logout/', LoginLogout.as_view(), name='logout'),
]