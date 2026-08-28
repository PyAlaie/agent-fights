import random
import json

def main(obs):
    # 1. Handle string observations safely
    if isinstance(obs, str):
        obs = json.loads(obs)
    
    # 2. Extract grid if obs is a dict wrapper
    if isinstance(obs, dict):
        grid = obs.get("observation", obs)
    else:
        grid = obs

    # 3. Find all empty spaces (i, j) on the grid
    available_moves = []
    for r in range(3):
        for c in range(3):
            if grid[r][c] == '':
                available_moves.append([r, c])

    # 4. Select a move if available
    chosen_action = random.choice(available_moves) if available_moves else [0, 0]

    # 5. Return the list directly. 
    # The runner will wrap it in {"action": [...], "exited": False, ...} automatically.
    return chosen_action