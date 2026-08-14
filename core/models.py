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
    class StatusChoices(models.TextChoices):
        created = 'Created'
        ready = 'Ready'
        started = 'Started'
        finished = 'Finished'
        failed = 'Failed'
    
    name = models.CharField(max_length=50)
    env = models.ForeignKey(to=Env, on_delete=models.CASCADE, related_name='games')
    agents = models.ManyToManyField(to=Agent, related_name='games', null=True)
    status = models.CharField(max_length=10, choices=StatusChoices, default=StatusChoices.created)
    creator = models.ForeignKey(to=settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='created_games')
    agent_memory_limit = models.IntegerField(null=True,blank=True)
    agent_total_time_limit = models.IntegerField(null=True, blank=True)
    agent_action_time_limit = models.IntegerField(null=True, blank=True)


    def clean(self):
        error_messages = {NON_FIELD_ERRORS: []}

        # agent-env compatibility
        if self.pk:
            for agent in self.agents.all():
                if agent.env != self.env:
                    error_messages[NON_FIELD_ERRORS].append(f"agent {agent} is not compatible with the environment {self.env}")
            
            # agent count bound validation
            if self.agents.exists():
                if self.agents.count() > self.env.max_agents:
                    error_messages[NON_FIELD_ERRORS].append('game agent count exceeded the maximum')

            if len(error_messages[NON_FIELD_ERRORS]) != 0: raise ValidationError(error_messages)

    def save(self, **kwargs):
        env = self.env
        if self.pk: # TODO: fix it
            if self.agents.count() > env.max_agents:
                raise ValueError(f"Agent count exceeds max number of allowed agents: {self.agents.count()} > {env.max_agents}")
            
            if env.min_agents <= self.agents.count() <= env.max_agents and self.status == self.StatusChoices.created:
                self.status = self.StatusChoices.ready

        return super().save(**kwargs)    

    def __repr__(self):
        return f"{self.name} - {self.env.name}"
    
    def __str__(self):
        return f"{self.name} - {self.env.name}"


class GameResult(Base):
    game = models.OneToOneField(to=Game, on_delete=models.CASCADE, null=False)
    winner = models.ForeignKey(to=Agent, on_delete=models.SET_NULL, null=True)
    events = models.TextField()
    container_log = models.TextField() 
