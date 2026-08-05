from django.db import models
from django.conf import settings
from django.core.exceptions import ValidationError, NON_FIELD_ERRORS
from django.db import transaction

class Base(models.Model):
    created_at = models.DateTimeField(auto_now_add=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, blank=True)
    
    class Meta:
        abstract = True

class Env(Base):
    name = models.CharField(max_length=50)
    code_file = models.FileField(upload_to='envs/')
    min_agents = models.IntegerField(default=1)
    max_agents = models.IntegerField(default=10)
    creator = models.ForeignKey(to=settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='envs')

    def __repr__(self):
        return self.name
    
    def __str__(self):
        return self.name

class Agent(Base):
    name = models.CharField(max_length=50)
    env = models.ForeignKey(to=Env, on_delete=models.CASCADE, related_name='agents')
    code_file = models.FileField(upload_to='agents/')
    creator = models.ForeignKey(to=settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='agents')

    def __repr__(self):
        return f"{self.name} - {self.env.name}"

    def __str__(self):
        return f"{self.name} - {self.env.name}"

class Game(Base):
    status_choice = {
        '0': 'created',
        '1': 'started',
        '2': 'failed',
        '3': 'finished'}
    
    name = models.CharField(max_length=50)
    env = models.ForeignKey(to=Env, on_delete=models.CASCADE, related_name='games')
    agents = models.ManyToManyField(to=Agent, related_name='games', null=True, unique=True)
    status = models.CharField(max_length=10, choices=status_choice, default='0')
    creator = models.ForeignKey(to=settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='created_games')

    def clean(self):
        # env integrity of agents and game
        for agent in self.agents:
            if agent.env != self.env:
                raise ValidationError('Environment of Agent are Game are not the same.')

        min_agents, max_agents = self.env.min_agents, self.env.max_agents
        # checking if the agent count has exceeded the maximum possible
        if self.agents.count() > max_agents:
            raise ValidationError('Agent Count has Exceeded the Maximum.')

        # checking if the agent count has reached the minimum, required for starting the game
        if self.status in ['1', '2', '3']:
            if self.agents.count() < min_agents:
                raise ValidationError('Agent Count has not Reached the Minimum, Required for Starting the Game.')

class GameResult(Base):
    game = models.OneToOneField(to=Game, on_delete=models.CASCADE, null=False)
    winner = models.ForeignKey(to=Agent, on_delete=models.SET_NULL, null=True)
    events = models.TextField()
    container_log = models.TextField() 
