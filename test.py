import requests
import os

# --- Configuration ---
BASE_URL = "http://localhost:8000"
# Assuming standard URL routing for your auth views based on your view classes
SIGNUP_URL = f"{BASE_URL}/authentication/sign-up/"
LOGIN_URL = f"{BASE_URL}/authentication/login/"
ENVS_URL = f"{BASE_URL}/api/envs"          # Note: your urls.py has 'envs', not 'envs/'
AGENTS_URL = f"{BASE_URL}/api/agents/"     # Note: your urls.py has 'agents/'
GAMES_URL = f"{BASE_URL}/api/games/"

# --- Setup ---
session = requests.Session()

# Create dummy files for FileField uploads
with open("dummy_env.py", "w") as f:
    f.write("print('Hello from Env')")
with open("dummy_agent.py", "w") as f:
    f.write("print('Hello from Agent')")

def print_response(step, response):
    print(f"\n--- {step} ---")
    print(f"Status: {response.status_code}")
    try:
        print(f"Response: {response.json()}")
    except ValueError:
        print("Response is not JSON")

# We need to fetch an initial CSRF token for session auth
session.get(f"{BASE_URL}/api-auth/login/") # Standard DRF login page just to set the csrftoken cookie
csrftoken = session.cookies.get('csrftoken', '')
session.headers.update({'X-CSRFToken': csrftoken})

# 1. Sign Up
user_data = {
    "username": "testuser",
    "password": "testpassword123",
    "email": "test@example.com",
    "first_name": "Test",
    "last_name": "User"
}
res = session.post(SIGNUP_URL, json=user_data)
print_response("1. Sign Up", res)

# 2. Log In (Establishes the session)
login_data = {
    "username": "testuser",
    "password": "testpassword123"
}
res = session.post(LOGIN_URL, json=login_data)
print_response("2. Log In", res)

# Update CSRF token after login just in case it rotated
session.headers.update({'X-CSRFToken': session.cookies.get('csrftoken')})

# 3. Create Environment (Requires Multipart Form Data for File Upload)
with open("dummy_env.py", "rb") as env_file:
    env_data = {"name": "Test Environment", "min_agents": 1, "max_agents": 4}
    env_files = {"code_file": env_file}
    res = session.post(ENVS_URL, data=env_data, files=env_files)
    print_response("3. Create Env", res)
    env_id = res.json().get("id")

# 4. Create Agent
with open("dummy_agent.py", "rb") as agent_file:
    agent_data = {"name": "Test Agent", "env": env_id}
    agent_files = {"code_file": agent_file}
    res = session.post(AGENTS_URL, data=agent_data, files=agent_files)
    print_response("4. Create Agent", res)
    agent_id = res.json().get("id")

# 5. Create Game
game_data = {
    "name": "Test Game",
    "env": env_id
}
res = session.post(GAMES_URL, json=game_data)
print_response("5. Create Game", res)
game_id = res.json().get("id")

# 6. Submit Agent to Game
submit_url = f"{GAMES_URL}{game_id}/agent-submission"
submit_data = {"agent_id": agent_id}
res = session.post(submit_url, json=submit_data)
print_response("6. Submit Agent", res)

# 7. Start Game
start_url = f"{GAMES_URL}{game_id}/start"
res = session.get(start_url)
print_response("7. Start Game", res)

# --- Cleanup Dummy Files ---
os.remove("dummy_env.py")
os.remove("dummy_agent.py")