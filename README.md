# TrustCert
AI-Powered Campus Record Integrity & Automated Certification System

Built on Algorand Blockchain (TestNet)

---

## 📌 Overview

TrustCert is a blockchain-backed campus trust layer that ensures:

- Transparent attendance and marks versioning
- Tamper-proof academic record anchoring
- Automated certificate release based on conditions
- Public verification of issued certificates
- Immutable policy governance

The system does not replace institutional authority.  
It makes authority transparent, auditable, and cryptographically verifiable.

---

## 🚨 Problem

Campus systems today rely on centralized administrative control, which leads to:

- Manual verification processes
- Risk of silent data modification
- Fake certificate circulation
- Lack of transparency in eligibility rules
- Delayed and discretionary certificate release

Students and employers must trust institutions without verifiable proof of record integrity.

---

## 💡 Solution

TrustCert introduces:

### 1️⃣ Versioned Academic Records
- Every attendance or marks update creates a new version.
- No overwriting allowed.
- Each version is hashed (SHA-256).
- Hash anchored on Algorand TestNet.
- Full audit history preserved.

### 2️⃣ Automated Conditional Certificate Release
Certificates are released only if:
- Time condition is satisfied
- Attendance threshold is met
- Admin/Mentor approval is granted

Policies:
- Are immutable after activation
- Have an activation delay (transparency window)
- Cannot be silently modified

### 3️⃣ Public Certificate Verification
- Certificate hash stored on-chain
- QR or file upload verification
- Any modification invalidates authenticity
- Revocation supported

### 4️⃣ AI-Based Policy Interpretation
Admins define conditions in natural language.
AI converts conditions into structured smart contract logic.

---

## 🏗 Architecture

### Frontend
- Admin Dashboard
- Student Dashboard
- Public Verification Page

### Backend
- Attendance & marks versioning
- SHA-256 hash generator
- Policy parsing engine
- Blockchain transaction handler

### Blockchain (Algorand TestNet)
- Smart contract for policy storage
- On-chain version hash anchoring
- Certificate registry
- Approval logic
- Time-based release enforcement

Database stores raw data.
Blockchain stores cryptographic proof.

---

## 🔐 Governance & Integrity Model

TrustCert ensures:
- No silent edits to attendance or marks
- No modification of policies after activation
- Publicly auditable record history
- Immutable version snapshots
- Transparent certificate issuance

It prevents hidden manipulation while maintaining institutional control.

---

## 🧪 Demo Flow

1. Admin updates attendance → new version created → hash stored on-chain
2. Admin creates certification policy (natural language input)
3. Policy deployed with activation delay
4. Mentor approval simulated
5. Time condition reached
6. Certificate auto-released
7. Public verification confirms authenticity
8. Attempted post-freeze modification → release blocked

---

## 🛠 Tech Stack

Frontend:
- React / HTML / CSS

Backend:
- Python (Flask/FastAPI)
- SHA-256 hashing

Blockchain:
- Algorand Smart Contracts (TEAL / PyTeal)
- Deployed on Algorand TestNet

Development:
- AlgoKit
- Algorand LocalNet (LoRA) for testing
- TestNet faucet for funding

---

## ✅ Features Implemented

- [x] Time-based certificate release
- [x] Admin approval logic
- [x] Versioned attendance records
- [x] On-chain hash anchoring
- [x] Certificate hash registry
- [x] Public verification mechanism
- [x] Policy activation delay
- [x] Immutable policy storage

---

## 🚧 Features Remaining / Future Work

- Multi-admin approval threshold
- Full marks versioning integration
- UI improvements
- ERP/LMS integration
- Decentralized identity integration
- Cross-institution verification network

---

## 📂 Important Files to Review

Judges may look at:

- `/contracts/approval.teal` → Smart contract logic
- `/contracts/clear.teal` → State reset logic
- `/backend/verify_flow.py` → Certificate verification flow
- `/backend/init_db.py` → Versioned record initialization
- `/backend/debug_time.py` → Time-based logic testing
- `/frontend/` → UI implementation

---

## 🚀 How to Run

1. Start LocalNet (optional for development):
   algokit localnet start

2. Install backend dependencies
3. Configure TestNet API endpoint
4. Fund TestNet wallet via AlgoKit faucet
5. Deploy smart contract
6. Run frontend locally

---

## 🎯 Impact

TrustCert transforms campus governance from trust-based to proof-based systems.

It improves:
- Transparency
- Data integrity
- Certificate authenticity
- Fair automation
- Administrative efficiency

---

## 📜 License

Hackathon Project – Educational Use
