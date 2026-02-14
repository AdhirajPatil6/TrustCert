from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, DateTime, Enum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from .database import Base

class UserRole(str, enum.Enum):
    ADMIN = "admin"
    FACULTY = "faculty"
    STUDENT = "student"
    VERIFIER = "verifier"

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    role = Column(String, default=UserRole.STUDENT) # TrustCert Role

    vaults = relationship("Vault", back_populates="owner")
    certificates = relationship("Certificate", back_populates="student")
    records = relationship("RecordVersion", back_populates="student")

class Vault(Base):
    __tablename__ = "vaults"

    id = Column(Integer, primary_key=True, index=True)
    app_id = Column(Integer, unique=True, index=True) # Algorand App ID
    owner_id = Column(Integer, ForeignKey("users.id"))
    
    ipfs_hash = Column(String)
    filename = Column(String)
    beneficiary = Column(String)
    encrypted_key = Column(String)
    unlock_time = Column(DateTime)
    
    # Optional status field (LOCKED, UNLOCKED, OPENED)
    status = Column(String, default="LOCKED")

    owner = relationship("User", back_populates="vaults")

class Certificate(Base):
    __tablename__ = "certificates"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String)
    student_id = Column(Integer, ForeignKey("users.id"))
    issuer_id = Column(Integer) # ID of admin/faculty who created it
    encrypted_ipfs_hash = Column(String)
    decryption_key = Column(String) 
    status = Column(String, default="LOCKED") # LOCKED, PENDING_APPROVAL, UNLOCKED
    created_at = Column(DateTime, default=datetime.utcnow)
    
    student = relationship("User", back_populates="certificates")
    conditions = relationship("Condition", back_populates="certificate")

class Condition(Base):
    __tablename__ = "conditions"
    
    id = Column(Integer, primary_key=True, index=True)
    certificate_id = Column(Integer, ForeignKey("certificates.id"))
    condition_type = Column(String) # time, attendance, approval, grade
    target_value = Column(String) 
    current_value = Column(String) # e.g. "85%"
    is_met = Column(Boolean, default=False)
    description = Column(String)
    
    # New: For targeted approvals
    target_recipient_id = Column(Integer, ForeignKey("users.id"), nullable=True) 
    
    certificate = relationship("Certificate", back_populates="conditions")

class RecordVersion(Base):
    """
    Immutable record for Attendance/Grades.
    Forms a hash chain for tamper-evidence.
    """
    __tablename__ = "record_versions"
    
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"))
    category = Column(String) # "Attendance", "Grade", "Behavior"
    value = Column(String) # "85", "A", "Suspended"
    timestamp = Column(DateTime, default=datetime.utcnow)
    issuer_id = Column(Integer) # Admin/Faculty who added it
    previous_hash = Column(String) # Hash of the previous record for this student/category
    data_hash = Column(String) # Hash of (this.data + previous_hash)
    
    student = relationship("User", back_populates="records")

class GovernancePolicy(Base):
    __tablename__ = "governance_policies"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    description = Column(String)
    is_active = Column(Boolean, default=False)
    activation_date = Column(DateTime)
    is_frozen = Column(Boolean, default=False) # Cannot edit if frozen

class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    action = Column(String) # "CREATE_CERT", "REVOKE_CERT", "DELETE_CERT", "LOGIN"
    target_id = Column(String) # ID of the object affected (e.g. Cert ID)
    details = Column(String) # JSON or text description
    actor_username = Column(String) # Who performed it
    timestamp = Column(DateTime, default=datetime.utcnow)
