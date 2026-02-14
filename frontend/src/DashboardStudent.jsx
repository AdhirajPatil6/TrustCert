import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FiLock, FiUnlock, FiDownload, FiClock, FiCheckCircle, FiXCircle, FiCopy, FiHome, FiAward, FiList, FiShield, FiUser } from 'react-icons/fi';
import CryptoJS from 'crypto-js';

const API_BASE = "http://127.0.0.1:8000";

// --- Sub-Components ---

const StudentDashboardOverview = ({ certs, records }) => {
    return (
        <div className="overview-section">
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: 'rgba(57, 255, 20, 0.1)', color: '#39ff14' }}>
                        <FiAward />
                    </div>
                    <div>
                        <h3>{certs.length}</h3>
                        <p>Total Certificates</p>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: 'rgba(255, 107, 107, 0.1)', color: '#ff6b6b' }}>
                        <FiLock />
                    </div>
                    <div>
                        <h3>{certs.filter(c => c.status === 'LOCKED').length}</h3>
                        <p>Pending Unlock</p>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: 'rgba(77, 184, 255, 0.1)', color: '#4db8ff' }}>
                        <FiList />
                    </div>
                    <div>
                        <h3>{records.length}</h3>
                        <p>Academic Records</p>
                    </div>
                </div>
            </div>

            <h3 style={{ marginTop: '2rem' }}>Latest Activity</h3>
            <div className="activity-feed">
                {records.slice(0, 3).map(rec => (
                    <div key={rec.id} className="activity-item" style={{ padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <FiClock style={{ color: '#aaa' }} />
                        <div>
                            <strong>New Record Added: {rec.category}</strong>
                            <p className="text-dim" style={{ fontSize: '0.85rem', margin: 0 }}>
                                Value: {rec.value} • {new Date(rec.timestamp).toLocaleDateString()}
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const MyCertificates = ({ certs, copyToClipboard, handleDownload, handleCheckEligibility }) => (
    <div className="cert-grid">
        {certs.map(cert => (
            <div className="card cert-card" key={cert.id} data-status={cert.status}>
                <div className="card-header">
                    <div>
                        <h3>{cert.title}</h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                            <span className="badge-id" onClick={() => copyToClipboard(cert.id)} title="Click to Copy ID">
                                ID: {cert.id} <FiCopy />
                            </span>
                            <small style={{ color: '#aaa' }}>
                                Issued to: {cert.student_username}
                            </small>
                        </div>
                    </div>
                    <span className={`status-badge ${cert.status.toLowerCase()}`}>
                        {cert.status === 'UNLOCKED' ? <FiUnlock /> : <FiLock />} {cert.status}
                    </span>
                </div>

                <div className="card-body">
                    <h4>Release Conditions:</h4>
                    <ul>
                        {cert.conditions.map((cond, i) => (
                            <li key={i} className={cond.is_met ? 'met' : 'unmet'}>
                                {cond.is_met ? <FiCheckCircle className="icon-success" /> : <FiClock />}
                                {cond.description || `${cond.condition_type} > ${cond.target_value}`}
                            </li>
                        ))}
                    </ul>
                </div>

                {cert.status === 'UNLOCKED' ? (
                    <button className="primary-btn" onClick={() => handleDownload(cert)}>
                        <FiDownload /> Download Certificate
                    </button>
                ) : (
                    <button className="secondary-btn" onClick={() => handleCheckEligibility(cert.id)}>
                        <FiCheckCircle /> Check Eligibility
                    </button>
                )}
            </div>
        ))}
    </div>
);

const MyRecords = ({ records }) => (
    <div className="records-table-container">
        <table className="glass-table">
            <thead>
                <tr>
                    <th>Time</th>
                    <th>Category</th>
                    <th>Value</th>
                    <th>Data Hash (Active)</th>
                    <th>Prev Hash</th>
                </tr>
            </thead>
            <tbody>
                {records.map(rec => (
                    <tr key={rec.id}>
                        <td>{new Date(rec.timestamp).toLocaleDateString()}</td>
                        <td>{rec.category}</td>
                        <td><strong>{rec.value}</strong></td>
                        <td><code className="hash">{rec.data_hash.substring(0, 10)}...</code></td>
                        <td><code className="hash">{rec.previous_hash.substring(0, 10)}...</code></td>
                    </tr>
                ))}
            </tbody>
        </table>
        {records.length === 0 && <p className="empty-text">No records found on the ledger.</p>}
    </div>
);

const VerificationTool = ({ }) => {
    const [certId, setCertId] = useState("");
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleVerify = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await axios.get(`${API_BASE}/certificates/public/${certId}`);
            setResult(res.data);
        } catch (err) {
            setError("Certificate not found or invalid ID.");
            setResult(null);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="verification-section" style={{ maxWidth: '600px', margin: '0 auto' }}>
            <div className="card">
                <h3><FiShield style={{ marginRight: '10px' }} /> Public Verification Tool</h3>
                <p className="text-dim">Verify the authenticity of any TrustCert credential by entering its unique ID.</p>

                <div className="form-group" style={{ marginTop: '1.5rem' }}>
                    <label>Certificate ID</label>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <input
                            type="text"
                            placeholder="Enter ID..."
                            value={certId}
                            onChange={(e) => setCertId(e.target.value)}
                            autoComplete="off"
                            style={{
                                flex: 1,
                                padding: '12px 16px', // Explicit reset of all padding
                                color: '#ffffff',
                                backgroundColor: '#1a1a1f', // Solid dark background matching app theme
                                border: '1px solid rgba(255, 255, 255, 0.2)',
                                borderRadius: '8px',
                                fontSize: '1rem',
                                outline: 'none',
                                caretColor: 'white'
                            }}
                        />
                        <button className="primary-btn" onClick={handleVerify} disabled={!certId || loading}>
                            {loading ? "Verifying..." : "Verify"}
                        </button>
                    </div>
                </div>

                {error && <div className="message error">{error}</div>}

                {result && (
                    <div className="verification-result" style={{ marginTop: '2rem', padding: '1rem', background: 'rgba(57, 255, 20, 0.05)', border: '1px solid rgba(57, 255, 20, 0.2)', borderRadius: '8px' }}>
                        <h4 style={{ color: '#39ff14', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <FiCheckCircle /> Valid Certificate Found
                        </h4>
                        <div style={{ marginTop: '1rem' }}>
                            <p><strong>Title:</strong> {result.title}</p>
                            <p><strong>Student:</strong> {result.student_username}</p>
                            <p><strong>Status:</strong> {result.status}</p>
                            <p><strong>Issuer ID:</strong> {result.issuer_id}</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const UserProfile = ({ user }) => (
    <div className="profile-section" style={{ maxWidth: '500px', margin: '0 auto' }}>
        <div className="card" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
            <div className="profile-avatar" style={{ width: '80px', height: '80px', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', borderRadius: '50%', margin: '0 auto 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', color: 'white' }}>
                {user?.username?.[0]?.toUpperCase()}
            </div>
            <h2>{user?.username}</h2>
            <p className="badge" style={{ display: 'inline-block', marginTop: '0.5rem' }}>{user?.role}</p>

            <div style={{ textAlign: 'left', marginTop: '2rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '2rem' }}>
                <div className="form-group">
                    <label>User ID</label>
                    <input type="text" value={user?.id} readOnly disabled style={{ opacity: 0.7 }} />
                </div>
                <div className="form-group">
                    <label>Email</label>
                    <input type="text" value={user?.email} readOnly disabled style={{ opacity: 0.7 }} />
                </div>
            </div>
        </div>
    </div>
);


const DashboardStudent = ({ token, activeTab, setActiveTab }) => {
    const [certs, setCerts] = useState([]);
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);
    const [user, setUser] = useState(null);

    const getHeaders = () => ({ headers: { Authorization: `Bearer ${token}` } });

    useEffect(() => {
        fetchCerts();
    }, []);

    const fetchCerts = async () => {
        try {
            const res = await axios.get(`${API_BASE}/my-certificates`, getHeaders());
            setCerts(res.data);

            if (token) {
                const userRes = await axios.get(`${API_BASE}/users/me`, getHeaders());
                setUser(userRes.data);
                const recRes = await axios.get(`${API_BASE}/records/${userRes.data.username}`, getHeaders());
                setRecords(recRes.data);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        setMessage({ type: 'success', text: "ID Copied to clipboard!" });
        setTimeout(() => setMessage(null), 2000);
    };

    const handleDownload = async (cert) => {
        try {
            setMessage({ type: 'info', text: "Decrypting Certificate..." });

            // 1. Fetch Encrypted Content
            const res = await axios.get(`${API_BASE}/ipfs/${cert.encrypted_ipfs_hash}`, { responseType: 'text' });
            const encryptedContent = res.data;

            // 2. Decrypt (Try/Catch wrapper or check key)
            let finalContent = encryptedContent;

            try {
                // If the key looks like our mock key or decryption fails, we use raw
                if (cert.decryption_key === "mock_key_plain_text") {
                    throw new Error("Using plain text");
                }
                const decryptedBytes = CryptoJS.AES.decrypt(encryptedContent, cert.decryption_key);
                const decryptedStr = decryptedBytes.toString(CryptoJS.enc.Utf8);
                if (decryptedStr) finalContent = decryptedStr;
            } catch (e) {
                console.warn("Decryption skipped or failed, using raw content", e);
            }

            // Convert to Data URL if needed (for text it's easier to just Blob)
            const blob = new Blob([finalContent], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);

            // 3. Download
            const link = document.createElement("a");
            link.href = url;
            link.download = `${cert.title.replace(/\s+/g, '_')}_verified.pdf`; // Assume PDF for demo
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            setMessage({ type: 'success', text: "Download Started!" });
        } catch (err) {
            console.error("Download Error:", err);
            // Fallback: If decryption fails, maybe suggest manual check or log specific error
            alert("Download/Decryption Failed. Please check console for details. Key might be invalid.");
            setMessage({ type: 'error', text: "Failed to download/decrypt file." });
        }
    };

    const handleCheckEligibility = async (certId) => {
        try {
            setMessage({ type: 'info', text: "Checking conditions..." });
            const res = await axios.post(`${API_BASE}/certificates/${certId}/verify-conditions`, {}, getHeaders());

            if (res.data.status === "success") {
                setMessage({ type: 'success', text: "Conditions updated!" });
                fetchCerts(); // Refresh to see if unlocked
            }
        } catch (err) {
            console.error(err);
            setMessage({ type: 'error', text: "Verification failed." });
        }
    };

    return (
        <div className="dashboard-container">
            {message && <div className={`message ${message.type}`}>{message.text}</div>}

            {/* Content Area */}
            {activeTab === 'dashboard' && <StudentDashboardOverview certs={certs} records={records} />}

            {activeTab === 'certificates' && (
                <MyCertificates
                    certs={certs}
                    copyToClipboard={copyToClipboard}
                    handleDownload={handleDownload}
                    handleCheckEligibility={handleCheckEligibility}
                />
            )}

            {activeTab === 'records' && <MyRecords records={records} />}

            {activeTab === 'verification' && <VerificationTool />}

            {activeTab === 'profile' && <UserProfile user={user} />}
        </div>
    );
};

export default DashboardStudent;
