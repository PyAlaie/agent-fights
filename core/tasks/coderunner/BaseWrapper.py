import sys 
import signal

class BaseWrapper:
    def __init__(self):
        signal.signal(signal.SIGTERM, self._finish_signal_handler)


    def _finish_signal_handler(self):
        """ 
        This function is called when coderunner signals the wrapper
        to finish with SIGTERM. Override it if necessary.
        """
        # TODO: write this function
        sys.exit(0)