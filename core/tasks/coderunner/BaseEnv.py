import json 

class AbstractEnv:
    def __init__(self):
        self.terminated = False
        pass

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
    
    def get_env_data(self) -> str:
        payload = {
            "observation": self._get_observation(),
            "turn": self._get_turn(),
            "terminated": self._get_terminated(),
        }

        payload_json = json.dumps(payload)

        return payload_json
            
    
