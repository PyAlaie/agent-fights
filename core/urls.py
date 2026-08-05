from django.urls import path
from .views import StartGameView, EnvView, AgentView, GameView, AgentSubmissionView

urlpatterns = [
    
    path('envs', EnvView.as_view()),
    path('envs/<int:id>', EnvView.as_view()),

    path('agents/', AgentView.as_view()),
    path('agents/<int:id>', AgentView.as_view()),

    path('games/', GameView.as_view()),
    path('games/<int:id>', GameView.as_view()),
    path('games/<int:id>/agent-submission', AgentSubmissionView.as_view()),
    path('games/<int:id>/start', StartGameView.as_view()),
]