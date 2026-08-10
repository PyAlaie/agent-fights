import json 

class AbstractEnv:
    def __init__(self):
        self.terminated = False
        self.termination_message : str = None 
        self.game_result = None

    def _get_observation(self):
        raise NotImplementedError("Method Not Implemented!")

    def _get_turn(self) -> int:
        raise NotImplementedError("Method Not Implemented!")

    def _get_terminated(self) -> bool:
        return self.terminated

    def reset(self):
        raise NotImplementedError("Method Not Implemented!")

    def step(self, action):
        raise NotImplementedError("Method Not Implemented!")

    
    def terminate(self, result, message : str = None):
        self.terminated = True
        self.game_result = result
        self.termination_message = message
    
    def get_env_data(self) -> str:
        payload = {
            "observation": self._get_observation(),
            "turn": self._get_turn(),
            "terminated": self._get_terminated(),
            "termination_message": self.termination_message,
            "game_result": self.game_result
        }

        payload_json = json.dumps(payload)

        return payload_json
            
    
