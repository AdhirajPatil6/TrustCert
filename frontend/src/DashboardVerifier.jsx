import React, { useState } from 'react';
import axios from 'axios';
import { FiSearch, FiCheckCircle, FiXCircle, FiShield, FiUser, FiCalendar, FiClock } from 'react-icons/fi';

const API_BASE = "http://127.0.0.1:8000";

const DashboardVerifier = () => {
    const [certId, setCertId] = useState('');
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleVerify = async () => {
        if (!certId) return;
        setLoading(true);
        setError(null);
        setResult(null);

        try {
            // 1. Fetch Public Info
            const res = await axios.get(`${API_BASE}/certificates/public/${certId}`);
            const certData = res.data;

            // 2. Check Conditions (Publicly)
            // Note: In a real app, this might be bundled, but for now we reuse the verify logic or just display status
            // The user asked for "authenticity", so showing the current status and condition state is key.
            // We'll call verify-conditions to get the latest status if it's dynamic
            try {
                const statusRes = await axios.post(`${API_BASE}/certificates/${certId}/verify-conditions`);
                certData.cert_status = statusRes.data.cert_status;
            } catch (ignore) {
                // If verify fails (e.g. auth required), fallback to stored status
            }

            setResult(certData);
        } catch (err) {
            console.error(err);
            setError("Certificate not found or invalid ID.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="dashboard-container center-content">
            <div className="verifier-box">
                <h2><FiShield /> Public Verification Portal</h2>
                <p>Verify the authenticity of TrustCert credentials.</p>

                <div className="search-box">
                    <input
                        placeholder="Enter Certificate ID"
                        value={certId}
                        onChange={e => setCertId(e.target.value)}
                    />
                    <button className="primary-btn" onClick={handleVerify} disabled={loading}>
                        {loading ? <FiShield className="spin" /> : <FiSearch />} Verify
                    </button>
                </div>

                {error && <div className="result-card error"><FiXCircle /> {error}</div>}

                {result && (
                    <div className={`result-card ${result.cert_status === 'UNLOCKED' ? 'valid' : 'pending'}`}>
                        {result.cert_status === 'UNLOCKED' ? (
                            <>
                                <h3><FiCheckCircle /> Valid Certificate</h3>
                                <p>This credential is <strong>UNLOCKED</strong> and authentic.</p>
                            </>
                        ) : (
                            <>
                                <h3><FiXCircle /> Conditional / Locked</h3>
                                <p>This certificate is not yet fully released.</p>
                            </>
                        )}

                        <div className="result-details">
                            <div className="detail-row">
                                <span className="label">Title:</span>
                                <span className="value">{result.title}</span>
                            </div>
                            <div className="detail-row">
                                <span className="label"><FiUser /> Issued To:</span>
                                <span className="value highlight">{result.student_username}</span>
                            </div>
                            <div className="detail-row">
                                <span className="label">Status:</span>
                                <span className={`status-badge ${result.cert_status?.toLowerCase()}`}>{result.cert_status}</span>
                            </div>
                            <div className="detail-row">
                                <span className="label"><FiCalendar /> Created:</span>
                                <span className="value">{new Date(result.created_at).toLocaleDateString()}</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DashboardVerifier;
