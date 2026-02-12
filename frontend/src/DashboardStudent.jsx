import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FiLock, FiUnlock, FiDownload, FiClock, FiCheckCircle, FiXCircle } from 'react-icons/fi';
import CryptoJS from 'crypto-js';

const API_BASE = "http://127.0.0.1:8000";

const DashboardStudent = ({ token }) => {
    const [certs, setCerts] = useState([]);
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);

    const getHeaders = () => ({ headers: { Authorization: `Bearer ${token}` } });

    useEffect(() => {
        fetchCerts();
    }, []);

    const fetchCerts = async () => {
        try {
            const res = await axios.get(`${API_BASE}/my-certificates`, getHeaders());
            setCerts(res.data);

            // Fetch Records too
            // decode token or user prop to get username
            // For MVP assuming username is passed or we get it from certs/user endpoint
            // Let's assume passed prop 'user'
            if (token) {
                const userRes = await axios.get(`${API_BASE}/users/me`, getHeaders());
                const recRes = await axios.get(`${API_BASE}/records/${userRes.data.username}`, getHeaders());
                setRecords(recRes.data);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleDownload = async (cert) => {
        try {
            setMessage({ type: 'info', text: "Decrypting Certificate..." });

            // 1. Fetch Encrypted Content
            const res = await axios.get(`${API_BASE}/ipfs/${cert.encrypted_ipfs_hash}`, { responseType: 'text' });
            const encryptedContent = res.data;

            // 2. Decrypt
            const decryptedBytes = CryptoJS.AES.decrypt(encryptedContent, cert.decryption_key);
            const decryptedDataUrl = decryptedBytes.toString(CryptoJS.enc.Utf8);

            if (!decryptedDataUrl.startsWith("data:")) {
                throw new Error("Decryption failed");
            }

            // 3. Download
            const link = document.createElement("a");
            link.href = decryptedDataUrl;
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
            <h2>My Verified Credentials</h2>
            {message && <div className={`message ${message.type}`}>{message.text}</div>}

            <div className="cert-grid">
                {certs.map(cert => (
                    <div className="card cert-card" key={cert.id} data-status={cert.status}>
                        <div className="card-header">
                            <div>
                                <h3>{cert.title}</h3>
                                <small style={{ display: 'block', color: '#aaa', marginTop: '4px' }}>
                                    <span style={{ opacity: 0.7 }}>Issued to:</span> {cert.student_username}
                                </small>
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

            <h2 style={{ marginTop: '40px' }}><FiClock /> Academic History (Immutable Ledger)</h2>
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
        </div>
    );
};

export default DashboardStudent;
