import importlib.util, sys, pathlib
import pyseccomp, logging, signal
import time, json
from BaseWrapper import BaseWrapper
import resource

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

class Wrapper(BaseWrapper):
    def __init__(self, file_path, connection, memory_limit=10, cpu_limit=2):
        self.file_path = file_path
        self.connection = connection

        self.cpu_limit = cpu_limit
        self.memory_limit = memory_limit

        # self._set_limits()

        self.agent_namespace = {}

        try:
            self._import_agent() 
        except Exception as e:
            logger.error(f"ERROR: {e}")
            raise e
        
        super().__init__()

    
    def _set_limits(self):
        resource.setrlimit(resource.RLIMIT_AS, (self.memory_limit, self.memory_limit))
        # resource.setrlimit(resource.RLIMIT_CPU, (self.cpu_limit, self.cpu_limit))


    def _setup_seccomp(self):
        """ Using seccomp to filter syscalls in the process """

        f = pyseccomp.SyscallFilter(defaction=pyseccomp.KILL)
        
        allowed_syscalls = [
            'read', 'write', 'brk', 'mmap', 'munmap', 'getpid',
            # 'getpid', 'getuid', 'geteuid'
        ]

        for syscall in allowed_syscalls:
            try:
                f.add_rule(pyseccomp.ALLOW, syscall)
            except Exception as e:
                logger.warning(f"Could not add syscall {syscall}: {e}")
        
        f.load()
        logger.info("Seccomp loaded")
        

    def _import_agent(self):
        """
        Reads and executes the agent code.
        Writes the agent namespace into self.agent_namespace
        """

        abs_file_path = pathlib.Path(self.file_path).resolve()

        with open(abs_file_path, "r", encoding="utf-8") as f:
            source = f.read()

        self._setup_seccomp()

        code = compile(source, str(abs_file_path), "exec")
        exec(code, self.agent_namespace)

        if self.agent_namespace.get("main") is None:
            raise ImportError("No main function found!")

        return self.agent_namespace


    def run(self):
        """
        The function that runs the game loop for the agent's main function
        """
        while True:
            observation = self.connection.recv()
            
            try:
                action = self.agent_namespace.get("main")(observation)
                action_json = json.dumps(action)

                self.connection.send(action_json)
     
            except MemoryError as e:
                logger.error(f"Memory limit exceeded: {e}")
                raise e

            except Exception as e:
                logger.error(f"Error: {e}")
                raise e


    @staticmethod
    def create_wrapper(agent, connection):
        warpper = Wrapper(agent, connection)
        warpper.run()
