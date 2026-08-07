import React, { useState } from 'react';
import axios from 'axios';
import { Play, Upload, Shield, Bot, Trophy, LogOut, PlusCircle, UserCheck, Search, Edit3, AlertCircle, Code, Eye, EyeOff } from 'lucide-react';

// 1. Helper Function for CSRF Token Parsing
function getCookie(name) {
  let cookieValue = null;
  if (document.cookie && document.cookie !== '') {
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      if (cookie.substring(0, name.length + 1) === (name + '=')) {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
}

// 2. Status Code Mapper matching Django models.TextChoices
const GAME_STATUS_MAP = {
  '0': 'created',
  '1': 'started',
  '2': 'failed',
  '3': 'finished',
};

const formatGameStatus = (status) => {
  if (status === null || status === undefined) return 'unknown';
  const statusStr = String(status);
  return GAME_STATUS_MAP[statusStr] || `Status Code: ${status}`;
};

// 3. Configure Axios Defaults & CSRF Interceptor
const API_BASE = 'http://localhost:8000';
axios.defaults.withCredentials = true;

axios.interceptors.request.use((config) => {
  const csrfToken = getCookie('csrftoken');
  if (csrfToken) {
    config.headers['X-CSRFToken'] = csrfToken;
  }
  return config;
}, (error) => Promise.reject(error));

export default function App() {
  const [user, setUser] = useState(null);
  const [authForm, setAuthForm] = useState({ username: '', password: '', isSignup: false });
  const [authError, setAuthError] = useState('');

  const [activeTab, setActiveTab] = useState('games');

  // Lookup IDs & Found Data States
  const [lookup, setLookup] = useState({ envId: '', agentId: '', gameId: '' });
  const [foundEnv, setFoundEnv] = useState(null);
  const [foundAgent, setFoundAgent] = useState(null);
  const [foundGame, setFoundGame] = useState(null);

  // Code Viewer States
  const [envCode, setEnvCode] = useState(null);
  const [showEnvCode, setShowEnvCode] = useState(false);
  const [agentCode, setAgentCode] = useState(null);
  const [showAgentCode, setShowAgentCode] = useState(false);

  // Edit (PUT / PATCH) States
  const [editEnvData, setEditEnvData] = useState({ name: '', min_agents: 1, max_agents: 10, file: null });
  const [editAgentData, setEditAgentData] = useState({ name: '', env: '', file: null });
  const [editGameData, setEditGameData] = useState({ name: '', env: '' });

  // Creation Form Inputs
  const [envData, setEnvData] = useState({ name: '', min_agents: 1, max_agents: 4, file: null });
  const [agentData, setAgentData] = useState({ name: '', env: '', file: null });
  const [gameData, setGameData] = useState({ name: '', env: '' });
  const [submissionData, setSubmissionData] = useState({ gameId: '', agentId: '' });

  // Feedback Notification Banner State
  const [message, setMessage] = useState({ text: '', type: '' });

  const notify = (text, type = 'info') => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: '', type: '' }), 5000);
  };

  // --- CENTRALIZED ERROR HANDLER ---
  const handleApiError = (err, defaultMsg) => {
    if (!err.response) {
      notify('Network error or server unavailable', 'error');
      return;
    }
    const status = err.response.status;
    const data = err.response.data;

    if (status === 401) {
      setUser(null);
      notify('Session expired or unauthorized. Please log in again.', 'error');
    } else if (status === 403) {
      notify('Permission Denied: You do not have ownership rights for this resource.', 'error');
    } else if (status === 404) {
      notify('Resource not found. Please verify the ID.', 'error');
    } else if (status === 400) {
      let errDetails = defaultMsg;
      if (typeof data === 'object') {
        const messages = Object.entries(data).map(([key, val]) => `${key}: ${Array.isArray(val) ? val.join(' ') : val}`);
        errDetails = messages.join(' | ');
      }
      notify(`Validation Error: ${errDetails}`, 'error');
    } else {
      notify(data.detail || defaultMsg, 'error');
    }
  };

  // --- AUTHENTICATION WITH ERROR HANDLING ---
  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError('');
    const endpoint = authForm.isSignup ? '/authentication/sign-up/' : '/authentication/login/';

    try {
      await axios.post(`${API_BASE}${endpoint}`, {
        username: authForm.username,
        password: authForm.password,
      });
      setUser(authForm.username);
      setAuthForm({ username: '', password: '', isSignup: false });
      notify(`Welcome, ${authForm.username}!`, 'success');
    } catch (err) {
      if (!err.response) {
        setAuthError('Network error. Unable to reach authentication server.');
      } else if (err.response.status === 400 || err.response.status === 401) {
        const data = err.response.data;
        if (typeof data === 'object') {
          const firstError = Object.entries(data).map(([k, v]) => `${k}: ${Array.isArray(v) ? v[0] : v}`)[0];
          setAuthError(firstError || 'Invalid credentials or validation failed.');
        } else {
          setAuthError('Authentication failed. Check your username and password.');
        }
      } else {
        setAuthError(err.response.data?.detail || 'An unexpected authentication error occurred.');
      }
    }
  };

  const handleLogout = async () => {
    try {
      await axios.get(`${API_BASE}/authentication/logout/`);
      setUser(null);
      notify('Successfully logged out.', 'info');
    } catch (err) {
      handleApiError(err, 'Logout failed');
    }
  };

  // --- CODE FETCHING ---
  const fetchCode = async (fileUrl, setCodeState) => {
    try {
      const res = await axios.get(fileUrl, { responseType: 'text' });
      setCodeState(res.data);
    } catch (err) {
      setCodeState('# Failed to load source code from server.');
    }
  };

  // --- LOOKUP ACTIONS ---
  const fetchEnv = async (e) => {
    e?.preventDefault();
    setShowEnvCode(false);
    setEnvCode(null);
    try {
      const res = await axios.get(`${API_BASE}/api/envs/${lookup.envId}`);
      setFoundEnv(res.data);
      setEditEnvData({ name: res.data.name, min_agents: res.data.min_agents, max_agents: res.data.max_agents, file: null });
      notify(`Loaded Environment #${res.data.id}`, 'success');
    } catch (err) {
      setFoundEnv(null);
      handleApiError(err, 'Failed to fetch environment');
    }
  };

  const fetchAgent = async (e) => {
    e?.preventDefault();
    setShowAgentCode(false);
    setAgentCode(null);
    try {
      const res = await axios.get(`${API_BASE}/api/agents/${lookup.agentId}`);
      setFoundAgent(res.data);
      setEditAgentData({ name: res.data.name, env: res.data.env, file: null });
      notify(`Loaded Agent #${res.data.id}`, 'success');
    } catch (err) {
      setFoundAgent(null);
      handleApiError(err, 'Failed to fetch agent');
    }
  };

  const fetchGame = async (e) => {
    e?.preventDefault();
    try {
      const res = await axios.get(`${API_BASE}/api/games/${lookup.gameId}`);
      setFoundGame(res.data);
      setEditGameData({ name: res.data.name, env: res.data.env });
      notify(`Loaded Game #${res.data.id}`, 'success');
    } catch (err) {
      setFoundGame(null);
      handleApiError(err, 'Failed to fetch game');
    }
  };

  // --- CREATE ACTIONS ---
  const handleUploadEnv = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('name', envData.name);
    formData.append('min_agents', envData.min_agents);
    formData.append('max_agents', envData.max_agents);
    if (envData.file) formData.append('code_file', envData.file);

    try {
      const res = await axios.post(`${API_BASE}/api/envs`, formData);
      notify(`Environment Created! (ID: ${res.data.id})`, 'success');
      setEnvData({ name: '', min_agents: 1, max_agents: 4, file: null });
    } catch (err) {
      handleApiError(err, 'Failed to create environment');
    }
  };

  const handleUploadAgent = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('name', agentData.name);
    formData.append('env', agentData.env);
    if (agentData.file) formData.append('code_file', agentData.file);

    try {
      const res = await axios.post(`${API_BASE}/api/agents/`, formData);
      notify(`Agent Created! (ID: ${res.data.id})`, 'success');
      setAgentData({ name: '', env: '', file: null });
    } catch (err) {
      handleApiError(err, 'Failed to upload agent');
    }
  };

  const handleCreateGame = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${API_BASE}/api/games/`, {
        name: gameData.name,
        env: gameData.env,
      });
      notify(`Game Room Created! (ID: ${res.data.id})`, 'success');
      setGameData({ name: '', env: '' });
    } catch (err) {
      handleApiError(err, 'Failed to create game room');
    }
  };

  const handleSubmitAgentToGame = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_BASE}/api/games/${submissionData.gameId}/agent-submission`, {
        agent_id: submissionData.agentId,
      });
      notify('Agent submitted to game successfully!', 'success');
    } catch (err) {
      handleApiError(err, 'Submission failed');
    }
  };

  const handleStartGame = async (gameId) => {
    try {
      const res = await axios.get(`${API_BASE}/api/games/${gameId}/start`);
      notify(`Game Execution Triggered! Task ID: ${res.data.task_id}`, 'success');
    } catch (err) {
      handleApiError(err, 'Failed to start game');
    }
  };

  // --- UPDATE (PUT / PATCH) WITH MULTIPART CODE_FILE SUPPORT ---
  const handleUpdateEnv = async (isPatch = false) => {
    if (!foundEnv) return;

    const formData = new FormData();
    if (editEnvData.name) formData.append('name', editEnvData.name);
    if (editEnvData.min_agents) formData.append('min_agents', editEnvData.min_agents);
    if (editEnvData.max_agents) formData.append('max_agents', editEnvData.max_agents);
    if (editEnvData.file) formData.append('code_file', editEnvData.file);

    try {
      const method = isPatch ? 'patch' : 'put';
      await axios({
        method,
        url: `${API_BASE}/api/envs/${foundEnv.id}`,
        data: formData,
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      notify(`Environment #${foundEnv.id} updated via ${method.toUpperCase()}!`, 'success');
      fetchEnv();
    } catch (err) {
      handleApiError(err, 'Failed to update environment');
    }
  };

  const handleUpdateAgent = async (isPatch = false) => {
    if (!foundAgent) return;

    const formData = new FormData();
    if (editAgentData.name) formData.append('name', editAgentData.name);
    if (editAgentData.env) formData.append('env', editAgentData.env);
    if (editAgentData.file) formData.append('code_file', editAgentData.file);

    try {
      const method = isPatch ? 'patch' : 'put';
      await axios({
        method,
        url: `${API_BASE}/api/agents/${foundAgent.id}`,
        data: formData,
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      notify(`Agent #${foundAgent.id} updated via ${method.toUpperCase()}!`, 'success');
      fetchAgent();
    } catch (err) {
      handleApiError(err, 'Failed to update agent');
    }
  };

  const handleUpdateGame = async (isPatch = false) => {
    if (!foundGame) return;
    const method = isPatch ? 'patch' : 'put';
    try {
      await axios[method](`${API_BASE}/api/games/${foundGame.id}`, editGameData);
      notify(`Game #${foundGame.id} updated via ${method.toUpperCase()}!`, 'success');
      fetchGame();
    } catch (err) {
      handleApiError(err, 'Failed to update game');
    }
  };

  // --- AUTH GATE ---
  if (!user) {
    return (
      <div style={styles.authContainer}>
        <div style={styles.card}>
          <h2 style={{ textAlign: 'center', marginBottom: '1rem' }}>
            {authForm.isSignup ? 'Create Account' : 'Agent Battles Login'}
          </h2>

          {/* Auth Local Error Notification */}
          {authError && (
            <div style={styles.authErrorBox}>
              <AlertCircle size={16} />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={handleAuth} style={styles.form}>
            <div>
              <input
                type="text"
                placeholder="Username"
                value={authForm.username}
                onChange={(e) => setAuthForm({ ...authForm, username: e.target.value })}
                style={styles.input}
                required
              />
              <span style={styles.helpText}>Enter your registered username or pick a unique handle for sign up.</span>
            </div>

            <div>
              <input
                type="password"
                placeholder="Password"
                value={authForm.password}
                onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                style={styles.input}
                required
              />
              <span style={styles.helpText}>Must be at least 8 characters long for secure authentication.</span>
            </div>

            <button type="submit" style={styles.btnPrimary}>
              {authForm.isSignup ? 'Sign Up' : 'Log In'}
            </button>
          </form>

          <p
            onClick={() => {
              setAuthError('');
              setAuthForm({ ...authForm, isSignup: !authForm.isSignup });
            }}
            style={styles.toggleAuth}
          >
            {authForm.isSignup ? 'Already have an account? Login' : "Don't have an account? Sign Up"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.appWrapper}>
      {/* Top Header */}
      <header style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Trophy size={24} color="#6366f1" />
          <h1 style={{ margin: 0, fontSize: '1.25rem' }}>Agent Competition Hub</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span>User: <strong>{user}</strong></span>
          <button onClick={handleLogout} style={styles.btnSecondary}>
            <LogOut size={16} /> Logout
          </button>
        </div>
      </header>

      {/* Global Notification Banner */}
      {message.text && (
        <div style={{
          ...styles.alert,
          backgroundColor: message.type === 'error' ? '#fef2f2' : '#f0fdf4',
          color: message.type === 'error' ? '#991b1b' : '#166534',
          borderColor: message.type === 'error' ? '#fca5a5' : '#86efac'
        }}>
          <AlertCircle size={16} /> {message.text}
        </div>
      )}

      {/* Navigation Tabs */}
      <nav style={styles.nav}>
        {['games', 'environments', 'agents'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              ...styles.tabBtn,
              borderBottom: activeTab === tab ? '2px solid #6366f1' : 'none',
              color: activeTab === tab ? '#6366f1' : '#64748b',
            }}
          >
            {tab.toUpperCase()}
          </button>
        ))}
      </nav>

      {/* Main Content Area */}
      <main style={styles.main}>
        {/* ================= GAMES VIEW ================= */}
        {activeTab === 'games' && (
          <div style={styles.grid}>
            {/* Lookup Game */}
            <div style={styles.card}>
              <h3><Search size={18} /> Lookup Game Details</h3>
              <form onSubmit={fetchGame} style={styles.form}>
                <div>
                  <div style={styles.row}>
                    <input
                      type="number"
                      placeholder="Enter Game ID"
                      value={lookup.gameId}
                      onChange={(e) => setLookup({ ...lookup, gameId: e.target.value })}
                      style={styles.input}
                      required
                    />
                    <button type="submit" style={styles.btnPrimary}>Fetch</button>
                  </div>
                  <span style={styles.helpText}>Enter the numerical ID of the game room to retrieve details.</span>
                </div>
              </form>

              {foundGame && (
                <div style={styles.detailsBox}>
                  <p><strong>ID:</strong> {foundGame.id}</p>
                  <p><strong>Name:</strong> {foundGame.name}</p>
                  <p><strong>Env ID:</strong> {foundGame.env}</p>

                  <p>
                    <strong>Status:</strong>{' '}
                    <span style={styles.statusBadge}>{formatGameStatus(foundGame.status)}</span>
                  </p>

                  <p><strong>Creator ID:</strong> {foundGame.creator}</p>
                  <p><strong>Enrolled Agents:</strong> {foundGame.agents?.length ? foundGame.agents.join(', ') : 'None'}</p>

                  <hr style={{ margin: '12px 0', border: '0.5px solid #e2e8f0' }} />
                  <h4><Edit3 size={16} /> Edit Game (PUT / PATCH)</h4>
                  <div style={styles.form}>
                    <div>
                      <input
                        type="text"
                        value={editGameData.name}
                        onChange={(e) => setEditGameData({ ...editGameData, name: e.target.value })}
                        placeholder="Game Name"
                        style={styles.input}
                      />
                      <span style={styles.helpText}>Update the display name of this game room.</span>
                    </div>

                    <div>
                      <input
                        type="number"
                        value={editGameData.env}
                        onChange={(e) => setEditGameData({ ...editGameData, env: e.target.value })}
                        placeholder="Environment ID"
                        style={styles.input}
                      />
                      <span style={styles.helpText}>Target Environment ID assigned to this match.</span>
                    </div>

                    <div style={styles.row}>
                      <button type="button" onClick={() => handleUpdateGame(false)} style={styles.btnPrimary}>PUT Update</button>
                      <button type="button" onClick={() => handleUpdateGame(true)} style={styles.btnSecondary}>PATCH Update</button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Host & Register Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={styles.card}>
                <h3><PlusCircle size={18} /> Create Game Room</h3>
                <form onSubmit={handleCreateGame} style={styles.form}>
                  <div>
                    <input
                      type="text"
                      placeholder="Game Name"
                      value={gameData.name}
                      onChange={(e) => setGameData({ ...gameData, name: e.target.value })}
                      style={styles.input}
                      required
                    />
                    <span style={styles.helpText}>Descriptive title for the match or tournament session.</span>
                  </div>

                  <div>
                    <input
                      type="number"
                      placeholder="Target Env ID"
                      value={gameData.env}
                      onChange={(e) => setGameData({ ...gameData, env: e.target.value })}
                      style={styles.input}
                      required
                    />
                    <span style={styles.helpText}>ID of the pre-uploaded Environment where agents will battle.</span>
                  </div>

                  <button type="submit" style={styles.btnPrimary}>Host Game</button>
                </form>
              </div>

              <div style={styles.card}>
                <h3><UserCheck size={18} /> Register Agent to Game</h3>
                <form onSubmit={handleSubmitAgentToGame} style={styles.form}>
                  <div>
                    <input
                      type="number"
                      placeholder="Game ID"
                      value={submissionData.gameId}
                      onChange={(e) => setSubmissionData({ ...submissionData, gameId: e.target.value })}
                      style={styles.input}
                      required
                    />
                    <span style={styles.helpText}>Target Game room ID to join.</span>
                  </div>

                  <div>
                    <input
                      type="number"
                      placeholder="Agent ID"
                      value={submissionData.agentId}
                      onChange={(e) => setSubmissionData({ ...submissionData, agentId: e.target.value })}
                      style={styles.input}
                      required
                    />
                    <span style={styles.helpText}>Your Agent ID designed for this Game's environment.</span>
                  </div>

                  <button type="submit" style={styles.btnPrimary}>Submit Agent</button>
                </form>
              </div>
            </div>

            {/* Direct Game Launcher */}
            <div style={{ ...styles.card, gridColumn: 'span 2' }}>
              <h3><Play size={18} /> Start Competition Engine</h3>
              <div style={{ marginTop: '8px' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="number"
                    placeholder="Enter Game ID to Start Container Execution"
                    id="launchGameId"
                    style={styles.input}
                  />
                  <button
                    onClick={() => {
                      const id = document.getElementById('launchGameId').value;
                      if (id) handleStartGame(id);
                    }}
                    style={{ ...styles.btnPrimary, backgroundColor: '#10b981', width: 'auto', whiteSpace: 'nowrap' }}
                  >
                    Start Match
                  </button>
                </div>
                <span style={styles.helpText}>Triggers the background Celery task / Docker execution for the game session.</span>
              </div>
            </div>
          </div>
        )}

        {/* ================= ENVIRONMENTS VIEW ================= */}
        {activeTab === 'environments' && (
          <div style={styles.grid}>
            {/* Lookup Environment */}
            <div style={styles.card}>
              <h3><Search size={18} /> Lookup Environment</h3>
              <form onSubmit={fetchEnv} style={styles.form}>
                <div>
                  <div style={styles.row}>
                    <input
                      type="number"
                      placeholder="Env ID"
                      value={lookup.envId}
                      onChange={(e) => setLookup({ ...lookup, envId: e.target.value })}
                      style={styles.input}
                      required
                    />
                    <button type="submit" style={styles.btnPrimary}>Fetch</button>
                  </div>
                  <span style={styles.helpText}>Enter an Environment ID to view properties and source code.</span>
                </div>
              </form>

              {foundEnv && (
                <div style={styles.detailsBox}>
                  <p><strong>ID:</strong> {foundEnv.id}</p>
                  <p><strong>Name:</strong> {foundEnv.name}</p>
                  <p><strong>Min Agents:</strong> {foundEnv.min_agents}</p>
                  <p><strong>Max Agents:</strong> {foundEnv.max_agents}</p>
                  <p><strong>Creator ID:</strong> {foundEnv.creator}</p>
                  <p><strong>Code File:</strong> <a href={foundEnv.code_file} target="_blank" rel="noreferrer">Download Code</a></p>

                  {/* Code Viewer Toggle */}
                  <div style={{ margin: '12px 0' }}>
                    <button
                      onClick={() => {
                        if (!showEnvCode && !envCode) {
                          fetchCode(foundEnv.code_file, setEnvCode);
                        }
                        setShowEnvCode(!showEnvCode);
                      }}
                      style={styles.btnCodeViewer}
                    >
                      {showEnvCode ? <EyeOff size={16} /> : <Code size={16} />}
                      {showEnvCode ? 'Hide Source Code' : 'View Source Code'}
                    </button>

                    {showEnvCode && (
                      <pre style={styles.codeBlock}>
                        <code>{envCode || 'Loading code contents...'}</code>
                      </pre>
                    )}
                  </div>

                  <hr style={{ margin: '12px 0', border: '0.5px solid #e2e8f0' }} />
                  <h4><Edit3 size={16} /> Edit Environment (PUT / PATCH)</h4>

                  <div style={styles.form}>
                    <div>
                      <input
                        type="text"
                        value={editEnvData.name}
                        onChange={(e) => setEditEnvData({ ...editEnvData, name: e.target.value })}
                        placeholder="Env Name"
                        style={styles.input}
                      />
                      <span style={styles.helpText}>Updated title for this environment.</span>
                    </div>

                    <div style={styles.row}>
                      <div style={{ flex: 1 }}>
                        <input
                          type="number"
                          value={editEnvData.min_agents}
                          onChange={(e) => setEditEnvData({ ...editEnvData, min_agents: e.target.value })}
                          placeholder="Min Agents"
                          style={styles.input}
                        />
                        <span style={styles.helpText}>Minimum player limit.</span>
                      </div>
                      <div style={{ flex: 1 }}>
                        <input
                          type="number"
                          value={editEnvData.max_agents}
                          onChange={(e) => setEditEnvData({ ...editEnvData, max_agents: e.target.value })}
                          placeholder="Max Agents"
                          style={styles.input}
                        />
                        <span style={styles.helpText}>Maximum player limit.</span>
                      </div>
                    </div>

                    <div>
                      <label style={styles.fileLabel}>
                        <Upload size={16} /> Replace Python Script (.py) [Optional]
                        <input
                          type="file"
                          accept=".py"
                          onChange={(e) => setEditEnvData({ ...editEnvData, file: e.target.files[0] })}
                          style={{ display: 'none' }}
                        />
                      </label>
                      <span style={styles.helpText}>
                        {editEnvData.file ? `Selected: ${editEnvData.file.name}` : 'Leave empty if you do not want to replace the existing code file.'}
                      </span>
                    </div>

                    <div style={styles.row}>
                      <button type="button" onClick={() => handleUpdateEnv(false)} style={styles.btnPrimary}>PUT Update</button>
                      <button type="button" onClick={() => handleUpdateEnv(true)} style={styles.btnSecondary}>PATCH Update</button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Create Environment */}
            <div style={styles.card}>
              <h3><Shield size={18} /> Register New Environment</h3>
              <form onSubmit={handleUploadEnv} style={styles.form}>
                <div>
                  <input
                    type="text"
                    placeholder="Environment Name"
                    value={envData.name}
                    onChange={(e) => setEnvData({ ...envData, name: e.target.value })}
                    style={styles.input}
                    required
                  />
                  <span style={styles.helpText}>Unique identifier title for the simulation domain.</span>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <div style={{ flex: 1 }}>
                    <input
                      type="number"
                      placeholder="Min Agents"
                      value={envData.min_agents}
                      onChange={(e) => setEnvData({ ...envData, min_agents: e.target.value })}
                      style={styles.input}
                      required
                    />
                    <span style={styles.helpText}>Min required agents.</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <input
                      type="number"
                      placeholder="Max Agents"
                      value={envData.max_agents}
                      onChange={(e) => setEnvData({ ...envData, max_agents: e.target.value })}
                      style={styles.input}
                      required
                    />
                    <span style={styles.helpText}>Max allowed agents.</span>
                  </div>
                </div>

                <div>
                  <label style={styles.fileLabel}>
                    <Upload size={16} /> Select Environment File (.py)
                    <input
                      type="file"
                      accept=".py"
                      onChange={(e) => setEnvData({ ...envData, file: e.target.files[0] })}
                      style={{ display: 'none' }}
                      required
                    />
                  </label>
                  <span style={styles.helpText}>
                    {envData.file ? `Selected: ${envData.file.name}` : 'Must be a valid Python (.py) simulation file.'}
                  </span>
                </div>

                <button type="submit" style={styles.btnPrimary}>Upload Env</button>
              </form>
            </div>
          </div>
        )}

        {/* ================= AGENTS VIEW ================= */}
        {activeTab === 'agents' && (
          <div style={styles.grid}>
            {/* Lookup Agent */}
            <div style={styles.card}>
              <h3><Search size={18} /> Lookup Agent</h3>
              <form onSubmit={fetchAgent} style={styles.form}>
                <div>
                  <div style={styles.row}>
                    <input
                      type="number"
                      placeholder="Agent ID"
                      value={lookup.agentId}
                      onChange={(e) => setLookup({ ...lookup, agentId: e.target.value })}
                      style={styles.input}
                      required
                    />
                    <button type="submit" style={styles.btnPrimary}>Fetch</button>
                  </div>
                  <span style={styles.helpText}>Enter an Agent ID to view configuration and source code.</span>
                </div>
              </form>

              {foundAgent && (
                <div style={styles.detailsBox}>
                  <p><strong>ID:</strong> {foundAgent.id}</p>
                  <p><strong>Name:</strong> {foundAgent.name}</p>
                  <p><strong>Target Env ID:</strong> {foundAgent.env}</p>
                  <p><strong>Creator ID:</strong> {foundAgent.creator}</p>
                  <p><strong>Code File:</strong> <a href={foundAgent.code_file} target="_blank" rel="noreferrer">Download Code</a></p>

                  {/* Code Viewer Toggle */}
                  <div style={{ margin: '12px 0' }}>
                    <button
                      onClick={() => {
                        if (!showAgentCode && !agentCode) {
                          fetchCode(foundAgent.code_file, setAgentCode);
                        }
                        setShowAgentCode(!showAgentCode);
                      }}
                      style={styles.btnCodeViewer}
                    >
                      {showAgentCode ? <EyeOff size={16} /> : <Code size={16} />}
                      {showAgentCode ? 'Hide Source Code' : 'View Source Code'}
                    </button>

                    {showAgentCode && (
                      <pre style={styles.codeBlock}>
                        <code>{agentCode || 'Loading code contents...'}</code>
                      </pre>
                    )}
                  </div>

                  <hr style={{ margin: '12px 0', border: '0.5px solid #e2e8f0' }} />
                  <h4><Edit3 size={16} /> Edit Agent (PUT / PATCH)</h4>

                  <div style={styles.form}>
                    <div>
                      <input
                        type="text"
                        value={editAgentData.name}
                        onChange={(e) => setEditAgentData({ ...editAgentData, name: e.target.value })}
                        placeholder="Agent Name"
                        style={styles.input}
                      />
                      <span style={styles.helpText}>Updated name for this AI agent.</span>
                    </div>

                    <div>
                      <input
                        type="number"
                        value={editAgentData.env}
                        onChange={(e) => setEditAgentData({ ...editAgentData, env: e.target.value })}
                        placeholder="Target Env ID"
                        style={styles.input}
                      />
                      <span style={styles.helpText}>Environment ID compatible with this agent strategy.</span>
                    </div>

                    <div>
                      <label style={styles.fileLabel}>
                        <Upload size={16} /> Replace Python Script (.py) [Optional]
                        <input
                          type="file"
                          accept=".py"
                          onChange={(e) => setEditAgentData({ ...editAgentData, file: e.target.files[0] })}
                          style={{ display: 'none' }}
                        />
                      </label>
                      <span style={styles.helpText}>
                        {editAgentData.file ? `Selected: ${editAgentData.file.name}` : 'Leave empty if you do not want to replace the current script.'}
                      </span>
                    </div>

                    <div style={styles.row}>
                      <button type="button" onClick={() => handleUpdateAgent(false)} style={styles.btnPrimary}>PUT Update</button>
                      <button type="button" onClick={() => handleUpdateAgent(true)} style={styles.btnSecondary}>PATCH Update</button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Upload Agent */}
            <div style={styles.card}>
              <h3><Bot size={18} /> Upload Agent</h3>
              <form onSubmit={handleUploadAgent} style={styles.form}>
                <div>
                  <input
                    type="text"
                    placeholder="Agent Name"
                    value={agentData.name}
                    onChange={(e) => setAgentData({ ...agentData, name: e.target.value })}
                    style={styles.input}
                    required
                  />
                  <span style={styles.helpText}>Give your bot or agent strategy a recognizable name.</span>
                </div>

                <div>
                  <input
                    type="number"
                    placeholder="Target Environment ID"
                    value={agentData.env}
                    onChange={(e) => setAgentData({ ...agentData, env: e.target.value })}
                    style={styles.input}
                    required
                  />
                  <span style={styles.helpText}>Target Environment ID where this agent will compete.</span>
                </div>

                <div>
                  <label style={styles.fileLabel}>
                    <Upload size={16} /> Select Agent File (.py)
                    <input
                      type="file"
                      accept=".py"
                      onChange={(e) => setAgentData({ ...agentData, file: e.target.files[0] })}
                      style={{ display: 'none' }}
                      required
                    />
                  </label>
                  <span style={styles.helpText}>
                    {agentData.file ? `Selected: ${agentData.file.name}` : 'Must be a valid Python (.py) agent file.'}
                  </span>
                </div>

                <button type="submit" style={styles.btnPrimary}>Upload Agent</button>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// Layout Styles
const styles = {
  authContainer: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#f8fafc' },
  appWrapper: { maxWidth: '1000px', margin: '0 auto', fontFamily: 'system-ui, -apple-system, sans-serif', padding: '16px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '16px', borderBottom: '1px solid #e2e8f0' },
  nav: { display: 'flex', gap: '16px', margin: '20px 0', borderBottom: '1px solid #e2e8f0' },
  tabBtn: { background: 'none', border: 'none', padding: '8px 16px', cursor: 'pointer', fontWeight: '600' },
  main: { marginTop: '16px' },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' },
  card: { background: '#ffffff', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
  form: { display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' },
  row: { display: 'flex', gap: '8px' },
  input: { padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', width: '100%', boxSizing: 'border-box' },
  helpText: { display: 'block', fontSize: '0.75rem', color: '#64748b', marginTop: '4px' },
  fileLabel: { border: '1px dashed #cbd5e1', padding: '12px', borderRadius: '6px', textAlign: 'center', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#475569' },
  btnPrimary: { backgroundColor: '#6366f1', color: 'white', border: 'none', padding: '10px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' },
  btnSecondary: { backgroundColor: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', padding: '10px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' },
  btnCodeViewer: { display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#334155', color: '#ffffff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '500' },
  toggleAuth: { marginTop: '12px', textAlign: 'center', color: '#6366f1', cursor: 'pointer', fontSize: '0.875rem' },
  alert: { padding: '12px', borderRadius: '6px', marginBottom: '16px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid' },
  authErrorBox: { padding: '10px', backgroundColor: '#fef2f2', color: '#991b1b', borderRadius: '6px', border: '1px solid #fca5a5', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' },
  detailsBox: { marginTop: '16px', padding: '12px', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.9rem' },
  statusBadge: { backgroundColor: '#e0e7ff', color: '#3730a3', padding: '2px 8px', borderRadius: '12px', fontWeight: '600', fontSize: '0.8rem' },
  codeBlock: { backgroundColor: '#0f172a', color: '#38bdf8', padding: '12px', borderRadius: '6px', overflowX: 'auto', fontSize: '0.8rem', marginTop: '8px', maxHeight: '250px' }
};