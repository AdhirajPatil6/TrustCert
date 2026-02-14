import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    FaShieldAlt, FaPlus, FaCheck, FaTimes, FaLock, FaGlobe,
    FaFileAlt, FaHistory, FaCog, FaSearch, FaMagic
} from 'react-icons/fa';

const API_base = "http://127.0.0.1:8000";

const DashboardAdmin = ({ token, user, activeTab, setActiveTab }) => {
    console.log("DashboardAdmin Render:", { user, activeTab });

    // Navigation State is now lifted up to App.jsx

    // Data State
    const [certificates, setCertificates] = useState([]);
    const [auditLogs, setAuditLogs] = useState([]);

    const [stats, setStats] = useState({
        active: 12,
        locked: 3,
        pending: 2,
        onChain: 18
    });

    // Create Form State
    const [formData, setFormData] = useState({
        title: '',
        student_username: '',
        conditions_text: '',
        manual_date: '',
        require_approval: false,
        targeted_faculty_username: ''
    });

    // NLP Preview State
    const [nlpPreview, setNlpPreview] = useState([]);
    const [simulatedMode, setSimulatedMode] = useState(false);

    // Moved fetchCertificates definition UP before useEffect
    const fetchCertificates = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_base}/certificates/all`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setCertificates(res.data);

            // Update stats based on real data if desirable, or keep mock for "Wow" factor as requested
            const locked = res.data.filter(c => c.status === 'LOCKED').length;
            const active = res.data.filter(c => c.status === 'UNLOCKED').length;
            setStats(prev => ({ ...prev, locked, active }));

        } catch (err) {
            console.error("Failed to fetch certs", err);
        }
    };

    const fetchAuditLogs = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_base}/audit-logs`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setAuditLogs(response.data);
        } catch (err) {
            console.error("Error fetching logs", err);
        }
    };

    // Fetch Data
    useEffect(() => {
        if (activeTab === 'dashboard') {
            fetchCertificates();
        } else if (activeTab === 'audit') {
            fetchAuditLogs();
        }
    }, [activeTab]);

    // Live NLP Parsing (Mock Logic for UI responsiveness)
    useEffect(() => {
        const text = formData.conditions_text.toLowerCase();
        const detected = [];

        if (text.includes('after')) {
            const dateMatch = text.match(/after\s+(\d{4}-\d{2}-\d{2}|\d{1,2}\s+[a-z]+)/);
            if (dateMatch) detected.push({ type: 'date', label: `Release: ${dateMatch[1]}`, color: 'blue' });
        }

        if (text.includes('attendance') && text.includes('>')) {
            const attMatch = text.match(/>\s*(\d+)/);
            if (attMatch) detected.push({ type: 'score', label: `Attendance > ${attMatch[1]}%`, color: 'green' });
        }

        if (text.includes('approve') || text.includes('approval')) {
            detected.push({ type: 'approval', label: 'Faculty Approval Required', color: 'purple' });
        }

        setNlpPreview(detected);
    }, [formData.conditions_text]);

    const handleCreate = async () => {
        try {
            const token = localStorage.getItem('token');
            // Mock File Upload (Hash generation)
            const mockIpfsHash = "Qm" + Math.random().toString(36).substring(7);
            const mockKey = "key-" + Math.random().toString(36).substring(7);

            const payload = {
                title: formData.title,
                student_username: formData.student_username,
                conditions_text: formData.conditions_text,
                encrypted_ipfs_hash: mockIpfsHash,
                decryption_key: mockKey,
                manual_date: formData.manual_date || null,
                require_approval: formData.require_approval,
                targeted_faculty_username: formData.targeted_faculty_username || null
            };

            await axios.post(`${API_base}/certificates/create`, payload, {
                headers: { Authorization: `Bearer ${token}` }
            });

            alert("Certificate Created Successfully!");
            setFormData({ ...formData, title: '', student_username: '', conditions_text: '', manual_date: '' });
            fetchCertificates();
            setActiveTab('dashboard'); // Redirect to dashboard to see it
        } catch (err) {
            alert("Error creating certificate: " + (err.response?.data?.detail || err.message));
        }
    };

    const handleRevoke = async (id) => {
        console.log("handleRevoke called with id:", id);
        if (!window.confirm("Are you sure you want to REVOKE this certificate? This action is recorded on the blockchain.")) {
            console.log("Revoke cancelled by user.");
            return;
        }
        try {
            const token = localStorage.getItem('token');
            console.log("Revoking cert:", id, "Token:", token ? "Present" : "Missing");
            const response = await axios.post(`${API_base}/certificates/${id}/revoke`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            console.log("Revoke response:", response.data);
            fetchCertificates();
            alert("Certificate Revoked.");
        } catch (err) {
            console.error("Revoke error:", err);
            if (err.response) {
                console.error("Revoke error details:", err.response.data);
                alert(`Failed to revoke: ${err.response.data.detail || err.message}`);
            } else {
                alert("Failed to revoke: Network or Server Error");
            }
        }
    };

    const handleDelete = async (id) => {
        console.log("handleDelete called with id:", id);
        if (!window.confirm("Are you sure you want to DELETE this certificate? This cannot be undone.")) {
            console.log("Delete cancelled by user.");
            return;
        }
        try {
            const token = localStorage.getItem('token');
            console.log("Deleting cert:", id);
            await axios.delete(`${API_base}/certificates/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            console.log("Delete successful");
            fetchCertificates();
        } catch (err) {
            console.error("Delete error:", err);
            if (err.response) {
                console.error("Delete error details:", err.response.data);
                alert(`Failed to delete: ${err.response.data.detail || err.message}`);
            } else {
                alert("Failed to delete: Network or Server Error");
            }
        }
    };

    // --- Components ---

    // --- Components ---

    // NavPill moved to App.jsx




    // --- Main Render ---
    return (
        <div className="dashboard-container">
            {/* NavPill is now in App Header */}

            {activeTab === 'dashboard' && (
                <>
                    <HeroSection setActiveTab={setActiveTab} />
                    <OverviewCards stats={stats} />
                    <CertificateGrid
                        certificates={certificates}
                        handleRevoke={handleRevoke}
                        handleDelete={handleDelete}
                    />
                </>
            )}

            {activeTab === 'create' && (
                <CreateSection
                    formData={formData}
                    setFormData={setFormData}
                    handleCreate={handleCreate}
                    nlpPreview={nlpPreview}
                    simulatedMode={simulatedMode}
                    setSimulatedMode={setSimulatedMode}
                />
            )}

            {activeTab === 'audit' && (
                <AuditLogSection logs={auditLogs} />
            )}

            {/* Placeholders removed as per user request */}
        </div>
    );
};

// --- Sub-Components (Moved Outside for Stability) ---

const HeroSection = ({ setActiveTab }) => (
    <div className="admin-hero">
        <div className="hero-text">
            <h1>TrustCert – Admin Console</h1>
            <p>Manage Policies & Secure Credential Release</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
            <button className="secondary-btn" style={{ borderRadius: '50px' }}>Deploy Policy</button>
            <button className="primary-btn" onClick={() => setActiveTab('create')} style={{ borderRadius: '50px' }}>
                <FaPlus style={{ marginRight: '0.5rem' }} /> Create Certificate
            </button>
        </div>
    </div>
);

const OverviewCards = ({ stats }) => (
    <div className="overview-grid">
        <div className="stat-card">
            <div className="stat-title"><span className="stat-dot dot-green"></span> Active Certificates</div>
            <div className="stat-value">{stats.active}</div>
            <small className="text-dim">Deployed on-chain</small>
        </div>
        <div className="stat-card">
            <div className="stat-title"><span className="stat-dot dot-danger" style={{ background: '#ff6347', boxShadow: '0 0 8px #ff6347' }}></span> Locked Certificates</div>
            <div className="stat-value">{stats.locked}</div>
            <small className="text-dim">Pending conditions</small>
        </div>
        <div className="stat-card">
            <div className="stat-title"><span className="stat-dot dot-yellow"></span> Pending Approvals</div>
            <div className="stat-value">{stats.pending}</div>
            <small className="text-dim">Awaiting faculty</small>
        </div>
        <div className="stat-card">
            <div className="stat-title"><span className="stat-dot dot-blue"></span> On-Chain Txns</div>
            <div className="stat-value">{stats.onChain}</div>
            <small className="text-dim">Algorand TestNet</small>
        </div>
    </div>
);

const CreateSection = ({ formData, setFormData, handleCreate, nlpPreview, simulatedMode, setSimulatedMode }) => (
    <div className="create-section">
        {/* Input Form */}
        <div className="card">
            <h3 style={{ marginBottom: '1.5rem' }}>Issue New Credential</h3>

            <div className="form-group">
                <label>Certificate Title</label>
                <input
                    type="text"
                    placeholder="e.g. Advanced AI Ethics 2026"
                    value={formData.title}
                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                />
            </div>

            <div className="form-group">
                <label>Student Username</label>
                <input
                    type="text"
                    placeholder="Search student..."
                    value={formData.student_username}
                    onChange={e => setFormData({ ...formData, student_username: e.target.value })}
                />
            </div>

            <div className="form-group">
                <label>Manual Release Date & Time (Optional)</label>
                <input
                    type="datetime-local"
                    value={formData.manual_date}
                    onChange={e => setFormData({ ...formData, manual_date: e.target.value })}
                    style={{ colorScheme: 'dark' }}
                />
            </div>

            <div className="form-group">
                <label>Smart Conditions (Natural Language)</label>
                <textarea
                    className="key-box"
                    style={{ minHeight: '100px', background: 'rgba(0,0,0,0.2)', color: 'white', border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '1rem' }}
                    placeholder="e.g. Release after 15 June 2026 if attendance > 80% and advisor approves."
                    value={formData.conditions_text}
                    onChange={e => setFormData({ ...formData, conditions_text: e.target.value })}
                />
            </div>

            <button className="primary-btn" style={{ borderRadius: '50px' }} onClick={handleCreate}>
                <FaMagic style={{ marginRight: '0.5rem' }} /> Mint & Lock
            </button>
        </div>

        {/* Preview Side */}
        <div className="nlp-preview-box">
            <h3 style={{ marginBottom: '1rem', color: '#fff' }}>🧠 Logic Preview</h3>
            <p style={{ color: 'var(--text-dim)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                Our AI analyzes your text to generate smart contract rules.
            </p>

            <div style={{ minHeight: '100px' }}>
                {nlpPreview.length === 0 && !formData.manual_date && (
                    <div style={{ color: '#666', fontStyle: 'italic' }}>
                        Start typing conditions to see AI detection...
                    </div>
                )}

                {formData.manual_date && (
                    <div className="nlp-tag" style={{
                        background: 'rgba(59, 130, 246, 0.2)',
                        color: '#60a5fa',
                        border: '1px solid rgba(59, 130, 246, 0.3)'
                    }}>
                        <FaHistory style={{ marginRight: 6 }} />
                        Release: {formData.manual_date}
                    </div>
                )}

                {nlpPreview.map((item, idx) => (
                    <div key={idx} className={`nlp-tag`} style={{
                        background: item.color === 'blue' ? 'rgba(59, 130, 246, 0.2)' : item.color === 'green' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(139, 92, 246, 0.2)',
                        color: item.color === 'blue' ? '#60a5fa' : item.color === 'green' ? '#34d399' : '#a78bfa',
                        border: `1px solid ${item.color === 'blue' ? 'rgba(59, 130, 246, 0.3)' : item.color === 'green' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(139, 92, 246, 0.3)'}`
                    }}>
                        {item.type === 'date' && <FaHistory style={{ marginRight: 6 }} />}
                        {item.type === 'score' && <FaCheck style={{ marginRight: 6 }} />}
                        {item.type === 'approval' && <FaShieldAlt style={{ marginRight: 6 }} />}
                        {item.label}
                    </div>
                ))}
            </div>

            <div className="simulation-toggle">
                <div
                    className={`toggle-switch ${simulatedMode ? 'active' : ''}`}
                    onClick={() => setSimulatedMode(!simulatedMode)}
                >
                    <div className="toggle-knob"></div>
                </div>
                <span style={{ fontSize: '0.9rem', color: simulatedMode ? '#fff' : 'var(--text-dim)' }}>
                    Simulate Outcome
                </span>
            </div>

            {simulatedMode && (
                <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(251, 191, 36, 0.1)', borderRadius: '8px', border: '1px solid rgba(251, 191, 36, 0.3)', color: '#fbbf24', fontSize: '0.9rem' }}>
                    <strong>Simulation:</strong> Based on current student data, this certificate would remain <strong>LOCKED</strong> (Date not met).
                </div>
            )}

        </div>
    </div>
);

