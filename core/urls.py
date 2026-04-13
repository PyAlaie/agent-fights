from django.urls import path
from .views import EnvViewSet, EnvGamesListView, AgentViewSet, GameViewSet, GameAgentsListView

urlpatterns = [
    path('envs/', EnvViewSet.as_view()),
    path('envs/<int:id>/', EnvViewSet.as_view()),
    path('envs/<int:id>/games', EnvGamesListView.as_view()),

    path('agents/', AgentViewSet.as_view()),
    path('agents/<int:id>/', AgentViewSet.as_view()),

    path('games/', GameViewSet.as_view()),
    path('games/<int:id>/', GameViewSet.as_view()),
    path('games/<int:id>/agents', GameAgentsListView.as_view()),

]