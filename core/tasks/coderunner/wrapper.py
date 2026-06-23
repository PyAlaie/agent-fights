import time
import importlib.util, sys, pathlib
import pyseccomp, logging, signal

class Wrapper:
    def __init__(self, file_path, connection):
        self.file_path = file_path
        self.connection = connection
        
        self._setup_seccomp()
        self.agent_module = self._import_agent() 

    def _sigsys_handler(self, signum, frame):
        """ This handler is ran when some not allowed syscall is being used """

        # TODO: write this hanlder
        raise KeyError("mamamia")

    def _setup_seccomp(self):
        """ Using seccomp to filter syscalls in the process """

        signal.signal(signal.SIGSYS, self.sigsys_handler)
        
        f = pyseccomp.SyscallFilter(defaction=pyseccomp.TRAP)
    
        allowed_syscalls = [
            'read', 'write', 'close', 'mmap', 'munmap',
            'brk', 'exit', 'exit_group', 'futex',
            'open', 'openat', 'stat', 'fstat',
            'getpid', 'getuid', 'geteuid'
        ]
        
        for syscall in allowed_syscalls:
            try:
                f.add_rule(pyseccomp.ALLOW, syscall)
            except Exception as e:
                logging.warning(f"Could not add syscall {syscall}: {e}")
        
        f.load()
        logging.info(f"Seccomp loaded")
        

    def _import_agent(self):
        """ Imports agent code """
        module_name = "agent"

        abs_file_path = pathlib.Path(self.file_path).resolve()
        
        spec = importlib.util.spec_from_file_location(module_name, abs_file_path)
        if spec is None:
            raise ImportError(f"Could not load spec for {abs_file_path}")
        
        module = importlib.util.module_from_spec(spec)
        
        sys.modules[module_name] = module
        
        spec.loader.exec_module(module)
        
        return module

    def run(self):
        while True:
            observation = self.connection.recv()
            action = self.agent_module.main(observation)
            print(observation)
            self.connection.send(action)

    @staticmethod
    def create_wrapper(agent, connection):
        warpper = Wrapper(agent, connection)
        warpper.run()