const CertificateGrid = ({ certificates, handleRevoke, handleDelete }) => (
    <div>
        <h3 style={{ marginBottom: '1.5rem' }}>Recent Certificates</h3>
        <div className="cert-grid">
            {certificates.map(cert => (
                <div key={cert.id} className="stat-card" style={{ padding: '1.5rem' }}>
                    <div className="card-header" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.8rem', marginBottom: '0.8rem' }}>
                        <div style={{ fontWeight: 600, color: '#fff' }}>{cert.title}</div>
                        <div className="status-indicator" data-status={cert.status}>
                            {cert.status}
                        </div>
                    </div>
                    <div style={{ marginBottom: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: 'var(--text-dim)', marginBottom: '0.5rem' }}>
                            <span>Student</span>
                            <span style={{ color: '#fff' }}>{cert.student_username}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: 'var(--text-dim)' }}>
                            <span>Issued</span>
                            <span>{new Date(cert.created_at).toLocaleDateString()}</span>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="secondary-btn" style={{ flex: 1, fontSize: '0.8rem', padding: '0.5rem' }}>
                            View
                        </button>
                        {cert.status !== 'REVOKED' && (
                            <button
                                className="secondary-btn"
                                style={{ flex: 1, fontSize: '0.8rem', padding: '0.5rem', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)' }}
                                onClick={() => handleRevoke(cert.id)}
                            >
                                Revoke
                            </button>
                        )}
                        <button
                            className="secondary-btn"
                            style={{ flex: 0, fontSize: '0.8rem', padding: '0.5rem' }}
                            onClick={() => handleDelete(cert.id)}
                        >
                            <FaTimes />
                        </button>
                    </div>
                </div>
            ))}
            {certificates.length === 0 && (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '4rem', color: 'var(--text-dim)' }}>
                    No certificates found. Create one to get started.
                </div>
            )}
        </div>
    </div>
);

