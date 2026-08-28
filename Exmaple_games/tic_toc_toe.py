from BaseEnv import AbstractEnv
import json

class Main(AbstractEnv):
    def __init__(self):
        self.grid = []
        self.reset()
        super().__init__()

    def reset(self):
        self.grid = []
        for i in range(3):
            self.grid.append([''] * 3)
        self.turn = 0
        self.max_agents = 2
        self.terminated = False
        self.game_result = None
        self.termination_message = None

    def _get_observation(self):
        return self.grid

    def _get_turn(self) -> int:
        return self.turn

    def check_termination(self):
        # 1. Check Rows
        for row in range(3):
            if self.grid[row][0] != '' and self.grid[row][0] == self.grid[row][1] == self.grid[row][2]:
                winner = self.grid[row][0]
                self.terminate(result={"winner": winner}, message=f"Player {winner} won by completing a row.")
                return

        # 2. Check Columns
        for col in range(3):
            if self.grid[0][col] != '' and self.grid[0][col] == self.grid[1][col] == self.grid[2][col]:
                winner = self.grid[0][col]
                self.terminate(result={"winner": winner}, message=f"Player {winner} won by completing a column.")
                return

        # 3. Check Diagonals
        if self.grid[0][0] != '' and self.grid[0][0] == self.grid[1][1] == self.grid[2][2]:
            winner = self.grid[0][0]
            self.terminate(result={"winner": winner}, message=f"Player {winner} won by main diagonal.")
            return

        if self.grid[0][2] != '' and self.grid[0][2] == self.grid[1][1] == self.grid[2][0]:
            winner = self.grid[0][2]
            self.terminate(result={"winner": winner}, message=f"Player {winner} won by anti-diagonal.")
            return

        # 4. Check for Draw / Tie (Full Board with no winner)
        is_full = all(cell != '' for row in self.grid for cell in row)
        if is_full:
            self.terminate(result={"winner": None}, message="Game ended in a draw.")

    def parse_action(self, action_data):
        # Handle cases where action_data is already a dict or a JSON string
        if isinstance(action_data, str):
            parsed_action_data = json.loads(action_data)
        elif isinstance(action_data, dict):
            parsed_action_data = action_data
        else:
            parsed_action_data = {}
        
        action = parsed_action_data.get("action")
        exited = parsed_action_data.get("exited", False)
        time_passed = parsed_action_data.get("time_passed", 0)
        total_time_passed = parsed_action_data.get("total_time_passed", 0)

        return action, exited, time_passed, total_time_passed

    def step(self, action_data):
        if self.terminated:
            return

        action, exited, time_passed, total_time_passed = self.parse_action(action_data)
        
        # Player quit prematurely
        if exited:
            other_player = (self.turn + 1) % self.max_agents
            self.terminate(result={"winner": other_player}, message=f"Player {self.turn} exited.")
            return

        # Validate action shape before unpacking
        if not isinstance(action, (list, tuple)) or len(action) != 2:
            other_player = (self.turn + 1) % self.max_agents
            self.terminate(result={"winner": other_player}, message=f"Player {self.turn} sent invalid action format: {action}")
            return

        i, j = action[0], action[1]

        # Out of bounds check
        if not (0 <= i < 3 and 0 <= j < 3):
            other_player = (self.turn + 1) % self.max_agents
            self.terminate(result={"winner": other_player}, message=f"Player {self.turn} move out of bounds: ({i}, {j})")
            return

        # Cell already taken check
        if self.grid[i][j] != '':
            other_player = (self.turn + 1) % self.max_agents
            self.terminate(result={"winner": other_player}, message=f"Player {self.turn} made an invalid move.")
            return

        # Mark grid with current player ID before switching turn
        current_player = self.turn
        self.grid[i][j] = current_player

        # Check win/draw conditions
        self.check_termination()

        # Rotate turn only if game is still active
        if not self.terminated:
            self.turn = (self.turn + 1) % self.max_agents
