import json
def main(obs):
    print(f"got the observation: {obs}")
    obs = json.loads(obs).get("observation")

    positions = []
    for i in range(5):
        for j in range(5):
            positions.append((i,j))

    actions = range(1,5)
    import random
    pos = random.choice(positions)
    action = random.choice(actions)
    return {"position": pos, "z": action}