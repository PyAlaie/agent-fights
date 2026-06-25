from django.contrib import admin
from .models import Env, Agent, Game, GameResult

admin.site.register(Env)
admin.site.register(Agent)
admin.site.register(Game)
admin.site.register(GameResult)