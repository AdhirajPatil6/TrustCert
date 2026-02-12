
import { useState, useEffect } from 'react'
import './App.css'
import axios from 'axios'
import CryptoJS from 'crypto-js'
import DatePicker from "react-datepicker"
import "react-datepicker/dist/react-datepicker.css"
import { FiUser, FiMail, FiLock, FiCalendar, FiFile, FiHash, FiLogOut, FiPlus, FiTrash, FiClock, FiClipboard, FiCheck, FiDownload, FiShield } from "react-icons/fi"
import DashboardAdmin from './DashboardAdmin';
import DashboardStudent from './DashboardStudent';
import DashboardFaculty from './DashboardFaculty';
import DashboardVerifier from './DashboardVerifier';

const API_BASE = "http://127.0.0.1:8000";

// --- Reusable UI ---
const InputGroup = ({ icon: Icon, children }) => (
  <div className="input-group">
    {Icon && <Icon className="input-icon" />}
    {children}
  </div>
);

// Helper for robust date parsing (handles backend naive datetime)
const parseDate = (iso) => {
  if (!iso) return new Date();
  return new Date(iso.endsWith("Z") ? iso : iso + "Z");
};

function App() {
  // Views: landing, register, login, create, dashboard, unlock
  const [view, setView] = useState('landing');
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));

  // UI Message State
  const [message, setMessage] = useState(null);

  // Auth state
  const [authForm, setAuthForm] = useState({ username: '', email: '', password: '', role: 'student' });

  // Vault state
  const [myVaults, setMyVaults] = useState([]);
  const [formData, setFormData] = useState({ file: null, unlockTime: null, beneficiary: '' });
  const [loading, setLoading] = useState(false);

  // Decrypted Keys Map: { [appId]: "secret_key" }
  const [decryptedKeys, setDecryptedKeys] = useState({});
  const [copiedId, setCopiedId] = useState(null);

  // --- Auth Helpers ---
  const getHeaders = () => ({ headers: { Authorization: `Bearer ${token}` } });

  useEffect(() => {
    if (token) {
      // Fetch User
      axios.get(`${API_BASE}/users/me`, getHeaders())
        .then(res => {
          setUser(res.data);
          setView('dashboard');
          fetchMyVaults();
        })
        .catch(() => {
          logout();
        });
    }
  }, [token]);

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    setView('landing');
  };

  const handleRegister = async () => {
    try {
      const res = await axios.post(`${API_BASE}/register`, authForm);
      setToken(res.data.access_token);
      localStorage.setItem('token', res.data.access_token);
      setMessage({ type: 'success', text: "Registration Successful!" });
    } catch (err) {
      setMessage({ type: 'error', text: "Registration Failed: " + (err.response?.data?.detail || err.message) });
    }
  };

  const handleLogin = async () => {
    try {
      const params = new URLSearchParams();
      params.append('username', authForm.username);
      params.append('password', authForm.password);

      const res = await axios.post(`${API_BASE}/token`, params);
      setToken(res.data.access_token);
      localStorage.setItem('token', res.data.access_token);
    } catch (err) {
      setMessage({ type: 'error', text: "Login Failed: Check credentials" });
    }
  };

  // --- Main Logic ---

  const fetchMyVaults = async () => {
    try {
      const res = await axios.get(`${API_BASE}/my-vaults`, getHeaders());
      setMyVaults(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const deleteVault = async (appId) => {
    if (!window.confirm("Are you sure you want to delete this vault? This action cannot be undone.")) return;

    try {
      await axios.delete(`${API_BASE}/delete-vault/${appId}`, getHeaders());
      setMessage({ type: 'success', text: "Vault deleted successfully." });
      fetchMyVaults();
    } catch (err) {
      setMessage({ type: 'error', text: "Failed to delete vault." });
    }
  };

  const createVault = async () => {
    if (!formData.file || !formData.unlockTime) {
      setMessage({ type: 'error', text: "Please fill all fields" });
      return;
    }
    setLoading(true);
    setMessage({ type: 'info', text: "Encrypting and Minting..." });

    try {
      const key = CryptoJS.lib.WordArray.random(256 / 8).toString();
      const reader = new FileReader();

      reader.onload = async (e) => {
        const fileContent = e.target.result;
        const encrypted = CryptoJS.AES.encrypt(fileContent, key).toString();

        // 2. Upload Encrypted BLOB
        const blob = new Blob([encrypted], { type: 'text/plain' });
        const uploadForm = new FormData();
        uploadForm.append('file', blob, formData.file.name + ".enc");

        const ipfsRes = await axios.post(`${API_BASE}/upload`, uploadForm, getHeaders());
        const ipfsHash = ipfsRes.data.ipfs_hash;

        // 3. Create Smart Contract (MOCKED)
        const mockAppId = Math.floor(Math.random() * 1000000);

        // 4. Send Key to Escrow (DB)
        await axios.post(`${API_BASE}/store-key`, {
          app_id: mockAppId,
          encrypted_key: key,
          unlock_time: formData.unlockTime.toISOString(),
          ipfs_hash: ipfsHash,
          beneficiary: formData.beneficiary || "None",
          filename: formData.file.name
        }, getHeaders());

        setMessage({ type: 'success', text: `Vault Created! ID: ${mockAppId}` });
        fetchMyVaults();
        setView('dashboard');
        setLoading(false);
      };
      reader.readAsDataURL(formData.file);

    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: "Failed to create vault" });
      setLoading(false);
    }
  };

  const getRemainingTime = (isoDate) => {
    const target = parseDate(isoDate);
    const now = new Date();
    const diff = target - now;

    if (diff <= 0) return null;

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((diff / 1000 / 60) % 60);
    const seconds = Math.floor((diff / 1000) % 60);

    return `${days}d ${hours}h ${minutes}m ${seconds}s`;
  };

  const unlockVault = async (vaultId, unlockTimeStr) => {
    // Client-side pre-check for better UX
    const remaining = getRemainingTime(unlockTimeStr);

    if (remaining) {
      // Show dynamic remaining time in notification if possible, or just static message
      setMessage({ type: 'error', text: `Vault is LOCKED. Time remaining: ${remaining}` });
      return;
    }

    try {
      setLoading(true);
      setMessage(null); // Clear previous
      const res = await axios.get(`${API_BASE}/release-key/${vaultId}`, getHeaders());

      // Store key in map
      setDecryptedKeys(prev => ({ ...prev, [vaultId]: res.data.key }));
      setMessage({ type: 'success', text: "Success! Key Retrieved." });

      // Update local state to reflect unlocked
      setMyVaults(prev => prev.map(v => v.app_id === vaultId ? { ...v, status: 'UNLOCKED' } : v));

    } catch (err) {
      // Improved error message with fallback for subtle mismatches
      const msg = err.response?.data?.detail || "Access Denied: Vault is LOCKED";
      setMessage({ type: 'error', text: msg });
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (vaultId, ipfsHash, filename) => {
    try {
      const key = decryptedKeys[vaultId];
      if (!key) return;

      setMessage({ type: 'info', text: "Fetching & Decrypting..." });

      // 1. Fetch Encrypted Content
      const res = await axios.get(`${API_BASE}/ipfs/${ipfsHash}`, { responseType: 'text' });
      const encryptedContent = res.data;

      // 2. Decrypt
      const decryptedBytes = CryptoJS.AES.decrypt(encryptedContent, key);
      const decryptedDataUrl = decryptedBytes.toString(CryptoJS.enc.Utf8);

      if (!decryptedDataUrl.startsWith("data:")) {
        throw new Error("Decryption failed or invalid format");
      }

      // 3. Download
      const link = document.createElement("a");
      link.href = decryptedDataUrl;

      // Use original filename if available, otherwise construct one
      if (filename) {
        link.download = filename;
      } else {
        const mime = decryptedDataUrl.split(';')[0].split(':')[1];
        const ext = mime ? mime.split('/')[1] : "bin";
        link.download = `vault_${vaultId}_unlocked.${ext}`;
      }

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setMessage({ type: 'success', text: "Download Started!" });

    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: "Failed to decrypt/download file." });
    }
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // --- Render ---
  // Helper to render message
  const renderMessage = () => {
    if (!message) return null;
    return <div className={`message ${message.type}`}>{message.text}</div>;
  };

  if (!user && view === 'landing') {
    return (
      <div className="app-container">
        <nav><div className="logo"><FiShield /> TrustCert</div>
          <div>
            <button className="secondary-btn" onClick={() => setView('login')}>Login</button>
            <button className="secondary-btn" onClick={() => setView('verify')}>Verify Cert</button>
            <button className="primary-btn" onClick={() => setView('register')}>Get Started</button>
          </div>
        </nav>
        <header className="hero">
          <h1>TrustCert: Campus Credentials</h1>
          <p>AI-Verified. Condition-Locked. Blockchain-Secured.</p>
          <div className="hero-actions">
            <button className="primary-btn large" onClick={() => setView('register')}>Get Started</button>
          </div>
        </header>
      </div>
    );
  }

  if (!user && (view === 'login' || view === 'register')) {
    return (
      <div className="app-container">
        <div className="card auth-card">
          <h2>{view === 'login' ? 'Welcome Back' : 'Create Account'}</h2>
          {renderMessage()}

          <InputGroup icon={FiUser}>
            <input placeholder="Username" onChange={e => setAuthForm({ ...authForm, username: e.target.value })} />
          </InputGroup>

          {view === 'register' && (
            <InputGroup icon={FiMail}>
              <input placeholder="Email" onChange={e => setAuthForm({ ...authForm, email: e.target.value })} />
            </InputGroup>
          )}

          <InputGroup icon={FiLock}>
            <input type="password" placeholder="Password" onChange={e => setAuthForm({ ...authForm, password: e.target.value })} />
          </InputGroup>

          {view === 'register' && (
            <div className="form-group">
              <label>Role</label>
              <select
                style={{ width: '100%', padding: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', borderRadius: '8px' }}
                onChange={e => setAuthForm({ ...authForm, role: e.target.value })}
                value={authForm.role}
              >
                <option value="student">Student</option>
                <option value="faculty">Faculty</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          )}

          {view === 'login' ? (
            <button className="primary-btn" onClick={handleLogin}>Login</button>
          ) : (
            <button className="primary-btn" onClick={handleRegister}>Register</button>
          )}

          <p onClick={() => setView(view === 'login' ? 'register' : 'login')} style={{ marginTop: '1rem', cursor: 'pointer', color: '#888' }}>
            {view === 'login' ? "Need an account? Register" : "Have an account? Login"}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="app-container">
      <nav>
        <div className="logo"><FiShield /> TrustCert</div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <span><FiUser style={{ marginRight: '8px' }} /> {user?.username}</span>
          <button className="secondary-btn icon-btn" onClick={logout} title="Logout"><FiLogOut /></button>
        </div>
      </nav>

      {renderMessage()}

      {view === 'dashboard' && (
        <div style={{ width: '100%' }}>
          {user?.role === 'admin' && <DashboardAdmin token={token} user={user} />}
          {user?.role === 'faculty' && <DashboardFaculty token={token} user={user} />}
          {user?.role === 'student' && <DashboardStudent token={token} />}
        </div>
      )}

      {view === 'verify' && <DashboardVerifier />}

      {view === 'create' && (
        <div className="card">
          <h2>New Time Vault</h2>

          <div className="form-group">
            <label>Select File to Encrypt</label>
            <InputGroup icon={FiFile}>
              <input type="file" onChange={e => setFormData({ ...formData, file: e.target.files[0] })} />
            </InputGroup>
          </div>

          <div className="form-group">
            <label>Unlock Date (Local Time)</label>
            <InputGroup icon={FiCalendar}>
              <DatePicker
                selected={formData.unlockTime}
                onChange={(date) => setFormData({ ...formData, unlockTime: date })}
                showTimeSelect
                dateFormat="Pp"
                minDate={new Date()}
                placeholderText="Select Unlock Time"
                className="date-picker-input"
              />
            </InputGroup>
          </div>

          <div className="form-group">
            <label>Beneficiary Address</label>
            <InputGroup icon={FiHash}>
              <input type="text" placeholder="Algorand Address..." onChange={(e) => setFormData({ ...formData, beneficiary: e.target.value })} />
            </InputGroup>
          </div>

          <button className="primary-btn" onClick={createVault} disabled={loading}>
            {loading ? "Encrypting & Minting..." : "Seal Vault in Smart Contract"}
          </button>
          <button className="secondary-btn" onClick={() => { setMessage(null); setView('dashboard'); }}>Cancel</button>
        </div>
      )}
    </div>
  )
}

export default App
