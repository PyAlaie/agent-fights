"""
The settings of the coderunner and the wrappers inside the
Docker container.
"""

# Wrapper settings

# Syscalls allowed to use by each agent
ALLOWED_SYSCALSS = ['read', 'write', 'brk', 'mmap', 'munmap', 'getpid', 'clock_nanosleep']

# Agent Limits
AGENT_MEMORY_LIMIT = 128 * 10**6 # In bytes
AGENT_TOTAL_TIME_LIMIT = 100 # In seconds
AGENT_ACTION_TIME_LIMIT = 100 # In seconds




# Coderunner settings

PIPE_PATH = '/stdin_pipe'
TIMESTAMP_LIMIT = 200
ENVIROMENT_FILENAME = "env.py"