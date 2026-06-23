from celery import shared_task
from django.core.mail import send_mail
from django.contrib.auth.models import User
from ..models import Game
import time
import logging
from core.models import Env, Agent
import docker, os, json

logger = logging.getLogger(__name__)

@shared_task
def create_game_container_task(game_id):
    game = Game.objects.filter(id=game_id).first()
    
    env_code = game.env.code_file.read().decode("utf-8")

    agent_codes = {} # stored as agent_id: code
    for agent in game.agents.all():
        agent_codes[agent.id] = agent.code_file.read().decode("utf-8")

    payload = {
        'env': env_code,
        'agents': agent_codes
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

    # container.stop()

    print("DOne")


