import json 

class AbstractEnv:
    def __init__(self):
        self.terminated = False
        self.termination_message : str = None 

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
    
    def terminate(self, message : str = None):
        self.terminated = True
        self.termination_message = message
    
    def get_env_data(self) -> str:
        payload = {
            "observation": self._get_observation(),
            "turn": self._get_turn(),
            "terminated": self._get_terminated(),
            "termination_message": self.termination_message
        }

        payload_json = json.dumps(payload)

        return payload_json
            
    
