import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    FaUserGraduate, FaClipboardCheck, FaHistory, FaPlus, FaCheck, FaTimes, FaList
} from 'react-icons/fa';

const API_base = "http://127.0.0.1:8000";

const DashboardFaculty = ({ token, user, activeTab, setActiveTab }) => {
    // Stats State
    const [stats, setStats] = useState({
        recordsWritten: 0,
        pendingApprovals: 0
    });

    // Data State
    const [myRecords, setMyRecords] = useState([]);
    const [pendingCerts, setPendingCerts] = useState([]);

    // Form State for "Write Record"
    const [recordForm, setRecordForm] = useState({
        student_username: '',
        category: 'Attendance', // Default
        value: ''
    });

    // --- Fetchers ---
    const fetchStats = async () => {
        // In a real app, this would be a dedicated endpoint
        // For MVP, we derive from the other fetches
    };

    const fetchMyRecords = async () => {
        try {
            const res = await axios.get(`${API_base}/records/my-history`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setMyRecords(res.data);
            setStats(prev => ({ ...prev, recordsWritten: res.data.length }));
        } catch (err) {
            console.error("Error fetching records", err);
        }
    };

    const fetchPendingApprovals = async () => {
        try {
            const res = await axios.get(`${API_base}/certificates/pending-approval`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setPendingCerts(res.data);
            setStats(prev => ({ ...prev, pendingApprovals: res.data.length }));
        } catch (err) {
            console.error("Error fetching approvals", err);
        }
    };

    // --- Effects ---
    useEffect(() => {
        fetchMyRecords();
        fetchPendingApprovals();
    }, [activeTab]); // Refresh when tab changes

    // --- Handlers ---
    const handleWriteRecord = async () => {
        try {
            await axios.post(`${API_base}/records/add`, recordForm, {
                headers: { Authorization: `Bearer ${token}` }
            });
            alert("Record added successfully!");
            setRecordForm({ student_username: '', category: 'Attendance', value: '' });
            fetchMyRecords();
            setActiveTab('ledger');
        } catch (err) {
            alert("Failed to add record: " + (err.response?.data?.detail || err.message));
        }
    };

    const handleApprove = async (certId) => {
        try {
            await axios.post(`${API_base}/certificates/${certId}/approve-condition/approval`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            alert("Certificate Approved!");
            fetchPendingApprovals();
        } catch (err) {
            alert("Failed to approve");
        }
    };

    return (
        <div className="dashboard-container">
            <div className="admin-hero">
                <div className="hero-text">
                    <h1>Faculty Console</h1>
                    <p>Academic Record Management & Verifications</p>
                </div>
            </div>

            {activeTab === 'dashboard' && <Overview stats={stats} />}
            {activeTab === 'write' && <WriteRecordSection recordForm={recordForm} setRecordForm={setRecordForm} handleWriteRecord={handleWriteRecord} />}
            {activeTab === 'approvals' && <ApprovalsList pendingCerts={pendingCerts} handleApprove={handleApprove} />}
            {activeTab === 'ledger' && <LedgerHistory myRecords={myRecords} />}
        </div>
    );
};

// --- Sub-Components ---

const Overview = ({ stats }) => (
    <div className="overview-grid">
        <div className="stat-card">
            <div className="stat-title"><span className="stat-dot dot-blue"></span> Records Written</div>
            <div className="stat-value">{stats.recordsWritten}</div>
            <small className="text-dim">Immutable entries</small>
        </div>
        <div className="stat-card">
            <div className="stat-title"><span className="stat-dot dot-yellow"></span> Pending Approvals</div>
            <div className="stat-value">{stats.pendingApprovals}</div>
            <small className="text-dim">Action required</small>
        </div>
    </div>
);

const WriteRecordSection = ({ recordForm, setRecordForm, handleWriteRecord }) => (
    <div className="create-section">
        <div className="card">
            <h3><FaPlus style={{ marginRight: '10px' }} /> Write Immutable Record</h3>
            <p className="text-dim" style={{ marginBottom: '1.5rem' }}>
                Add a grade or attendance record to the student's permanent ledger.
            </p>

            <div className="form-group">
                <label>Student Username</label>
                <input
                    type="text"
                    placeholder="e.g. adhiraj"
                    value={recordForm.student_username}
                    onChange={e => setRecordForm({ ...recordForm, student_username: e.target.value })}
                />
            </div>

            <div className="form-group">
                <label>Category</label>
                <select
                    value={recordForm.category}
                    onChange={e => setRecordForm({ ...recordForm, category: e.target.value })}
                    style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white' }}
                >
                    <option value="Attendance">Attendance</option>
                    <option value="Grade">Grade</option>
                    <option value="Behavior">Behavior</option>
                </select>
            </div>

            <div className="form-group">
                <label>Value</label>
                <input
                    type="text"
                    placeholder="e.g. 85, A, Passed"
                    value={recordForm.value}
                    onChange={e => setRecordForm({ ...recordForm, value: e.target.value })}
                />
            </div>

            <button className="primary-btn" style={{ borderRadius: '50px', marginTop: '1rem' }} onClick={handleWriteRecord}>
                Commit to Ledger
            </button>
        </div>
    </div>
);

const ApprovalsList = ({ pendingCerts, handleApprove }) => (
    <div>
        <h3 style={{ marginBottom: '1.5rem' }}>Pending Certifications</h3>
        {pendingCerts.length === 0 ? (
            <div className="text-dim" style={{ textAlign: 'center', padding: '3rem' }}>No pending approvals.</div>
        ) : (
            <div className="cert-grid">
                {pendingCerts.map(cert => (
                    <div key={cert.id} className="stat-card">
                        <div className="card-header">
                            <div>{cert.title}</div>
                            <div className="status-indicator">PENDING</div>
                        </div>
                        <div style={{ margin: '1rem 0' }}>
                            <div className="text-dim">Student: <span style={{ color: 'white' }}>{cert.student_username}</span></div>
                        </div>
                        <button className="primary-btn" style={{ width: '100%', borderRadius: '50px' }} onClick={() => handleApprove(cert.id)}>
                            <FaCheck style={{ marginRight: '5px' }} /> Approve
                        </button>
                    </div>
                ))}
            </div>
        )}
    </div>
);

const LedgerHistory = ({ myRecords }) => (
    <div>
        <h3 style={{ marginBottom: '1.5rem' }}>My Ledger Entries</h3>
        <div className="card" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'left' }}>
                        <th style={{ padding: '1rem' }}>Date</th>
                        <th style={{ padding: '1rem' }}>Category</th>
                        <th style={{ padding: '1rem' }}>Student</th>
                        <th style={{ padding: '1rem' }}>Value</th>
                        <th style={{ padding: '1rem' }}>Hash</th>
                    </tr>
                </thead>
                <tbody>
                    {myRecords.map(rec => (
                        <tr key={rec.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <td style={{ padding: '1rem' }}>{new Date(rec.timestamp).toLocaleDateString()}</td>
                            <td style={{ padding: '1rem' }}>{rec.category}</td>
                            <td style={{ padding: '1rem' }}>{rec.student_username}</td>
                            <td style={{ padding: '1rem', fontWeight: 'bold', color: '#60a5fa' }}>{rec.value}</td>
                            <td style={{ padding: '1rem', fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                                {rec.data_hash.substring(0, 10)}...
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    </div>
);

export default DashboardFaculty;
