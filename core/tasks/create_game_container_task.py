from celery import shared_task
from django.core.mail import send_mail
from django.contrib.auth.models import User
from core.models import Game, GameResult, Agent
import time
import logging
from core.models import Env, Agent
import docker, os, json

logger = logging.getLogger(__name__)

@shared_task
def create_game_container_task(game_id):
    # Starting the game
    game = Game.objects.get(id=game_id)
    game.status = Game.StatusChoices.started
    game.save()
    
    try:
        env_code = game.env.code_file.read().decode("utf-8")

        agent_codes = {} # stored as agent_id: code
        for agent in game.agents.all():
            agent_codes[agent.id] = agent.code_file.read().decode("utf-8")

        game_settings = {
            "agent_memory_limit": game.agent_memory_limit,
            "agent_total_time_limit": game.agent_total_time_limit,
            "agent_action_time_limit": game.agent_action_time_limit,
        }

        payload = {
            'env': env_code,
            'agents': agent_codes,
            'game_settings': game_settings
        }

        pipe_path = '/tmp/my_pipe_' + str(os.getpid())
        
        if os.path.exists(pipe_path):
            os.unlink(pipe_path)
        os.mkfifo(pipe_path)

        docker_client = docker.DockerClient(base_url="unix:///var/run/docker.sock")

        container = docker_client.containers.run(
            image="arshia/coderunner",
            detach=True,
            stdin_open=True,
            stdout=True,
            stderr=True,
            volumes={pipe_path: {'bind': '/stdin_pipe', 'mode': 'rw'}}
        )

        j_payload = json.dumps(payload)
        with open(pipe_path, 'w') as pipe:
            pipe.write(j_payload)
            pipe.flush()

        events = []
        # Reading the game events from pipe
        with open(pipe_path, 'r') as pipe:
            while True:
                raw_event = pipe.readline()
                if not raw_event:
                    logger.info("Game ended!")
                    break

                raw_event = raw_event.strip()
                game_event = json.loads(raw_event)
                events.append(game_event)
        
        events_json = json.dumps(events)

        container_logs = container.logs().decode("utf-8")

        temp_agent = Agent.objects.first() # TODO: fix this temp agent as winner thing
        game_result = GameResult(game=game, winner=temp_agent, events=events_json, container_log=container_logs)
        game_result.save()

        game.status = Game.StatusChoices.finished
        game.save()
    
    except Exception as e:
        logger.error(f"Error: {e}")
        game.status = Game.StatusChoices.failed
        game.save()
