import time
import importlib.util, sys, pathlib
from BaseEnv import AbstractEnv

class EnvWrapper:
    def __init__(self, file_path, connection):
        self.file_path = file_path
        self.connection = connection
        
        self.env_module = self._import_env() 

    def _import_env(self):
        """Imports env code"""
        module_name = "env"

        abs_file_path = pathlib.Path(self.file_path).resolve()
        
        spec = importlib.util.spec_from_file_location(module_name, abs_file_path)
        if spec is None:
            raise ImportError(f"Could not load spec for {abs_file_path}")
        
        module = importlib.util.module_from_spec(spec)
        
        sys.modules[module_name] = module
        
        spec.loader.exec_module(module)
        
        return module

    def _get_main_class(self) -> AbstractEnv:
        """Gets the Main class from the imported module"""
        if not hasattr(self.env_module, 'Main'):
            raise AttributeError(f"Main class not found in {self.file_path}")
        
        main_class = getattr(self.env_module, 'Main')
        return main_class

    def run(self):
        # creating the env
        EnvClass = self._get_main_class()
        environment = EnvClass()
        environment.reset()

        initial_env_data = environment.get_env_data()
        self.connection.send(initial_env_data)

        while True:
            print("env, receiving...")
            action = self.connection.recv()
            print("env, received!")
            environment.step(action)
            env_data = environment.get_env_data()
            self.connection.send(env_data)

    @staticmethod
    def create_env_wrapper(env, connection):
        warpper = EnvWrapper(env, connection)
        warpper.run()