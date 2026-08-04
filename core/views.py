from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, JSONParser
from rest_framework.status import * 
from rest_framework.permissions import IsAuthenticated
from rest_framework.pagination import PageNumberPagination
from core.tasks import create_game_container_task
from .models import Env, Agent, Game

from .permissions import IsCreatorOrAdmin
from django.shortcuts import get_object_or_404


class StartGameView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        game_id = kwargs.get('id')
        game = get_object_or_404(Game, pk=game_id)

        # if game.status != Game.StatusChoices.ready:
        #     return Response({"message":"brother oewwwwww"},status=HTTP_200_OK)
        
        task = create_game_container_task.delay(game_id)

        return Response(
            {
                "message": "Task has been started successfully.",
                "task_id": task.id,
            },
            status=HTTP_202_ACCEPTED
        )