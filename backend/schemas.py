from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime

# --- Token ---
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

# --- User ---
class UserBase(BaseModel):
    username: str
    email: str

class UserCreate(UserBase):
    password: str
    role: str = "student" # Default to student

# Forward declaration for type hinting
class VaultInfo(BaseModel):
    id: int
    app_id: int
    ipfs_hash: str
    status: str
    owner_id: int
    unlock_time: datetime
    filename: Optional[str] = None

    class Config:
        from_attributes = True

class User(UserBase):
    id: int
    role: str
    vaults: List[VaultInfo] = []
    
    class Config:
        from_attributes = True

# --- API Payloads ---
class KeySubmission(BaseModel):
    app_id: int
    encrypted_key: str
    unlock_time: datetime
    ipfs_hash: str
    beneficiary: str 
    filename: str 

# --- TrustCert Schemas ---
class ConditionBase(BaseModel):
    condition_type: str
    target_value: str
    description: Optional[str] = None
    
    class Config:
        from_attributes = True

class CertificateBase(BaseModel):
    title: str
    encrypted_ipfs_hash: str
    decryption_key: str
    student_username: str # Input as username, resolve to ID in backend
    conditions_text: Optional[str] = None # Natural language input from admin
    manual_date: Optional[str] = None # YYYY-MM-DD format for manual entry
    require_approval: bool = False # Explicit checkbox for faculty approval
    targeted_faculty_username: Optional[str] = None # Specific faculty to approve

class CertificateCreate(CertificateBase):
    pass

class CertificateResponse(BaseModel):
    id: int
    title: str
    status: str
    student_id: int
    student_username: Optional[str] = None # Resolved in main.py
    created_at: Optional[datetime] = None
    encrypted_ipfs_hash: str
    decryption_key: str
    conditions: List[ConditionBase] = []
    
    class Config:
        from_attributes = True 

class RecordCreate(BaseModel):
    student_username: str
    category: str # "Attendance", "Grade"
    value: str

class RecordResponse(BaseModel):
    id: int
    category: str
    value: str
    timestamp: datetime
    issuer_id: int
    data_hash: str
    previous_hash: str
    
    class Config:
        from_attributes = True

class PolicyCreate(BaseModel):
    name: str
    description: str
    activation_date: datetime

class PolicyResponse(BaseModel):
    id: int
    name: str
    is_active: bool
    is_frozen: bool
    
    class Config:
        from_attributes = True
