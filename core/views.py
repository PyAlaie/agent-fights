from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, JSONParser
from rest_framework.status import * 
from rest_framework.permissions import IsAuthenticated
from rest_framework.pagination import PageNumberPagination
from core.tasks import create_game_container_task
from .models import Env, Agent, Game, GameResult

from .permissions import IsCreatorOrAdmin
from django.shortcuts import get_object_or_404

from .serializers import EnvSerializer, AgentSerializer, GameSerializer, AgentSubmissionSerializer, StartGameSerializer, GameResultSerializer

class EnvView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = EnvSerializer(data=request.data, context={'request': request})

        if serializer.is_valid(raise_exception=True):
            env = serializer.save()
            return Response(data={'id': env.id}, status=HTTP_201_CREATED)

    def get(self, request, id=None):
        if id:
            env = Env.objects.get(id=id)
            serializer = EnvSerializer(instance=env)

            return Response(data=serializer.data, status=HTTP_200_OK)
        else:
            envs = Env.objects.all()
            serializer = EnvSerializer(instance=envs, many=True)

            return Response(data=serializer.data, status=HTTP_200_OK)

    def put(self, request, id):
            env = Env.objects.get(id=id)
            serializer = EnvSerializer(data=request.data, instance=env)

            if serializer.is_valid(raise_exception=True):
                serializer.save()
                return Response(data={}, status=HTTP_200_OK)

    def patch(self, request, id):
        env = Env.objects.get(id=id)
        serializer = EnvSerializer(data=request.data, instance=env)

        if serializer.is_valid(raise_exception=True):
            serializer.save()
            return Response(data={}, status=HTTP_200_OK)
    
class AgentView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = AgentSerializer(data=request.data, context={'request': request})

        if serializer.is_valid(raise_exception=True):
            agent = serializer.save()
            return Response(data={'id': agent.id}, status=HTTP_201_CREATED)

    def get(self, request, id=None):
        if id:
            agent = Agent.objects.get(id=id)
            serializer = AgentSerializer(instance=agent)

            return Response(data=serializer.data, status=HTTP_200_OK)
        else:
            agents = Agent.objects.all()
            serializer = AgentSerializer(instance=agents, many=True)

            return Response(data=serializer.data, status=HTTP_200_OK)

    def put(self, request, id):
            agent = Agent.objects.get(id=id)
            serializer = AgentSerializer(data=request.data, instance=agent)

            if serializer.is_valid(raise_exception=True):
                serializer.save()
                return Response(data={}, status=HTTP_200_OK)

    def patch(self, request, id):
        agent = Agent.objects.get(id=id)
        serializer = AgentSerializer(data=request.data, instance=agent)

        if serializer.is_valid(raise_exception=True):
            serializer.save()
            return Response(data={}, status=HTTP_200_OK)
        
class GameView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = GameSerializer(data=request.data, context={'request': request})

        if serializer.is_valid(raise_exception=True):
            game = serializer.save()
            return Response(data={'id': game.id}, status=HTTP_201_CREATED)

    def get(self, request, id=None):
            if id:
                game = Game.objects.get(id=id)
                serializer = GameSerializer(instance=game)
    
                return Response(data=serializer.data, status=HTTP_200_OK)
            else:
                games = Game.objects.all()
                serializer = GameSerializer(instance=games, many=True)
    
                return Response(data=serializer.data, status=HTTP_200_OK)

    def put(self, request, id):
            game = Game.objects.get(id=id)
            serializer = GameSerializer(data=request.data, instance=game)

            if serializer.is_valid(raise_exception=True):
                serializer.save()
                return Response(data={}, status=HTTP_200_OK)

    def patch(self, request, id):
        game = Game.objects.get(id=id)
        serializer = GameSerializer(data=request.data, instance=game)

        if serializer.is_valid(raise_exception=True):
            serializer.save()
            return Response(data={}, status=HTTP_200_OK)

class AgentSubmissionView(APIView):
    permission_classes = [IsAuthenticated, IsCreatorOrAdmin]

    def post(self, request, id):
        game = Game.objects.get(id=id)
        agent = Agent.objects.get(id=request.data['agent_id'])

        self.check_object_permissions(request, agent)
        
        serializer = AgentSubmissionSerializer(data=request.data, instance=game)

        if serializer.is_valid(raise_exception=True):
            serializer.save()
            return Response(data={}, status=HTTP_200_OK)

class StartGameView(APIView):
    permission_classes = [IsAuthenticated, IsCreatorOrAdmin]

    def get(self, request, *args, **kwargs):
        game_id = kwargs.get('id')
        game = get_object_or_404(Game, pk=game_id)

        serializer = StartGameSerializer(data=request.data, instance=game)
        if serializer.is_valid(raise_exception=True):
            self.check_object_permissions(request, game)

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

class GameResultView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, id):
        game = Game.objects.get(id=id)

        if game.status == game.StatusChoice.created:
            return Response(data={'error': 'The Game has not Been Started Yet.'}, status=HTTP_200_OK)

        else:
            game_result = GameResult.objects.get(game=game)
            serializer = GameResultSerializer(instance=game_result)

            return Response(data=serializer.data, status=HTTP_200_OK)

class UserAgentsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        agents = Agent.objects.filter(creator=request.user)
        serializer = AgentSerializer(instance=agents, many=True)

        return Response(data=serializer.data, status=HTTP_200_OK) 

class UserEnvsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        envs = Env.objects.filter(creator=request.user)
        serializer = EnvSerializer(instance=envs, many=True)

        return Response(data=serializer.data, status=HTTP_200_OK) 

class UserGamesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        games = Game.objects.filter(creator=request.user)
        serializer = GameSerializer(instance=games, many=True)

        return Response(data=serializer.data, status=HTTP_200_OK) 