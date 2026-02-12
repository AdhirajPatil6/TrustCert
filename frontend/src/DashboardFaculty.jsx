import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FiCheckSquare, FiUser, FiFileText } from 'react-icons/fi';

const API_BASE = "http://127.0.0.1:8000";

const DashboardFaculty = ({ token, user }) => {
    const [pending, setPending] = useState([]);
    const [recordForm, setRecordForm] = useState({ student_username: '', category: 'Grade', value: '' });
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);

    const getHeaders = () => ({ headers: { Authorization: `Bearer ${token}` } });

    useEffect(() => {
        fetchPending();
    }, []);

    const fetchPending = async () => {
        try {
            const res = await axios.get(`${API_BASE}/pending-approvals`, getHeaders());
            setPending(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const handleApprove = async (certId) => {
        try {
            setLoading(true);
            // hardcoded condition type 'approval' for this demo
            await axios.post(`${API_BASE}/certificates/${certId}/approve-condition/approval`, {}, getHeaders());

            setMessage({ type: 'success', text: "Approved Successfully!" });
            fetchPending(); // Refresh list
        } catch (err) {
            console.error(err);
            setMessage({ type: 'error', text: "Approval Failed." });
        } finally {
            setLoading(false);
        }
    };

    const handleAddRecord = async () => {
        try {
            setLoading(true);
            await axios.post(`${API_BASE}/records/add`, recordForm, getHeaders());
            setMessage({ type: 'success', text: "Record added to Ledger!" });
            setRecordForm({ student_username: '', category: 'Grade', value: '' });
        } catch (err) {
            console.error(err);
            setMessage({ type: 'error', text: "Failed to add record." });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="dashboard-container">
            <h2><FiCheckSquare /> Faculty Dashboard</h2>
            <p className="subtitle">Manage approvals and academic records.</p>

            {message && <div className={`message ${message.type}`}>{message.text}</div>}

            <div className="card">
                <h3>Add Academic Record (Immutable)</h3>
                <div className="form-group">
                    <input
                        placeholder="Student Username"
                        value={recordForm.student_username}
                        onChange={e => setRecordForm({ ...recordForm, student_username: e.target.value })}
                    />
                    <select
                        value={recordForm.category}
                        onChange={e => setRecordForm({ ...recordForm, category: e.target.value })}
                        style={{ marginTop: '10px', width: '100%', padding: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}
                    >
                        <option value="Grade">Grade</option>
                        <option value="Attendance">Attendance</option>
                        <option value="Behavior">Behavior</option>
                    </select>
                    <input
                        placeholder="Value (e.g., A, 85%, Suspended)"
                        value={recordForm.value}
                        onChange={e => setRecordForm({ ...recordForm, value: e.target.value })}
                        style={{ marginTop: '10px' }}
                    />
                    <button className="primary-btn" onClick={handleAddRecord} disabled={loading} style={{ marginTop: '10px' }}>
                        {loading ? "Hashing..." : "Submit to Ledger"}
                    </button>
                </div>
            </div>

            <h3 style={{ marginTop: '30px' }}>Approval Queue</h3>

            {pending.length === 0 ? (
                <div className="empty-state">
                    <p>No pending approvals found.</p>
                </div>
            ) : (
                <div className="approval-list">
                    {pending.map(cert => (
                        <div className="card approval-card" key={cert.id}>
                            <div className="approval-info">
                                <h3>{cert.title}</h3>
                                <p><FiUser /> Student ID: {cert.student_id}</p>
                                <p><FiFileText /> Pending Approval signature for release.</p>
                            </div>
                            <div className="approval-actions">
                                <button
                                    className="primary-btn"
                                    onClick={() => handleApprove(cert.id)}
                                    disabled={loading}
                                >
                                    {loading ? "Signing..." : "Approve & Sign"}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default DashboardFaculty;
