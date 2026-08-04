from rest_framework import serializers
from .models import Env, Agent, Game, GameResult

class EnvSerializer(serializers.ModelSerializer):
    class Meta:
        model = Env
        fields = ['id', 'created_at', 'updated_at', 
                  'name', 'code_file', 'min_agents', 'max_agents', 
                  'creator', 'agents', 'games']
        read_only_fields = ['id', 'created_at', 'updated_at', 'creator']

    def create(self, validated_data):
        validated_data['creator'] = self.context['request'].user
        return super().create(validated_data)
    
class EnvGamesListSerializer(serializers.ModelSerializer):
    status = serializers.CharField(source='get_status_display')
    creator = serializers.CharField(source='creator.username')
    winner = serializers.CharField(source='winner.username')

    class Meta:
        model = Game
        fields = ['id', 'created_at', 'updated_at', 'name', 
                  'status', 'creator', 'winner'] 

class AgentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Agent
        fields = ['id', 'name', 'env', 
                  'code_file', 'creator', 'games']
        read_only_fields = ['id', 'creator']

    def create(self, validated_data):
        validated_data['creator'] = self.context['request'].user
        return super().create(validated_data)
    

class GameResultSerializer(serializers.ModelSerializer):
    class Meta:
        model = GameResult
        fields = ['id', 'events']
        # read_only_fields = ['id', 'status', 'creator']

class GameSerializer(serializers.ModelSerializer):
    gameresult = GameResultSerializer(read_only=True)
    class Meta:
        model = Game
        result = GameResultSerializer(read_only=True)
        fields = "__all__"
        # fields = ['id', 'name', 'env', 'agents', 'status', 'creator', 'gameresult']
        # read_only_fields = ['id', 'status', 'creator']

    def validate(self, attrs):
        if self.instance:
            self.instance.clean()
        return super().validate(attrs)

    def create(self, validated_data):
        validated_data['creator'] = self.context['request'].user
        return super().create(validated_data)    
    
class GameAgentsListSerializer(serializers.ModelSerializer):
    env = serializers.CharField(source='env.name')
    creator = serializers.CharField(source='creator.username')

    class Meta:
        model = Agent
        fields = ['id', 'name', 'env', 'creator']

class UserEnvsListSerializer(serializers.ModelSerializer):
    
    class Meta:
        model = Env
        fields = ['id', 'name', 'code_file', 
                  'min_agents', 'max_agents']
        
class UserAgentsListSerializer(serializers.ModelSerializer):

    class Meta:
        model = Env
        fields = ['id', 'name' , 'code_file']

class UserGamesListSerializer(serializers.ModelSerializer):
    # winner = serializers.CharField(source='winner.username')

    class Meta:
        model = Game
        fields = ['id', 'name', 'status']