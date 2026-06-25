from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, JSONParser
from rest_framework.status import * 
from rest_framework.permissions import IsAuthenticated
from rest_framework.pagination import PageNumberPagination
from core.tasks import create_game_container_task
from .models import Env, Agent, Game
from .serializers import EnvSerializer, EnvGamesListSerializer, \
    AgentSerializer, GameSerializer, GameAgentsListSerializer, \
    UserEnvsListSerializer, UserAgentsListSerializer, UserGamesListSerializer

from .permissions import IsCreatorOrAdmin
from django.shortcuts import get_object_or_404


class EnvViewSet(APIView):
    def get_serializer(self, *args, **kwargs):
        """Return the serializer instance for form rendering in browsable API."""
        return EnvSerializer()

    def get_parsers(self):
        # POST requires Multipart parsing for handling forms
        if self.request.method == 'POST':
            return [MultiPartParser()]
        return super().get_parsers()
    
    def get_permissions(self):
        # PATCH/PUT require Ownership permissions
        if self.request.method in ['PATCH', 'PUT']:
            return [IsAuthenticated(), IsCreatorOrAdmin()]
        return super().get_permissions()
    
    # http method handlers
    def get(self, request, **kwargs):
        if kwargs.get('id', None):
            # A single object retreival
            env = Env.objects.get(id=kwargs.get('id'))
            serializer = EnvSerializer(instance=env)
            return Response(data=serializer.data, status=HTTP_200_OK)
        
        else:
            # A list of object retreival
            envs = Env.objects.all().order_by('-updated_at')

            # setup of pagination
            paginator = PageNumberPagination()
            paginated_queryset = paginator.paginate_queryset(envs, request, self)

            serializer = EnvSerializer(instance=paginated_queryset, many=True)
            return paginator.get_paginated_response(serializer.data)

    def post(self, request):
        # creation of a single object
        serializer = EnvSerializer(data=request.data, context={'request': request})
        if serializer.is_valid(raise_exception=True):
            env = serializer.save()
            return Response(data={'id': env.id}, status=HTTP_201_CREATED)
        
    def put(self, request, id):
        # update fields of an object
        env = Env.objects.get(id=id)
        
        # object-level explicit permission check
        for permission in self.get_permissions():
            if not permission.has_object_permission(request, self, env):
                self.permission_denied(
                    request,
                    message=getattr(permission, 'message', None),
                    code=getattr(permission, 'code', None)
                )

        serializer = EnvSerializer(data=request.data)
        if serializer.is_valid(raise_exception=True):
            serializer.save()
            return Response(data=serializer.data, status=HTTP_200_OK)

    def patch(self, request, id):
        # partial-update fields of an object
        env = Env.objects.get(id=id)
        
        # object-level explicit permission check
        for permission in self.get_permissions():
            if not permission.has_object_permission(request, self, env):
                self.permission_denied(
                    request,
                    message=getattr(permission, 'message', None),
                    code=getattr(permission, 'code', None)
                )

        serializer = EnvSerializer(instance=env, data=request.data, partial=True)
        if serializer.is_valid(raise_exception=True):
            serializer.save()
            return Response(data=serializer.data, status=HTTP_200_OK)
        
class EnvGamesListView(APIView):
    def get(self, request, id):
        # A list of object retreival
        env = Env.objects.get(id=id).order_by('-updated_at')

        # setup of pagination
        paginator = PageNumberPagination()
        paginated_queryset = paginator.paginate_queryset(env.games, request, self)

        serializer = EnvGamesListSerializer(instance=paginated_queryset, many=True)
        return paginator.get_paginated_response(serializer.data)

class AgentViewSet(APIView):
    def get_serializer(self, *args, **kwargs):
        """Return the serializer instance for form rendering in browsable API."""
        return AgentSerializer()
    
    def get_parsers(self):
        # POST requires Multipart parsing for handling forms
        if self.request.method == 'POST':
            return [MultiPartParser()]
        return super().get_parsers()
    
    def get_permissions(self):
        # PATCH/PUT require Ownership permissions
        if self.request.method in ['PATCH', 'PUT']:
            return [IsAuthenticated(), IsCreatorOrAdmin()]
        return super().get_permissions()
    
    # http method handlers
    def get(self, request, **kwargs):
        if kwargs.get('id', None):
            # A single object retreival
            agent = Agent.objects.get(id=kwargs.get('id'))
            serializer = AgentSerializer(instance=agent)
            return Response(data=serializer.data, status=HTTP_200_OK)
        
        else:
            # A list of object retreival
            agents = Agent.objects.all().order_by('-updated_at')

            # setup of pagination
            paginator = PageNumberPagination()
            paginated_queryset = paginator.paginate_queryset(agents, request, self)

            serializer = AgentSerializer(instance=paginated_queryset, many=True)
            return paginator.get_paginated_response(serializer.data)

    def post(self, request):
        # creation of a single object
        serializer = AgentSerializer(data=request.data, context={'request': request})
        if serializer.is_valid(raise_exception=True):
            env = serializer.save()
            return Response(data={'id': env.id}, status=HTTP_201_CREATED)
        
    def put(self, request, id):
        # update fields of an object
        agent = Agent.objects.get(id=id)
        
        # object-level explicit permission check
        for permission in self.get_permissions():
            if not permission.has_object_permission(request, self, agent):
                self.permission_denied(
                    request,
                    message=getattr(permission, 'message', None),
                    code=getattr(permission, 'code', None)
                )

        serializer = AgentSerializer(data=request.data)
        if serializer.is_valid(raise_exception=True):
            serializer.save()
            return Response(data=serializer.data, status=HTTP_200_OK)

    def patch(self, request, id):
        # partial-update fields of an object
        agent = Agent.objects.get(id=id)
        
        # object-level explicit permission check
        for permission in self.get_permissions():
            if not permission.has_object_permission(request, self, agent):
                self.permission_denied(
                    request,
                    message=getattr(permission, 'message', None),
                    code=getattr(permission, 'code', None)
                )

        serializer = AgentSerializer(instance=agent, data=request.data, partial=True)
        if serializer.is_valid(raise_exception=True):
            serializer.save()
            return Response(data=serializer.data, status=HTTP_200_OK)

