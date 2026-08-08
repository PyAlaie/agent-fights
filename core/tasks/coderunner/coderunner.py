import json
from wrapper import Wrapper 
from env_wrapper import EnvWrapper
import multiprocessing
import logging, sys, time, signal, random
from multiprocessing.connection import Connection

def get_module_logger(mod_name):
    """
    To use this, do logger = get_module_logger(__name__)
    """

    logger = logging.getLogger(mod_name)
    handler = logging.StreamHandler()
    formatter = logging.Formatter(
        '%(asctime)s [%(name)-12s] %(levelname)-8s %(message)s')
    handler.setFormatter(formatter)
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)
    return logger

logger = get_module_logger(__name__)


class AgentInfo:
    def __init__(
            self, 
            agent_id, 
            pipe_connection : multiprocessing.connection.Connection=None,
            wrapper_process : multiprocessing.Process=None,
            turn=None,
            filename=None,
            time_remaining=None,
        ):
        self.agent_id = agent_id
        self.pipe_connection : Connection = pipe_connection
        self.wrapper_process = wrapper_process
        self.turn = turn
        self.filename = filename
        self.total_time_passed = 0
        self.time_remaining = time_remaining


class CodeRunner:
    PIPE_PATH = '/stdin_pipe'
    
    def __init__(self):
        logger.info("Initializing CodeRunner...")
        
        self.agents : dict[str, AgentInfo] = {} # stored as agent_id -> AgentInfo
        self.env_connection = None
        self.env_wrapper_process = None
        
        self.turns = {} # stored as turn -> agent_id 
        self.timestamp = 0
        self.timestamp_limit = 200 # TODO: Read from settings

        self.game_on = False

        self.raw_payload = self._get_code_files_raw()

        logger.info("CodeRunner inisialized.")

    
    def _get_code_files_raw(self):
        """
        Reads the raw code files of the agents and the env
        """

        while True:
            try:
                with open(self.PIPE_PATH, 'r') as pipe:
                    line = pipe.readline()
                    if not line:
                        break
                    line = line.strip()
                    logger.info("Recienved code files.")
                    return line
            except Exception as e:
                raise IOError(f"Error: {e}")


    def _setup_game(self):
        """
        1. Writes env code in to env.py
        2. Creates the connection to env wrapper 
        3. Writes each agent code into a file
        4. Creates the connection to each agent wrapper 
        5. Creates wrapper process in self.agent_wrapper_processes as (agent_id -> wrapper_process)
        6. Assigns a turn number for each agent (starting from 0)
        7. Writes all into self.agents as (agent_id -> agentInfo). 
        8. Sets the game_on to be True
        """

        logger.info("Setup game ...")

        payload = json.loads(self.raw_payload)

        env = payload.get('env')
        agents = payload.get('agents')

        with open('env.py', 'w') as file:
            file.write(env)
            file.close()

        self._establish_env_connection()

        # Creating Agents
        turn = 0
        for agent_id, code in agents.items():
            agent_info = AgentInfo(agent_id)

            # Writing the codes of agents 
            filename = f"agent_{agent_id}.py" 
            with open(filename, 'w') as file:
                file.write(code)
                agent_info.filename = filename
            
            agent_wrapper, connection = self._establish_agent_connections(agent_id, filename)

            agent_info.wrapper_process = agent_wrapper
            agent_info.pipe_connection = connection

            agent_info.turn = turn
            self.turns[turn] = agent_id
            agent_info.time_remaining = 3 # TODO: gotta change it
            
            self.agents[agent_id] = agent_info
            turn += 1

        self.game_on = True

        logger.info("Game setup finished!")

    
    def _check_env_data_validation(self, env_data:dict):
        """
        Checks the structure of env_data to be correct
        """
        turn = env_data.get("turn")
        terminated = env_data.get("terminated")
        observation = env_data.get("observation")
        if turn is None or terminated is None:
            raise ValueError(f"one of the following is None: turn:{turn}, terminated:{terminated}")

        assert isinstance(turn, int), f"turn should be int, got: {type(turn).__name__}" 
        assert isinstance(terminated, bool), f"terminated should be int, got: {type(turn).__name__}" 

    
    def _increase_timestamp(self):
        self.timestamp += 1


    def timestamp_limit_reached(self):
        return self.timestamp >= self.timestamp_limit

    
    def _finish_game(self):
        """ 
        1. Announces the winner of the game
        2. Kills the agents and env processes and finishs the game.
        """
        logger.info("Finishing game...")
        # TODO: Announce the winner
        
        self.game_on = False

        # Kill env
        self.env_wrapper_process.kill()

        # Kill agents
        for agent, agent_info in self.agents.items():
            agent_info.wrapper_process.kill()



    def _make_event_message(self, event_type, timestamp, event_data):
        game_event = {
            "event_type": event_type,
            "timestamp": timestamp,
            "event_data": event_data,
        }

        return json.dumps(game_event)

    
    def _establish_env_connection(self):
        """ 
        Creates the connection to env wrapper and writes the connection to self.env_connection
        and the wrapper process is written into self.env_wrapper_process
        """

        env_conn, _child_env_conn = multiprocessing.Pipe(duplex=True)
        env_wrapper = multiprocessing.Process(target=EnvWrapper.create_env_wrapper, args=('env.py', _child_env_conn), name="env")
        env_wrapper.start()
        self.env_connection = env_conn
        self.env_wrapper_process = env_wrapper

    
    def _establish_agent_connections(self, agent_id, filename):
        """ 
        Creates the wrapper and the connection to the wrapper for agent  
        returns wrapper, connection
        """

        parent_conn, child_conn = multiprocessing.Pipe(duplex=True)

        agent_wrapper = multiprocessing.Process(target=Wrapper.create_wrapper, args=(filename, child_conn), name=f"agent-{agent_id}")
        agent_wrapper.start()

        return agent_wrapper, parent_conn
    
    
    def _get_agent_action(self, env_data, agent_id) -> str:
        """
        Passes the env_data to agent and gets the action from agent
        """

        agent_info = self.agents[agent_id]
        agent_pipe_connection = agent_info.pipe_connection 

        exited = False
        time_passed = 0
        action = None

        try:
            agent_pipe_connection.send(env_data)

            start = time.time()
            if agent_pipe_connection.poll(agent_info.time_remaining):
                action = agent_pipe_connection.recv()
            else:
                # The agent basically loses once its time limit is exceeded
                agent_info.wrapper_process.kill()
                raise TimeoutError("Time limit exceeded!")
            end = time.time()

            time_passed = end - start
            agent_info.time_remaining -= time_passed
            agent_info.total_time_passed += time_passed

        except Exception as e:
            exited = True
            logger.info(f"Error getting {agent_id} action: {e}")

        payload = {
            "action": action,
            "exited": exited,
            "time_passed": time_passed,
            "total_time_passed": agent_info.total_time_passed,
        }

        return json.dumps(payload)


    def main(self):
        self._setup_game()
        
        # Opening the pipe file to record game events
        with open(self.PIPE_PATH, 'w') as pipe:
            
            def write_into_pipe(message):
                pipe.write(str(message) + '\n')
                pipe.flush()

            # The game loop
            while self.game_on:
                # Get observation from env (containing turn)
                env_data = self.env_connection.recv()
                env_data_parsed = json.loads(env_data)

                # Check observation validity (terminated, etc)
                try:
                    self._check_env_data_validation(env_data_parsed)
                except Exception as e:
                    logger.error(f"Error in data comming from env: {e}")
                    self._finish_game()
                    break
                
                turn = env_data_parsed.get("turn")
                terminated = env_data_parsed.get("terminated")
                if terminated:
                    self._finish_game()
                    break
                observation = env_data_parsed.get("observation")
                
                # Pass the obsevation to the agent with turn 
                # and get the action from agent 
                agent_id = self.turns[turn] 
                action = self._get_agent_action(env_data, agent_id)

                # Send the record
                # 1. senf obs
                game_event = self._make_event_message("obs", self.timestamp, env_data)
                write_into_pipe(game_event)
                # 2. senf action
                game_event = self._make_event_message("act", self.timestamp, {"agent_id": agent_id, "action": action})
                write_into_pipe(game_event)

                # Step the action in the env
                self.env_connection.send(action)

                self._increase_timestamp()

                if self.timestamp_limit_reached():
                    self._finish_game()

        # Opening the pipe file to send the final results one last time  
        with open(self.PIPE_PATH, 'w') as pipe:
            # TODO: do this part
            pass


if __name__ == "__main__":
    coderunner = CodeRunner()
    coderunner.main()