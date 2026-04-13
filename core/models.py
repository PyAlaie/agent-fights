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
    name = models.CharField(max_length=50, unique=True)
    code_file = models.FileField(upload_to='envs/')
    min_agents = models.IntegerField(default=1)
    max_agents = models.IntegerField(default=10)
    creator = models.ForeignKey(to=settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='envs')

class Agent(Base):
    name = models.CharField(max_length=50, unique=True)
    env = models.ForeignKey(to=Env, on_delete=models.CASCADE, related_name='agents')
    code_file = models.FileField(upload_to='agents/')
    creator = models.ForeignKey(to=settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='agents')

class Game(Base):
    name = models.CharField(max_length=50, unique=True)
    env = models.ForeignKey(to=Env, on_delete=models.CASCADE, related_name='games')
    agents = models.ManyToManyField(to=Agent, related_name='games', null=True)

    status_choices = {
            '0': 'Looking for players',
            '1': 'Reached minimum players',
            '2': 'Reached maximum players',
            '3': 'Started',
            '4': 'Terminated',
    }
    status = models.CharField(max_length=1, choices=status_choices)
    creator = models.ForeignKey(to=settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='created_games')
    winner = models.ForeignKey(to=Agent, on_delete=models.CASCADE, related_name='won_games', null=True)

    def clean(self):
        error_messages = {NON_FIELD_ERRORS: []}

        # # checking if the game can be started (the check happen only when starting is intended)
        # if self.status in ['3', '4', '5']:
        #     with transaction.atomic():
        #         game = Game.objects.select_for_update().get(id=self.id)
        #         if game.status in ['3', '4', '5']:
        #             error_messages[NON_FIELD_ERRORS].append('can\'t start a game that has already been started!')

        # agent-env compatibility
        for agent in self.agents:
            if agent.env != self.env:
                error_messages[NON_FIELD_ERRORS].append(f"agent {agent} is not compatible with the environment {self.env}")
        
        # agent count bound validation
        if self.agents.exists():
            if self.agents.count() > self.env.max_agents:
                error_messages[NON_FIELD_ERRORS].append('game agent count exceeded the maximum')

        # # checking if the winner has been set when the game is terminated
        # if self.status == '5' and self.winner == None:
        #     error_messages[NON_FIELD_ERRORS].append('The game can\'t be terminated without a winner!')

        # # checking if the winner has been set when the game is terminated
        # if self.status != '5' and self.winner != None:
        #     error_messages[NON_FIELD_ERRORS].append('The winner should not be determined when the game hasn\'t been terminated yet!')

        if len(error_messages[NON_FIELD_ERRORS]) != 0: raise ValidationError(error_messages)

    def save(self, **kwargs):
        # automatic update of status, 
        if self.id and self.agents != None and self.agents.count() > 0 and self.status not in ['2', '3', '4']:
                
                if self.winner:
                    # if the winner has already been determined, it means that the game has terminated.
                    self.status = '4'
                else:
                    # otherwise, we should just check if the minimum or maximum of the agents as been reached
                    env = self.env
                    if self.agents.count() == env.max_agents:
                        self.status = '2'
                    elif self.agents.count() >= env.min_agents:
                        self.status = '1'

        return super().save(**kwargs)    