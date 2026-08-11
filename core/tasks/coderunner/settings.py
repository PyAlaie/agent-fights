"""
The settings of the coderunner and the wrappers inside the
Docker container.
"""

# Wrapper settings

# Syscalls allowed to use by each agent
ALLOWED_SYSCALSS = ['read', 'write', 'brk', 'mmap', 'munmap', 'getpid']

# Memoery limit in bytes
AGENT_MEMORY_LIMIT = 100




# Coderunner settings

PIPE_PATH = '/stdin_pipe'
TIMESTAMP_LIMIT = 200
ENVIROMENT_FILENAME = "env.py"