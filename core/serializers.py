from rest_framework import serializers
from .models import Env, Agent, Game

class EnvSerializer(serializers.ModelSerializer):
    class Meta:
        model = Env
        fields = ['id', 'created_at', 'updated_at', 
                  'name', 'min_agents', 'max_agents', 
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
    
class GameSerializer(serializers.ModelSerializer):
    class Meta:
        model = Game
        fields = ['id', 'name', 'env', 'agents', 'status', 'creator', 'winner']
        read_only_fields = ['id', 'status', 'creator']

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