class GameViewSet(APIView):
    def get_serializer(self, *args, **kwargs):
        """Return the serializer instance for form rendering in browsable API."""
        return GameSerializer()
    
    def get_permissions(self):
        # PATCH/PUT require Ownership permissions
        if self.request.method in ['PATCH', 'PUT']:
            return [IsAuthenticated(), IsCreatorOrAdmin()]
        return super().get_permissions()
    
    # http method handlers
    def get(self, request, **kwargs):
        if kwargs.get('id', None):
            # A single object retreival
            game = Game.objects.get(id=kwargs.get('id'))
            serializer = GameSerializer(instance=game)
            return Response(data=serializer.data, status=HTTP_200_OK)
        
        else:
            # A list of object retreival
            games = Game.objects.all().order_by('-updated_at')

            # setup of pagination
            paginator = PageNumberPagination()
            paginated_queryset = paginator.paginate_queryset(games, request, self)

            serializer = GameSerializer(instance=paginated_queryset, many=True)
            return paginator.get_paginated_response(serializer.data)

    def post(self, request):
        # creation of a single object
        serializer = GameSerializer(data=request.data, context={'request': request})
        if serializer.is_valid(raise_exception=True):
            env = serializer.save()
            return Response(data={'id': env.id}, status=HTTP_201_CREATED)
        
    def put(self, request, id):
        # update fields of an object
        game = Game.objects.get(id=id)
        
        # object-level explicit permission check
        for permission in self.get_permissions():
            if not permission.has_object_permission(request, self, game):
                self.permission_denied(
                    request,
                    message=getattr(permission, 'message', None),
                    code=getattr(permission, 'code', None)
                )

        serializer = GameSerializer(data=request.data)
        if serializer.is_valid(raise_exception=True):
            serializer.save()
            return Response(data=serializer.data, status=HTTP_200_OK)

    def patch(self, request, id):
        # partial-update fields of an object
        game = Game.objects.get(id=id)
        
        # object-level explicit permission check
        for permission in self.get_permissions():
            if not permission.has_object_permission(request, self, game):
                self.permission_denied(
                    request,
                    message=getattr(permission, 'message', None),
                    code=getattr(permission, 'code', None)
                )

        serializer = GameSerializer(instance=game, data=request.data, partial=True)
        if serializer.is_valid(raise_exception=True):
            serializer.save()
            return Response(data=serializer.data, status=HTTP_200_OK)
        
class GameAgentsListView(APIView):
    def get(self, request, id):
        # A list of object retreival
        game = Game.objects.get(id=id).order_by('-updated_at')

        # setup of pagination
        paginator = PageNumberPagination()
        paginated_queryset = paginator.paginate_queryset(game.agents, request, self)

        serializer = GameAgentsListSerializer(instance=paginated_queryset, many=True)
        return paginator.get_paginated_response(serializer.data)
    
class UserEnvsListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, id):
        # A list of object retreival
        envs = request.user.envs.order_by('-updated_at')

        # setup of pagination
        paginator = PageNumberPagination()
        paginated_queryset = paginator.paginate_queryset(envs, request, self)

        serializer = UserEnvsListSerializer(instance=paginated_queryset, many=True)
        return paginator.get_paginated_response(serializer.data)
    
class UserAgentsListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, id):
        # A list of object retreival
        agents = request.user.agents.order_by('-updated_at')

        # setup of pagination
        paginator = PageNumberPagination()
        paginated_queryset = paginator.paginate_queryset(agents, request, self)

        serializer = UserAgentsListSerializer(instance=paginated_queryset, many=True)
        return paginator.get_paginated_response(serializer.data)
    
class UserGamesListView(APIView):
    def get_serializer(self, *args, **kwargs):
        """Return the serializer instance for form rendering in browsable API."""
        return EnvSerializer()
    
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # A list of object retreival
        games = request.user.created_games.all().order_by('-updated_at')

        # setup of pagination
        paginator = PageNumberPagination()
        paginated_queryset = paginator.paginate_queryset(games, request, self)

        serializer = UserGamesListSerializer(instance=paginated_queryset, many=True)
        return paginator.get_paginated_response(serializer.data)

class StartGameView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        game_id = kwargs.get('id')
        game = get_object_or_404(Game, pk=game_id)

        if game.status != Game.StatusChoices.ready:
            return Response({"message":"brother oewwwwww"},status=HTTP_200_OK)
        
        task = create_game_container_task.delay(game_id)

        return Response(
            {
                "message": "Task has been started successfully.",
                "task_id": task.id,
            },
            status=HTTP_202_ACCEPTED
        )