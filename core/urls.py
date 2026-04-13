from django.urls import path
from .views import EnvViewSet, EnvGamesListView, AgentViewSet, \
    GameViewSet, GameAgentsListView, UserEnvsListView, UserAgentsListView, \
    UserGamesListView

urlpatterns = [
    # list, retrieve, create, update, and partial update for Env
    path('envs/', EnvViewSet.as_view()),
    path('envs/<int:id>/', EnvViewSet.as_view()),

    # list of env's games
    path('envs/<int:id>/games', EnvGamesListView.as_view()),

    # list, retrieve, create, update, and partial update for Agent
    path('agents/', AgentViewSet.as_view()),
    path('agents/<int:id>/', AgentViewSet.as_view()),

    # list, retrieve, create, update, and partial update for Game
    path('games/', GameViewSet.as_view()),
    path('games/<int:id>/', GameViewSet.as_view()),
    path('games/<int:id>/agents', GameAgentsListView.as_view()),

    # list of user's envs, agents, and games
    path('me/envs', UserEnvsListView.as_view()),
    path('me/agents', UserAgentsListView.as_view()),
    path('me/games', UserGamesListView.as_view())
]