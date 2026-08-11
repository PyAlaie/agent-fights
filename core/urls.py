from django.urls import path
from .views import StartGameView, EnvView, AgentView, GameView, AgentSubmissionView, GameResultView, UserEnvsView, UserAgentsView, UserGamesView

urlpatterns = [
    
    path('envs/', EnvView.as_view()),
    path('envs/<int:id>/', EnvView.as_view()),

    path('agents/', AgentView.as_view()),
    path('agents/<int:id>/', AgentView.as_view()),

    path('games/', GameView.as_view()),
    path('games/<int:id>/', GameView.as_view()),
    path('games/<int:id>/agent-submission/', AgentSubmissionView.as_view()),
    path('games/<int:id>/start/', StartGameView.as_view()),
    path('games/<int:id>/result/', GameResultView.as_view()),

    path('me/envs/', UserEnvsView.as_view()),
    path('me/agents/', UserAgentsView.as_view()),
    path('me/games/', UserGamesView.as_view()),
]