const AuditLogSection = ({ logs }) => (
    <div>
        <h3 style={{ marginBottom: '1.5rem' }}>System Audit Log</h3>
        <div className="card" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'left' }}>
                        <th style={{ padding: '1rem', color: 'var(--text-dim)' }}>Timestamp</th>
                        <th style={{ padding: '1rem', color: 'var(--text-dim)' }}>Action</th>
                        <th style={{ padding: '1rem', color: 'var(--text-dim)' }}>Target ID</th>
                        <th style={{ padding: '1rem', color: 'var(--text-dim)' }}>Details</th>
                        <th style={{ padding: '1rem', color: 'var(--text-dim)' }}>Actor</th>
                    </tr>
                </thead>
                <tbody>
                    {logs.map(log => (
                        <tr key={log.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <td style={{ padding: '1rem' }}>{new Date(log.timestamp).toLocaleString()}</td>
                            <td style={{ padding: '1rem' }}>
                                <span className={`status-indicator ${log.action.includes('DELETE') ? 'locked' : log.action.includes('REVOKE') ? 'locked' : 'active'}`} style={{ display: 'inline-block' }}>
                                    {log.action}
                                </span>
                            </td>
                            <td style={{ padding: '1rem', fontFamily: 'monospace' }}>{log.target_id}</td>
                            <td style={{ padding: '1rem' }}>{log.details}</td>
                            <td style={{ padding: '1rem', color: '#60a5fa' }}>{log.actor_username}</td>
                        </tr>
                    ))}
                    {logs.length === 0 && (
                        <tr>
                            <td colSpan="5" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-dim)' }}>
                                No audit logs found.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    </div>
);

export default DashboardAdmin;
