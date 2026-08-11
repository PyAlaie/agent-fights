import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Play, Upload, Shield, Bot, Trophy, LogOut, PlusCircle, UserCheck, Search, Edit3, AlertCircle, List, RefreshCw, Download, User, Award } from 'lucide-react';

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

  const [activeTab, setActiveTab] = useState('lists');

  // Directory / List View States (All Resources)
  const [envList, setEnvList] = useState([]);
  const [agentList, setAgentList] = useState([]);
  const [gameList, setGameList] = useState([]);
  const [isLoadingLists, setIsLoadingLists] = useState(false);

  // User Profile States (My Resources)
  const [myEnvList, setMyEnvList] = useState([]);
  const [myAgentList, setMyAgentList] = useState([]);
  const [myGameList, setMyGameList] = useState([]);
  const [isLoadingMyLists, setIsLoadingMyLists] = useState(false);

  // Lookup IDs & Found Data States
  const [lookup, setLookup] = useState({ envId: '', agentId: '', gameId: '' });
  const [foundEnv, setFoundEnv] = useState(null);
  const [foundAgent, setFoundAgent] = useState(null);
  const [foundGame, setFoundGame] = useState(null);

  // Game Results States
  const [resultGameId, setResultGameId] = useState('');
  const [gameResult, setGameResult] = useState(null);
  const [resultError, setResultError] = useState('');
  const [isLoadingResult, setIsLoadingResult] = useState(false);

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

  // --- AUTHENTICATED FILE DOWNLOAD HANDLER ---
  const handleDownloadFile = async (fileUrl, fileName = 'download.py') => {
    try {
      const response = await axios.get(fileUrl, {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;

      const extractedName = fileUrl.split('/').pop() || fileName;
      link.setAttribute('download', extractedName);

      document.body.appendChild(link);
      link.click();

      link.remove();
      window.URL.revokeObjectURL(url);
      notify('File downloaded successfully!', 'success');
    } catch (err) {
      handleApiError(err, 'Failed to download file');
    }
  };

  // --- AUTHENTICATION ---
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

  // --- FETCH ALL LISTS API CALLS ---
  const fetchAllLists = async () => {
    setIsLoadingLists(true);
    try {
      const [envRes, agentRes, gameRes] = await Promise.all([
        axios.get(`${API_BASE}/api/envs/`),
        axios.get(`${API_BASE}/api/agents/`),
        axios.get(`${API_BASE}/api/games/`),
      ]);

      setEnvList(Array.isArray(envRes.data) ? envRes.data : envRes.data.results || []);
      setAgentList(Array.isArray(agentRes.data) ? agentRes.data : agentRes.data.results || []);
      setGameList(Array.isArray(gameRes.data) ? gameRes.data : gameRes.data.results || []);
      notify('Directories refreshed successfully.', 'info');
    } catch (err) {
      handleApiError(err, 'Failed to fetch directory lists');
    } finally {
      setIsLoadingLists(false);
    }
  };

  // --- FETCH USER PROFILE API CALLS ---
  const fetchMyLists = async () => {
    setIsLoadingMyLists(true);
    try {
      const [envRes, agentRes, gameRes] = await Promise.all([
        axios.get(`${API_BASE}/api/me/envs/`),
        axios.get(`${API_BASE}/api/me/agents/`),
        axios.get(`${API_BASE}/api/me/games/`),
      ]);

      setMyEnvList(Array.isArray(envRes.data) ? envRes.data : envRes.data.results || []);
      setMyAgentList(Array.isArray(agentRes.data) ? agentRes.data : agentRes.data.results || []);
      setMyGameList(Array.isArray(gameRes.data) ? gameRes.data : gameRes.data.results || []);
      notify('User profile refreshed successfully.', 'info');
    } catch (err) {
      handleApiError(err, 'Failed to fetch your lists');
    } finally {
      setIsLoadingMyLists(false);
    }
  };

  useEffect(() => {
    if (user) {
      if (activeTab === 'lists') fetchAllLists();
      if (activeTab === 'profile') fetchMyLists();
    }
  }, [user, activeTab]);

  // --- SINGLE LOOKUP ACTIONS ---
  const fetchEnv = async (e, id = null) => {
    e?.preventDefault();
    const targetId = id || lookup.envId;
    if (!targetId) return;

    try {
      const res = await axios.get(`${API_BASE}/api/envs/${targetId}/`);
      setFoundEnv(res.data);
      setEditEnvData({ name: res.data.name, min_agents: res.data.min_agents, max_agents: res.data.max_agents, file: null });
      setLookup((prev) => ({ ...prev, envId: targetId }));
      if (id) setActiveTab('environments');
      notify(`Loaded Environment #${res.data.id}`, 'success');
    } catch (err) {
      setFoundEnv(null);
      handleApiError(err, 'Failed to fetch environment');
    }
  };

  const fetchAgent = async (e, id = null) => {
    e?.preventDefault();
    const targetId = id || lookup.agentId;
    if (!targetId) return;

    try {
      const res = await axios.get(`${API_BASE}/api/agents/${targetId}/`);
      setFoundAgent(res.data);
      setEditAgentData({ name: res.data.name, env: res.data.env, file: null });
      setLookup((prev) => ({ ...prev, agentId: targetId }));
      if (id) setActiveTab('agents');
      notify(`Loaded Agent #${res.data.id}`, 'success');
    } catch (err) {
      setFoundAgent(null);
      handleApiError(err, 'Failed to fetch agent');
    }
  };

  const fetchGame = async (e, id = null) => {
    e?.preventDefault();
    const targetId = id || lookup.gameId;
    if (!targetId) return;

    try {
      const res = await axios.get(`${API_BASE}/api/games/${targetId}/`);
      setFoundGame(res.data);
      setEditGameData({ name: res.data.name, env: res.data.env });
      setLookup((prev) => ({ ...prev, gameId: targetId }));
      if (id) setActiveTab('games');
      notify(`Loaded Game #${res.data.id}`, 'success');
    } catch (err) {
      setFoundGame(null);
      handleApiError(err, 'Failed to fetch game');
    }
  };

  // --- FETCH GAME RESULTS WITH INLINE ERROR HANDLING ---
  const fetchGameResult = async (e, id = null) => {
    e?.preventDefault();
    const targetId = id || resultGameId;
    if (!targetId) return;

    setIsLoadingResult(true);
    setResultError('');
    setGameResult(null);

    try {
      const res = await axios.get(`${API_BASE}/api/games/${targetId}/result/`);
      setGameResult(res.data);
      setResultGameId(targetId);
      if (id) setActiveTab('results');
      notify(`Loaded results for Game #${targetId}`, 'success');
    } catch (err) {
      setGameResult(null);
      const errMsg = err.response?.data?.detail || err.response?.data?.error || 'Failed to fetch game result';
      setResultError(errMsg);
      handleApiError(err, 'Failed to fetch game result');
    } finally {
      setIsLoadingResult(false);
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
      const res = await axios.post(`${API_BASE}/api/envs/`, formData);
      notify(`Environment Created! (ID: ${res.data.id})`, 'success');
      setEnvData({ name: '', min_agents: 1, max_agents: 4, file: null });
      fetchAllLists();
      if (activeTab === 'profile') fetchMyLists();
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
      fetchAllLists();
      if (activeTab === 'profile') fetchMyLists();
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
      fetchAllLists();
      if (activeTab === 'profile') fetchMyLists();
    } catch (err) {
      handleApiError(err, 'Failed to create game room');
    }
  };

  const handleSubmitAgentToGame = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_BASE}/api/games/${submissionData.gameId}/agent-submission/`, {
        agent_id: submissionData.agentId,
      });
      notify('Agent submitted to game successfully!', 'success');
      fetchAllLists();
      if (activeTab === 'profile') fetchMyLists();
    } catch (err) {
      handleApiError(err, 'Submission failed');
    }
  };

  const handleStartGame = async (gameId) => {
    try {
      const res = await axios.get(`${API_BASE}/api/games/${gameId}/start/`);
      notify(`Game Execution Triggered! Task ID: ${res.data.task_id}`, 'success');
      fetchAllLists();
      if (activeTab === 'profile') fetchMyLists();
    } catch (err) {
      handleApiError(err, 'Failed to start game');
    }
  };

  // --- UPDATE (PUT / PATCH) ACTIONS ---
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
        url: `${API_BASE}/api/envs/${foundEnv.id}/`,
        data: formData,
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      notify(`Environment #${foundEnv.id} updated via ${method.toUpperCase()}!`, 'success');
      fetchEnv(null, foundEnv.id);
      fetchAllLists();
      if (activeTab === 'profile') fetchMyLists();
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
        url: `${API_BASE}/api/agents/${foundAgent.id}/`,
        data: formData,
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      notify(`Agent #${foundAgent.id} updated via ${method.toUpperCase()}!`, 'success');
      fetchAgent(null, foundAgent.id);
      fetchAllLists();
      if (activeTab === 'profile') fetchMyLists();
    } catch (err) {
      handleApiError(err, 'Failed to update agent');
    }
  };

  const handleUpdateGame = async (isPatch = false) => {
    if (!foundGame) return;
    const method = isPatch ? 'patch' : 'put';
    try {
      await axios[method](`${API_BASE}/api/games/${foundGame.id}/`, editGameData);
      notify(`Game #${foundGame.id} updated via ${method.toUpperCase()}!`, 'success');
      fetchGame(null, foundGame.id);
      fetchAllLists();
      if (activeTab === 'profile') fetchMyLists();
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
              <span style={styles.helpText}>Enter your registered username or pick a unique handle.</span>
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
              <span style={styles.helpText}>Must be at least 8 characters long.</span>
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
      {/* Header */}
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
        {[
          { key: 'lists', label: 'ALL LISTS (DIRECTORY)', icon: <List size={16} /> },
          { key: 'profile', label: 'MY PROFILE', icon: <User size={16} /> },
          { key: 'games', label: 'GAMES', icon: <Trophy size={16} /> },
          { key: 'results', label: 'GAME RESULTS', icon: <Award size={16} /> },
          { key: 'environments', label: 'ENVIRONMENTS', icon: <Shield size={16} /> },
          { key: 'agents', label: 'AGENTS', icon: <Bot size={16} /> },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              ...styles.tabBtn,
              borderBottom: activeTab === tab.key ? '2px solid #6366f1' : 'none',
              color: activeTab === tab.key ? '#6366f1' : '#64748b',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </nav>

      {/* Main Content Area */}
      <main style={styles.main}>
        {/* ================= ALL LISTS (DIRECTORY) VIEW ================= */}
        {activeTab === 'lists' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2><List size={20} /> Registered System Resources</h2>
              <button onClick={fetchAllLists} disabled={isLoadingLists} style={styles.btnSecondary}>
                <RefreshCw size={16} className={isLoadingLists ? 'spin' : ''} /> Refresh All
              </button>
            </div>

            <div style={styles.tripleGrid}>
              {/* ENVIRONMENTS LIST */}
              <div style={styles.card}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Shield size={18} color="#6366f1" /> Environments ({envList.length})
                </h3>
                <div style={styles.scrollList}>
                  {envList.length === 0 ? (
                    <p style={styles.emptyText}>No environments registered.</p>
                  ) : (
                    envList.map((env) => (
                      <div key={env.id} style={styles.listItem}>
                        <div style={{ flex: 1, paddingRight: '8px' }}>
                          <strong style={{ fontSize: '0.95rem' }}>{env.name}</strong>
                          <div style={styles.subText}><strong>ID:</strong> #{env.id}</div>
                          <div style={styles.subText}>Min Agents: {env.min_agents} | Max Agents: {env.max_agents}</div>
                          <div style={styles.subText}>Creator ID: #{env.creator ?? 'N/A'}</div>
                          {env.code_file && (
                            <div style={styles.subText}>
                              <button
                                onClick={() => handleDownloadFile(env.code_file, `${env.name}_env.py`)}
                                style={styles.btnLink}
                              >
                                <Download size={12} /> Download Code File
                              </button>
                            </div>
                          )}
                        </div>
                        <div>
                          <button onClick={() => fetchEnv(null, env.id)} style={styles.btnSmall}>Inspect</button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* AGENTS LIST */}
              <div style={styles.card}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Bot size={18} color="#10b981" /> Agents ({agentList.length})
                </h3>
                <div style={styles.scrollList}>
                  {agentList.length === 0 ? (
                    <p style={styles.emptyText}>No agents uploaded.</p>
                  ) : (
                    agentList.map((agent) => (
                      <div key={agent.id} style={styles.listItem}>
                        <div style={{ flex: 1, paddingRight: '8px' }}>
                          <strong style={{ fontSize: '0.95rem' }}>{agent.name}</strong>
                          <div style={styles.subText}><strong>ID:</strong> #{agent.id}</div>
                          <div style={styles.subText}>Target Env ID: #{agent.env}</div>
                          <div style={styles.subText}>Creator ID: #{agent.creator ?? 'N/A'}</div>
                          {agent.code_file && (
                            <div style={styles.subText}>
                              <button
                                onClick={() => handleDownloadFile(agent.code_file, `${agent.name}_agent.py`)}
                                style={styles.btnLink}
                              >
                                <Download size={12} /> Download Code File
                              </button>
                            </div>
                          )}
                        </div>
                        <div>
                          <button onClick={() => fetchAgent(null, agent.id)} style={styles.btnSmall}>Inspect</button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* GAMES LIST */}
              <div style={styles.card}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Trophy size={18} color="#f59e0b" /> Games ({gameList.length})
                </h3>
                <div style={styles.scrollList}>
                  {gameList.length === 0 ? (
                    <p style={styles.emptyText}>No game rooms created.</p>
                  ) : (
                    gameList.map((game) => (
                      <div key={game.id} style={styles.listItem}>
                        <div style={{ flex: 1, paddingRight: '8px' }}>
                          <strong style={{ fontSize: '0.95rem' }}>{game.name}</strong>
                          <div style={styles.subText}><strong>ID:</strong> #{game.id}</div>
                          <div style={styles.subText}>Target Env ID: #{game.env}</div>
                          <div style={styles.subText}>Creator ID: #{game.creator ?? 'N/A'}</div>
                          <div style={styles.subText}>
                            Status: <span style={styles.statusBadge}>{formatGameStatus(game.status)}</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <button onClick={() => fetchGame(null, game.id)} style={styles.btnSmall}>Inspect</button>
                          <button 
                            onClick={() => fetchGameResult(null, game.id)} 
                            style={{...styles.btnSmall, backgroundColor: '#e0e7ff', borderColor: '#c7d2fe', color: '#3730a3'}}
                          >
                            Results
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= MY PROFILE VIEW ================= */}
        {activeTab === 'profile' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2><User size={20} /> My Profile & Resources</h2>
              <button onClick={fetchMyLists} disabled={isLoadingMyLists} style={styles.btnSecondary}>
                <RefreshCw size={16} className={isLoadingMyLists ? 'spin' : ''} /> Refresh Profile
              </button>
            </div>

            <div style={styles.tripleGrid}>
              {/* MY ENVIRONMENTS LIST */}
              <div style={styles.card}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Shield size={18} color="#6366f1" /> My Environments ({myEnvList.length})
                </h3>
                <div style={styles.scrollList}>
                  {myEnvList.length === 0 ? (
                    <p style={styles.emptyText}>You haven't registered any environments.</p>
                  ) : (
                    myEnvList.map((env) => (
                      <div key={env.id} style={styles.listItem}>
                        <div style={{ flex: 1, paddingRight: '8px' }}>
                          <strong style={{ fontSize: '0.95rem' }}>{env.name}</strong>
                          <div style={styles.subText}><strong>ID:</strong> #{env.id}</div>
                          <div style={styles.subText}>Min Agents: {env.min_agents} | Max Agents: {env.max_agents}</div>
                          {env.code_file && (
                            <div style={styles.subText}>
                              <button
                                onClick={() => handleDownloadFile(env.code_file, `${env.name}_env.py`)}
                                style={styles.btnLink}
                              >
                                <Download size={12} /> Download Code File
                              </button>
                            </div>
                          )}
                        </div>
                        <div>
                          <button onClick={() => fetchEnv(null, env.id)} style={styles.btnSmall}>Inspect</button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* MY AGENTS LIST */}
              <div style={styles.card}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Bot size={18} color="#10b981" /> My Agents ({myAgentList.length})
                </h3>
                <div style={styles.scrollList}>
                  {myAgentList.length === 0 ? (
                    <p style={styles.emptyText}>You haven't uploaded any agents.</p>
                  ) : (
                    myAgentList.map((agent) => (
                      <div key={agent.id} style={styles.listItem}>
                        <div style={{ flex: 1, paddingRight: '8px' }}>
                          <strong style={{ fontSize: '0.95rem' }}>{agent.name}</strong>
                          <div style={styles.subText}><strong>ID:</strong> #{agent.id}</div>
                          <div style={styles.subText}>Target Env ID: #{agent.env}</div>
                          {agent.code_file && (
                            <div style={styles.subText}>
                              <button
                                onClick={() => handleDownloadFile(agent.code_file, `${agent.name}_agent.py`)}
                                style={styles.btnLink}
                              >
                                <Download size={12} /> Download Code File
                              </button>
                            </div>
                          )}
                        </div>
                        <div>
                          <button onClick={() => fetchAgent(null, agent.id)} style={styles.btnSmall}>Inspect</button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* MY GAMES LIST */}
              <div style={styles.card}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Trophy size={18} color="#f59e0b" /> My Games ({myGameList.length})
                </h3>
                <div style={styles.scrollList}>
                  {myGameList.length === 0 ? (
                    <p style={styles.emptyText}>You haven't created any game rooms.</p>
                  ) : (
                    myGameList.map((game) => (
                      <div key={game.id} style={styles.listItem}>
                        <div style={{ flex: 1, paddingRight: '8px' }}>
                          <strong style={{ fontSize: '0.95rem' }}>{game.name}</strong>
                          <div style={styles.subText}><strong>ID:</strong> #{game.id}</div>
                          <div style={styles.subText}>Target Env ID: #{game.env}</div>
                          <div style={styles.subText}>
                            Status: <span style={styles.statusBadge}>{formatGameStatus(game.status)}</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <button onClick={() => fetchGame(null, game.id)} style={styles.btnSmall}>Inspect</button>
                          <button 
                            onClick={() => fetchGameResult(null, game.id)} 
                            style={{...styles.btnSmall, backgroundColor: '#e0e7ff', borderColor: '#c7d2fe', color: '#3730a3'}}
                          >
                            Results
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

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
                  
                  <div style={{ marginTop: '12px' }}>
                    <button onClick={() => fetchGameResult(null, foundGame.id)} style={{...styles.btnSecondary, backgroundColor: '#e0e7ff', borderColor: '#c7d2fe', color: '#3730a3'}}>
                      <Award size={14} /> View Match Results
                    </button>
                  </div>

                  <hr style={{ margin: '16px 0', border: '0.5px solid #e2e8f0' }} />
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

        {/* ================= GAME RESULTS VIEW ================= */}
        {activeTab === 'results' && (
          <div style={styles.grid}>
            <div style={{ ...styles.card, gridColumn: '1 / -1' }}>
              <h3><Award size={18} /> Game Results Viewer</h3>
              <form onSubmit={(e) => fetchGameResult(e)} style={styles.form}>
                <div>
                  <div style={styles.row}>
                    <input
                      type="number"
                      placeholder="Enter Game ID to View Results"
                      value={resultGameId}
                      onChange={(e) => {
                        setResultGameId(e.target.value);
                        setResultError('');
                      }}
                      style={styles.input}
                      required
                    />
                    <button type="submit" disabled={isLoadingResult} style={{...styles.btnPrimary, width: '200px'}}>
                      {isLoadingResult ? 'Loading...' : 'Fetch Results'}
                    </button>
                  </div>
                  <span style={styles.helpText}>Enter the numerical ID of a completed game to inspect scores, rankings, and logs.</span>
                </div>
              </form>

              {/* Explicit Inline Error Banner for Game Results */}
              {resultError && (
                <div style={{ ...styles.authErrorBox, marginTop: '16px' }}>
                  <AlertCircle size={18} />
                  <span><strong>Error:</strong> {resultError}</span>
                </div>
              )}

              {gameResult && (
                <div style={styles.detailsBox}>
                  <h4 style={{ marginBottom: '8px', color: '#1e293b' }}>Result Overview for Game #{resultGameId}</h4>
                  <pre style={styles.jsonBox}>
                    {JSON.stringify(gameResult, null, 2)}
                  </pre>
                </div>
              )}
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
                  <span style={styles.helpText}>Enter the numerical ID of the environment.</span>
                </div>
              </form>

              {foundEnv && (
                <div style={styles.detailsBox}>
                  <p><strong>ID:</strong> {foundEnv.id}</p>
                  <p><strong>Name:</strong> {foundEnv.name}</p>
                  <p><strong>Min / Max Agents:</strong> {foundEnv.min_agents} / {foundEnv.max_agents}</p>
                  <p><strong>Creator ID:</strong> {foundEnv.creator}</p>
                  {foundEnv.code_file && (
                    <p>
                      <strong>Source File:</strong>{' '}
                      <button
                        onClick={() => handleDownloadFile(foundEnv.code_file, `${foundEnv.name}_env.py`)}
                        style={styles.btnLink}
                      >
                        <Download size={14} /> Download Script
                      </button>
                    </p>
                  )}

                  <hr style={{ margin: '12px 0', border: '0.5px solid #e2e8f0' }} />
                  <h4><Edit3 size={16} /> Edit Environment (PUT / PATCH)</h4>
                  <div style={styles.form}>
                    <div>
                      <input
                        type="text"
                        value={editEnvData.name}
                        onChange={(e) => setEditEnvData({ ...editEnvData, name: e.target.value })}
                        placeholder="Name"
                        style={styles.input}
                      />
                      <span style={styles.helpText}>Update environment title.</span>
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
                        <span style={styles.helpText}>Min agents allowed.</span>
                      </div>
                      <div style={{ flex: 1 }}>
                        <input
                          type="number"
                          value={editEnvData.max_agents}
                          onChange={(e) => setEditEnvData({ ...editEnvData, max_agents: e.target.value })}
                          placeholder="Max Agents"
                          style={styles.input}
                        />
                        <span style={styles.helpText}>Max agents allowed.</span>
                      </div>
                    </div>

                    <div>
                      <input
                        type="file"
                        onChange={(e) => setEditEnvData({ ...editEnvData, file: e.target.files[0] })}
                        style={styles.input}
                      />
                      <span style={styles.helpText}>Optionally replace Python environment code script.</span>
                    </div>

                    <div style={styles.row}>
                      <button type="button" onClick={() => handleUpdateEnv(false)} style={styles.btnPrimary}>PUT Update</button>
                      <button type="button" onClick={() => handleUpdateEnv(true)} style={styles.btnSecondary}>PATCH Update</button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Upload Environment */}
            <div style={styles.card}>
              <h3><Upload size={18} /> Upload Environment</h3>
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
                  <span style={styles.helpText}>Descriptive title (e.g. Chess Engine, GridWorld v2).</span>
                </div>

                <div style={styles.row}>
                  <div style={{ flex: 1 }}>
                    <input
                      type="number"
                      placeholder="Min Agents"
                      value={envData.min_agents}
                      onChange={(e) => setEnvData({ ...envData, min_agents: e.target.value })}
                      style={styles.input}
                      required
                    />
                    <span style={styles.helpText}>Minimum required players.</span>
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
                    <span style={styles.helpText}>Maximum capacity.</span>
                  </div>
                </div>

                <div>
                  <input
                    type="file"
                    onChange={(e) => setEnvData({ ...envData, file: e.target.files[0] })}
                    style={styles.input}
                    required
                  />
                  <span style={styles.helpText}>Python file containing environment class definition.</span>
                </div>

                <button type="submit" style={styles.btnPrimary}>Upload Environment</button>
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
                  <span style={styles.helpText}>Enter numerical ID of the agent script.</span>
                </div>
              </form>

              {foundAgent && (
                <div style={styles.detailsBox}>
                  <p><strong>ID:</strong> {foundAgent.id}</p>
                  <p><strong>Name:</strong> {foundAgent.name}</p>
                  <p><strong>Env ID:</strong> {foundAgent.env}</p>
                  <p><strong>Creator ID:</strong> {foundAgent.creator}</p>
                  {foundAgent.code_file && (
                    <p>
                      <strong>Source File:</strong>{' '}
                      <button
                        onClick={() => handleDownloadFile(foundAgent.code_file, `${foundAgent.name}_agent.py`)}
                        style={styles.btnLink}
                      >
                        <Download size={14} /> Download Script
                      </button>
                    </p>
                  )}

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
                      <span style={styles.helpText}>Update agent display title.</span>
                    </div>

                    <div>
                      <input
                        type="number"
                        value={editAgentData.env}
                        onChange={(e) => setEditAgentData({ ...editAgentData, env: e.target.value })}
                        placeholder="Target Env ID"
                        style={styles.input}
                      />
                      <span style={styles.helpText}>Compatible Environment ID.</span>
                    </div>

                    <div>
                      <input
                        type="file"
                        onChange={(e) => setEditAgentData({ ...editAgentData, file: e.target.files[0] })}
                        style={styles.input}
                      />
                      <span style={styles.helpText}>Replace Python agent code executable.</span>
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
              <h3><Upload size={18} /> Upload Agent</h3>
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
                  <span style={styles.helpText}>Descriptive title for your RL/heuristic model.</span>
                </div>

                <div>
                  <input
                    type="number"
                    placeholder="Target Env ID"
                    value={agentData.env}
                    onChange={(e) => setAgentData({ ...agentData, env: e.target.value })}
                    style={styles.input}
                    required
                  />
                  <span style={styles.helpText}>Target environment where this agent is valid to execute.</span>
                </div>

                <div>
                  <input
                    type="file"
                    onChange={(e) => setAgentData({ ...agentData, file: e.target.files[0] })}
                    style={styles.input}
                    required
                  />
                  <span style={styles.helpText}>Python file implementing the agent interaction logic.</span>
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

// 4. Embedded Inline Styles
const styles = {
  appWrapper: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    backgroundColor: '#f8fafc',
    minHeight: '100vh',
    color: '#0f172a',
  },
  header: {
    backgroundColor: '#ffffff',
    borderBottom: '1px solid #e2e8f0',
    padding: '16px 32px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  nav: {
    backgroundColor: '#ffffff',
    borderBottom: '1px solid #e2e8f0',
    padding: '0 32px',
    display: 'flex',
    gap: '24px',
  },
  tabBtn: {
    background: 'none',
    border: 'none',
    padding: '16px 0',
    fontWeight: '600',
    fontSize: '0.875rem',
    cursor: 'pointer',
  },
  main: {
    padding: '32px',
    maxWidth: '1280px',
    margin: '0 auto',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
    gap: '24px',
  },
  tripleGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: '24px',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    padding: '24px',
    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    marginTop: '16px',
  },
  row: {
    display: 'flex',
    gap: '12px',
  },
  input: {
    width: '100%',
    padding: '8px 12px',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    fontSize: '0.875rem',
    boxSizing: 'border-box',
  },
  helpText: {
    fontSize: '0.75rem',
    color: '#64748b',
    marginTop: '4px',
    display: 'block',
  },
  btnPrimary: {
    backgroundColor: '#6366f1',
    color: '#ffffff',
    border: 'none',
    padding: '10px 16px',
    borderRadius: '6px',
    fontWeight: '600',
    cursor: 'pointer',
    width: '100%',
  },
  btnSecondary: {
    backgroundColor: '#ffffff',
    color: '#334155',
    border: '1px solid #cbd5e1',
    padding: '8px 12px',
    borderRadius: '6px',
    fontWeight: '500',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
  },
  btnSmall: {
    backgroundColor: '#f1f5f9',
    color: '#334155',
    border: '1px solid #cbd5e1',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '0.75rem',
    cursor: 'pointer',
    fontWeight: '500',
  },
  btnLink: {
    background: 'none',
    border: 'none',
    color: '#6366f1',
    cursor: 'pointer',
    padding: 0,
    fontSize: '0.875rem',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    fontWeight: '500',
  },
  detailsBox: {
    marginTop: '16px',
    padding: '16px',
    backgroundColor: '#f8fafc',
    borderRadius: '6px',
    border: '1px solid #e2e8f0',
  },
  jsonBox: {
    backgroundColor: '#0f172a',
    color: '#f8fafc',
    padding: '16px',
    borderRadius: '6px',
    overflowX: 'auto',
    fontSize: '0.85rem',
    fontFamily: 'monospace',
    marginTop: '8px',
    maxHeight: '500px',
  },
  alert: {
    padding: '12px 16px',
    borderRadius: '6px',
    border: '1px solid',
    marginBottom: '24px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '0.875rem',
  },
  authContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    backgroundColor: '#f1f5f9',
  },
  authErrorBox: {
    backgroundColor: '#fef2f2',
    color: '#991b1b',
    padding: '10px 12px',
    borderRadius: '6px',
    fontSize: '0.85rem',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '12px',
    border: '1px solid #fca5a5',
  },
  toggleAuth: {
    marginTop: '16px',
    textAlign: 'center',
    color: '#6366f1',
    cursor: 'pointer',
    fontSize: '0.875rem',
  },
  scrollList: {
    maxHeight: '400px',
    overflowY: 'auto',
    marginTop: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  listItem: {
    padding: '10px',
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    backgroundColor: '#f8fafc',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  subText: {
    fontSize: '0.75rem',
    color: '#64748b',
    marginTop: '2px',
  },
  statusBadge: {
    display: 'inline-block',
    padding: '2px 6px',
    backgroundColor: '#e0e7ff',
    color: '#3730a3',
    borderRadius: '4px',
    fontSize: '0.75rem',
    fontWeight: '600',
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: '0.875rem',
    fontStyle: 'italic',
  },
};