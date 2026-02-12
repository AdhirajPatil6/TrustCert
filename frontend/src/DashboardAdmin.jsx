import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FiFile, FiUser, FiCpu, FiTrash2, FiClock, FiCheckSquare, FiList } from 'react-icons/fi';
import CryptoJS from 'crypto-js';

const API_BASE = "http://127.0.0.1:8000";

const DashboardAdmin = ({ token, user }) => {
    // State for Tabs
    const [activeTab, setActiveTab] = useState('create'); // 'create' or 'manage'

    // Create Form State
    const [formData, setFormData] = useState({
        title: '',
        studentUsername: '',
        conditions: '', // For AI
        manualDate: '',
        requireApproval: false,
        file: null
    });
    const [useAI, setUseAI] = useState(false); // Default to Manual now as per request
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);

    // Manage State
    const [allCerts, setAllCerts] = useState([]);
    const [facultyList, setFacultyList] = useState([]); // List of faculty

    const getHeaders = () => ({ headers: { Authorization: `Bearer ${token}` } });

    // Fetch initial data
    useEffect(() => {
        if (activeTab === 'manage') fetchAllCerts();
        if (activeTab === 'create') fetchFaculty();
    }, [activeTab]);

    const fetchFaculty = async () => {
        try {
            const res = await axios.get(`${API_BASE}/users/role/faculty`, getHeaders());
            setFacultyList(res.data);
        } catch (err) {
            console.error("Failed to fetch faculty", err);
        }
    };

    const fetchAllCerts = async () => {
        try {
            const res = await axios.get(`${API_BASE}/certificates/all`, getHeaders());
            setAllCerts(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const handleDelete = async (certId) => {
        if (!window.confirm("Are you sure you want to delete this certificate?")) return;
        try {
            await axios.delete(`${API_BASE}/certificates/${certId}`, getHeaders());
            setMessage({ type: 'success', text: "Certificate Deleted" });
            fetchAllCerts();
        } catch (err) {
            setMessage({ type: 'error', text: "Failed to delete" });
        }
    };

    const handleCreateCert = async () => {
        if (!formData.file || !formData.title || !formData.studentUsername) {
            setMessage({ type: 'error', text: "Title, Student, and File are required" });
            return;
        }

        if (useAI && !formData.conditions) {
            setMessage({ type: 'error', text: "Please enter conditions for AI parsing." });
            return;
        }

        if (!useAI && !formData.manualDate && !formData.requireApproval) {
            setMessage({ type: 'error', text: "Please select at least one condition (Date or Approval)." });
            return;
        }

        setLoading(true);
        setMessage({ type: 'info', text: "Encrypting & Analyzing Conditions..." });

        try {
            // 1. Encrypt File
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

                // 3. Create Certificate with Explicit Conditions
                const payload = {
                    title: formData.title,
                    student_username: formData.studentUsername,
                    conditions_text: useAI ? formData.conditions : null,
                    manual_date: !useAI ? formData.manualDate : null,
                    require_approval: !useAI ? formData.requireApproval : false,
                    targeted_faculty_username: (!useAI && formData.requireApproval) ? formData.targetedFaculty : null,
                    encrypted_ipfs_hash: ipfsHash,
                    decryption_key: key
                };

                await axios.post(`${API_BASE}/certificates/create`, payload, getHeaders());

                setMessage({ type: 'success', text: "Certificate Created & Rules Set!" });
                setLoading(false);
                setFormData({
                    title: '',
                    studentUsername: '',
                    conditions: '',
                    manualDate: '',
                    requireApproval: false,
                    file: null
                });
            };
            reader.readAsDataURL(formData.file);

        } catch (err) {
            console.error(err);
            setMessage({ type: 'error', text: "Failed to create certificate: " + (err.response?.data?.detail || err.message) });
            setLoading(false);
        }
    };

    return (
        <div className="dashboard-container">
            <h2><FiCpu /> Admin & Faculty Console</h2>

            <div className="tabs">
                <button
                    className={activeTab === 'create' ? 'active' : ''}
                    onClick={() => setActiveTab('create')}
                >
                    <FiFile /> Issue Certificate
                </button>
                <button
                    className={activeTab === 'manage' ? 'active' : ''}
                    onClick={() => setActiveTab('manage')}
                >
                    <FiList /> Manage Issued
                </button>
            </div>

            {message && <div className={`message ${message.type}`}>{message.text}</div>}

            {activeTab === 'create' && (
                <div className="card form-card">
                    <h3>Issue New Certificate</h3>

                    <div className="form-group">
                        <label>Certificate Title</label>
                        <input
                            value={formData.title}
                            onChange={e => setFormData({ ...formData, title: e.target.value })}
                            placeholder="e.g. Internship Completion 2026"
                        />
                    </div>

                    <div className="form-group">
                        <label>Student Username</label>
                        <div className="input-group">
                            <FiUser className="input-icon" />
                            <input
                                value={formData.studentUsername}
                                onChange={e => setFormData({ ...formData, studentUsername: e.target.value })}
                                placeholder="Student's registered username"
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Certificate File (PDF/Image)</label>
                        <div className="input-group">
                            <FiFile className="input-icon" />
                            <input
                                type="file"
                                onChange={e => setFormData({ ...formData, file: e.target.files[0] })}
                            />
                        </div>
                    </div>

                    <div className="form-toggle">
                        <label className="switch">
                            <input type="checkbox" checked={useAI} onChange={() => setUseAI(!useAI)} />
                            <span className="slider round"></span>
                        </label>
                        <span style={{ marginLeft: '10px' }}>{useAI ? "Using AI Parser (Advanced)" : "Manual Conditions (Standard)"}</span>
                    </div>

                    {useAI ? (
                        <div className="form-group ai-input">
                            <label>Release Conditions (AI Powered)</label>
                            <textarea
                                value={formData.conditions}
                                onChange={e => setFormData({ ...formData, conditions: e.target.value })}
                                placeholder="Describe when this should be released. &#10;Ex: 'Release after 2026-06-15' or 'Release after 15 June 2026'"
                                rows={4}
                            />
                            <small><FiCpu /> Our AI will convert this into Smart Contract logic automatically.</small>
                        </div>
                    ) : (
                        <div className="manual-conditions">
                            <label>Lock Conditions (AND Logic)</label>
                            <div className="condition-row">
                                <div className="checkbox-group">
                                    <input
                                        type="checkbox"
                                        id="chkTime"
                                        checked={!!formData.manualDate}
                                        onChange={(e) => {
                                            if (!e.target.checked) setFormData({ ...formData, manualDate: '' });
                                        }}
                                    />
                                    <label htmlFor="chkTime">Time Lock</label>
                                </div>
                                <div className="input-group" style={{ opacity: formData.manualDate || document.getElementById('chkTime')?.checked ? 1 : 0.5 }}>
                                    <FiClock className="input-icon" />
                                    <input
                                        type="datetime-local"
                                        value={formData.manualDate}
                                        onChange={e => setFormData({ ...formData, manualDate: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="condition-row">
                                <div className="checkbox-group">
                                    <input
                                        type="checkbox"
                                        id="chkApproval"
                                        checked={formData.requireApproval}
                                        onChange={e => setFormData({ ...formData, requireApproval: e.target.checked })}
                                    />
                                    <label htmlFor="chkApproval">Require Faculty Approval</label>
                                </div>

                                {formData.requireApproval && (
                                    <div style={{ marginLeft: '25px', marginTop: '10px' }}>
                                        <label style={{ fontSize: '0.8rem' }}>Select Approver (Optional):</label>
                                        <select
                                            className="key-box"
                                            style={{ color: '#fff', background: 'rgba(0,0,0,0.3)', border: '1px solid #444' }}
                                            onChange={e => setFormData({ ...formData, targetedFaculty: e.target.value })}
                                        >
                                            <option value="">Any Faculty</option>
                                            {facultyList.map(f => (
                                                <option key={f.id} value={f.username}>{f.username}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                <small style={{ marginLeft: '25px', display: 'block', color: '#aaa' }}>
                                    If checked, a faculty member must verify this before release.
                                </small>
                            </div>
                        </div>
                    )}

                    <button className="primary-btn" onClick={handleCreateCert} disabled={loading}>
                        {loading ? "Processing..." : "Issue Certificate"}
                    </button>
                </div>
            )}

            {activeTab === 'manage' && (
                <div className="card">
                    <h3>All Issued Certificates</h3>
                    <div className="table-container">
                        <table className="glass-table">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Title</th>
                                    <th>Student</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {allCerts.map(cert => (
                                    <tr key={cert.id}>
                                        <td>{cert.id}</td>
                                        <td>{cert.title}</td>
                                        <td>{cert.student_username}</td>
                                        <td>{cert.status}</td>
                                        <td>
                                            <button className="icon-btn delete-btn" onClick={() => handleDelete(cert.id)} title="Delete">
                                                <FiTrash2 />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {allCerts.length === 0 && <p className="empty-text">No certificates found.</p>}
                    </div>
                </div>
            )}
        </div>
    );
};

export default DashboardAdmin;
