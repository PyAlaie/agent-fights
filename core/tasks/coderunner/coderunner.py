import os
import json
from wrapper import Wrapper 
from env_wrapper import EnvWrapper
import multiprocessing

class CodeRunner:
    PIPE_PATH = '/stdin_pipe'
    
    def __init__(self):
        self.agents = {} # stored as (agent_id, code_file)
        self.agent_conns = {} # stored as (agent_id, connection)
        self.turns = {} # stored as (turn, agent_id)

        raw_payload = self._get_code_files_raw()
        self._process_code_files(raw_payload)

    def _get_code_files_raw(self):
        while True:
            try:
                with open(self.PIPE_PATH, 'r') as pipe:
                    line = pipe.readline()
                    if not line:
                        break
                    line = line.strip()
                    return line
            except Exception as e:
                raise IOError(f"Error: {e}")


    def _process_code_files(self, raw_json: str):
        """Writes env code in to env.py and writes agents into self.agents"""
        payload = json.loads(raw_json)

        env = payload.get('env')
        agents = payload.get('agents')
        print(agents)

        with open('env.py', 'w') as file:
            file.write(env)
            file.close()

        for agent_id, code in agents.items():
            filename = f"agent_{agent_id}.py" 
            with open(filename, 'w') as file:
                file.write(code)
                self.agents[agent_id] = filename
                file.close()


    def _check_env_data_validation(self, env_data:dict):
        turn = env_data.get("turn")
        terminated = env_data.get("terminated")
        observation = env_data.get("observation")
        if turn is None or terminated is None:
            raise ValueError(f"one of the following is None: turn:{turn}, terminated:{terminated}")

        assert isinstance(turn, int), f"turn should be int, got: {type(turn).__name__}" 
        assert isinstance(terminated, bool), f"terminated should be int, got: {type(turn).__name__}" 


    def main(self):
        # creating the env
        env_conn, _child_env_conn = multiprocessing.Pipe(duplex=True)
        env_wrapper = multiprocessing.Process(target=EnvWrapper.create_env_wrapper, args=('env.py', _child_env_conn))
        env_wrapper.start()

        # creating the agent wrappers
        turn = 0
        for agent_id, code_file in self.agents.items():
            parent_conn, child_conn = multiprocessing.Pipe(duplex=True)

            agent_wrapper = multiprocessing.Process(target=Wrapper.create_wrapper, args=(code_file, child_conn))
            agent_wrapper.start()

            self.agent_conns[agent_id] = parent_conn
            self.turns[turn] = agent_id
            turn += 1
        
        # The game loop
        while True:
            # 1. get observation from env (containing turn)
            env_data = env_conn.recv()
            env_data_parsed = json.loads(env_data)

            # 1.1 check observation validity (terminated, etc)
            self._check_env_data_validation(env_data_parsed)
            
            turn = env_data_parsed.get("turn")
            terminated = env_data_parsed.get("terminated")
            if terminated:
                break
            observation = env_data_parsed.get("observation")
            
            # 2. pass the obsevation to the agent with turn
            agent_id = self.turns[turn] 
            self.agent_conns[agent_id].send(env_data)

            # 3. get the action from agent 
            action = self.agent_conns[agent_id].recv()
            
            # 4. step the action in the env
            env_conn.send(action)


if __name__ == "__main__":
    coderunner = CodeRunner()
    coderunner.main()