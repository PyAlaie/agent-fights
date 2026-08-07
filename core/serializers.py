from rest_framework import serializers
from .models import Env, Agent, Game, GameResult
from rest_framework.serializers import ValidationError

class EnvSerializer(serializers.ModelSerializer):

    class Meta:
        model = Env
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at', 'creator']

    def create(self, validated_data):
        self.validated_data['creator'] = self.context['request'].user
        return Env.objects.create(**self.validated_data)

class AgentSerializer(serializers.ModelSerializer):

    class Meta:
        model = Agent
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at', 'creator']

    def create(self, validated_data):
            self.validated_data['creator'] = self.context['request'].user
            return Agent.objects.create(**self.validated_data)

class GameSerializer(serializers.ModelSerializer):

    class Meta:
        model = Game
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at', 'creator', 'status', 'agents']

    def create(self, validated_data):
            self.validated_data['creator'] = self.context['request'].user
            return Game.objects.create(**self.validated_data)
    
class AgentSubmissionSerializer(serializers.Serializer):
    agent_id = serializers.PrimaryKeyRelatedField(queryset=Agent.objects.all())

    def validate(self, attrs):
        agent = attrs['agent_id']

        if self.instance.status != '0':
            raise ValidationError("Can't Submit Agent to a Game That has been Already Started.")

        elif self.instance.agents.contains(agent):
            raise ValidationError('The Agents is Already Submitted for this Game.')

        else:
            max_agents = self.instance.env.max_agents
            if self.instance.agents.count() == max_agents:
                raise ValidationError('The Game has Reached its Maximum Agent Count.')

        if self.instance.env != agent.env:
            raise ValidationError('The Agent is Not Compatible With the Env of the Game.')

        return attrs

    def update(self, instance, validated_data):
        self.instance.agents.add(validated_data['agent_id'])
        self.instance.save()
        return self.instance

class StartGameSerializer(serializers.Serializer):

    def validate(self, attrs):
        if self.instance.status != '0':
            raise ValidationError('The Game has Already Been Started Once!')
         
        return attrs
