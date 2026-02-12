from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import secrets
import os
import hashlib

# Internal modules
from . import models, schemas, database, auth, ai_logic
from algosdk.v2client import algod

# --- Configuration ---
ALGOD_ADDRESS = "http://localhost:4001"
ALGOD_TOKEN = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"

app = FastAPI(title="ChronoVault Backend (Auth + DB)")

# --- CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174"], # Adding likely frontend ports
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Startup ---
@app.on_event("startup")
def startup():
    # Create Tables if not exist
    models.Base.metadata.create_all(bind=database.engine)

# --- Algod Client ---
try:
    algod_client = algod.AlgodClient(ALGOD_TOKEN, ALGOD_ADDRESS)
except Exception:
    algod_client = None

# --- Dependency ---
def get_db():
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- Auth Endpoints ---

@app.post("/register", response_model=schemas.Token)
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    # Check existing
    db_user = db.query(models.User).filter(models.User.username == user.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    hashed_pw = auth.get_password_hash(user.password)
    new_user = models.User(username=user.username, email=user.email, hashed_password=hashed_pw, role=user.role)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # Auto-login
    access_token = auth.create_access_token(data={"sub": new_user.username})
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/token", response_model=schemas.Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == form_data.username).first()
    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/users/me", response_model=schemas.User)
async def read_users_me(current_user: models.User = Depends(auth.get_current_user)):
    return current_user

@app.get("/users/role/{role}", response_model=List[schemas.User])
def get_users_by_role(role: str, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    # Simple validation
    if role.upper() not in models.UserRole.__members__:
         raise HTTPException(status_code=400, detail="Invalid role")
    return db.query(models.User).filter(models.User.role == role.upper()).all()

# --- Core App Endpoints ---

from fastapi.responses import FileResponse

@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    # Mock IPFS - Save locally for now to allow retrieval
    content = await file.read()
    mock_hash = "Qm" + secrets.token_hex(22)
    
    os.makedirs("backend/uploads", exist_ok=True)
    with open(f"backend/uploads/{mock_hash}", "wb") as f:
        f.write(content)
        
    return {"filename": file.filename, "ipfs_hash": mock_hash}

@app.get("/ipfs/{ipfs_hash}")
def retrieve_file(ipfs_hash: str):
    file_path = f"backend/uploads/{ipfs_hash}"
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(file_path)

@app.post("/store-key")
def store_decryption_key(
    submission: schemas.KeySubmission, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Store key in DB, linked to User.
    """
    # Check if App ID exists
    existing = db.query(models.Vault).filter(models.Vault.app_id == submission.app_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Vault ID already registered")

    new_vault = models.Vault(
        app_id=submission.app_id,
        owner_id=current_user.id,
        ipfs_hash=submission.ipfs_hash,
        filename=submission.filename,
        beneficiary=submission.beneficiary,
        encrypted_key=submission.encrypted_key,
        unlock_time=submission.unlock_time,
        status="LOCKED"
    )
    db.add(new_vault)
    db.commit()
    
    return {"status": "success", "message": "Key escrowed in Database"}

@app.get("/release-key/{app_id}")
def release_decryption_key(app_id: int, db: Session = Depends(get_db)):
    """
    Release logic:
    1. Find Vault in DB.
    2. Check On-Chain State.
    3. If Unlocked -> release key.
    """
    vault = db.query(models.Vault).filter(models.Vault.app_id == app_id).first()
    if not vault:
        raise HTTPException(status_code=404, detail="Vault not found")

    # 1. Check On-Chain (Mock fallback if node down)
    is_unlocked = False
    try:
        if algod_client:
            app_info = algod_client.application_info(app_id)
            global_state = app_info['params']['global-state']
            # Parse logic...
            # Assume success if variable IsUnlocked == 1
            for kv in global_state:
                if kv['key'] == 'SXNVbmxvY2tlZA==' and kv['value']['uint'] == 1:
                     is_unlocked = True
                     break
        else:
            # Fallback for MVP without node: Check time vs DB stored time
            if datetime.utcnow() > vault.unlock_time:
                 is_unlocked = True
            pass

    except Exception:
        # If check fails, default to strict time check against DB for MVP resilience
        if datetime.utcnow() > vault.unlock_time:
             is_unlocked = True

    if not is_unlocked:
        raise HTTPException(status_code=403, detail="Vault is LOCKED")

    # Update status if needed
    if vault.status != "UNLOCKED":
        vault.status = "UNLOCKED"
        db.commit()

    return {"status": "unlocked", "key": vault.encrypted_key}

@app.get("/my-vaults")
def get_my_vaults(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    return db.query(models.Vault).filter(models.Vault.owner_id == current_user.id).order_by(models.Vault.id.desc()).all()

@app.delete("/delete-vault/{app_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_vault(
    app_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    vault = db.query(models.Vault).filter(models.Vault.app_id == app_id).first()
    if not vault:
        raise HTTPException(status_code=404, detail="Vault not found")
    
    if vault.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this vault")
    
    db.delete(vault)
    db.commit()
    db.delete(vault)
    db.commit()
    return None

# --- TrustCert Endpoints ---

@app.post("/certificates/create", response_model=schemas.CertificateResponse)
def create_certificate(
    cert: schemas.CertificateCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    # Only Admin/Faculty can create certs
    if current_user.role not in [models.UserRole.ADMIN, models.UserRole.FACULTY]:
         # For MVP allow everyone to demo, but ideally verify role
         pass

    # 1. Resolve Student
    student = db.query(models.User).filter(models.User.username == cert.student_username).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student user not found")

    # 2. Parse Conditions (AI or Manual)
    parsed_conditions = []
    
    # AI Parsing
    if cert.conditions_text:
        ai_result = ai_logic.AI_Condition_Parser.parse_condition(cert.conditions_text)
        parsed_conditions.extend(ai_result["parsed_conditions"])
    
    # Manual Date Parsing
    if cert.manual_date:
        parsed_conditions.append({
            "type": "time",
            "operator": ">",
            "value": cert.manual_date,
            "description": f"Release after {cert.manual_date} (Manual Entry)"
        })

    # Manual Approval Flag
    if cert.require_approval:
        approval_cond = {
            "type": "approval",
            "role": "faculty",
            "count": 1,
            "description": "Requires Faculty Approval",
            "target_recipient_id": None
        }
        
        # Check for specific faculty
        if cert.targeted_faculty_username:
             target_fac = db.query(models.User).filter(models.User.username == cert.targeted_faculty_username).first()
             if target_fac:
                 approval_cond["target_recipient_id"] = target_fac.id
                 approval_cond["description"] = f"Requires Approval from {target_fac.username}"
        
        parsed_conditions.append(approval_cond)
        
    if not parsed_conditions:
        # Fallback if neither provided
        # For MVP, if nothing is provided, create an "Immediate Release" condition?
        # Or just raise error. Let's raise error to be safe.
        raise HTTPException(status_code=400, detail="Must provide at least one condition (AI, Date, or Approval)")

    # 3. Create Certificate
    new_cert = models.Certificate(
        title=cert.title,
        student_id=student.id,
        issuer_id=current_user.id,
        encrypted_ipfs_hash=cert.encrypted_ipfs_hash,
        decryption_key=cert.decryption_key,
        status="LOCKED"
    )
    db.add(new_cert)
    db.commit()
    db.refresh(new_cert)
    
    # 4. Create Conditions
    for cond_data in parsed_conditions:
        new_cond = models.Condition(
            certificate_id=new_cert.id,
            condition_type=cond_data["type"],
            target_value=str(cond_data.get("value", "")),
            description=cond_data.get("description", ""),
            current_value="0",
            is_met=False,
            target_recipient_id=cond_data.get("target_recipient_id") # Save restricted recipient
        )
        db.add(new_cond)
    
    db.commit()
    db.refresh(new_cert)
    return new_cert

@app.get("/my-certificates", response_model=List[schemas.CertificateResponse])
def get_my_certificates(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    # Sort by Created At Descending (Latest first)
    certs = db.query(models.Certificate).filter(models.Certificate.student_id == current_user.id).order_by(models.Certificate.created_at.desc()).all()
    
    # Manually attach student username (though usually frontend knows it, good for completeness)
    for c in certs:
        c.student_username = current_user.username
        
    return certs

@app.get("/certificates/public/{cert_id}", response_model=schemas.CertificateResponse)
def verify_certificate_public(
    cert_id: int,
    db: Session = Depends(get_db)
):
    """
    Public endpoint for verifiers. No Auth required.
    """
    cert = db.query(models.Certificate).filter(models.Certificate.id == cert_id).first()
    if not cert:
        raise HTTPException(status_code=404, detail="Certificate not found")
    
    # Attach student username for display
    cert.student_username = cert.student.username
    return cert

@app.get("/pending-approvals", response_model=List[schemas.CertificateResponse])
def get_pending_approvals(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    # Retrieve all certificates with unmet 'approval' conditions
    # This is a bit complex in SQL, for MVP: get all certs, filter in python or basic join
    # optimized: join Conditions
    
    if current_user.role not in [models.UserRole.FACULTY, models.UserRole.ADMIN]:
         raise HTTPException(status_code=403, detail="Not authorized")

    query = db.query(models.Certificate).join(models.Condition).filter(
        models.Condition.condition_type == 'approval',
        models.Condition.is_met == False
    )
    
    # Filter by target recipient if set
    # Logic: Show if (target_recipient_id IS NULL) OR (target_recipient_id == current_user.id)
    # Since SQLAlchemy OR syntax is a bit verbose, we can do it in python for MVP or use or_
    from sqlalchemy import or_
    
    query = query.filter(
        or_(
            models.Condition.target_recipient_id == None,
            models.Condition.target_recipient_id == current_user.id
        )
    )

    return query.all()

@app.post("/certificates/{cert_id}/approve-condition/{condition_type}")
def approve_condition(
    cert_id: int,
    condition_type: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    # 1. Find Certificate & Condition
    cert = db.query(models.Certificate).filter(models.Certificate.id == cert_id).first()
    if not cert:
        raise HTTPException(status_code=404, detail="Certificate not found")
        
    # Find specific condition
    # Retrieve all conditions first to check
    conditions = db.query(models.Condition).filter(models.Condition.certificate_id == cert_id).all()
    target_cond = next((c for c in conditions if c.condition_type == condition_type), None)
    
    if not target_cond:
         raise HTTPException(status_code=404, detail="Condition type not found on this certificate")

    # 2. Verify Permission (Mock: If condition is 'approval', check if user is Faculty)
    if condition_type == "approval":
        if current_user.role != models.UserRole.FACULTY and current_user.role != models.UserRole.ADMIN:
             pass # Strict check disabled for MVP demo flow ease
        
        target_cond.is_met = True
        target_cond.current_value = f"Approved by {current_user.username}"
        db.commit()

    # 3. Check if ALL met
    all_met = all(c.is_met for c in conditions)
    if all_met:
        cert.status = "UNLOCKED"
        db.commit()
        
    return {"status": "success", "cert_status": cert.status}

@app.post("/certificates/{cert_id}/verify-conditions")
def verify_conditions(
    cert_id: int,
    db: Session = Depends(get_db)
    # Removing Auth dependency to allow public verification of conditions
):
    """
    Trigger re-evaluation of all conditions for a certificate.
    Useful for Time-based conditions or auto-updates.
    """
    cert = db.query(models.Certificate).filter(models.Certificate.id == cert_id).first()
    if not cert:
        raise HTTPException(status_code=404, detail="Certificate not found")
    
    conditions = db.query(models.Condition).filter(models.Condition.certificate_id == cert_id).all()
    
    for cond in conditions:
        if cond.is_met:
            continue
            
        # 1. Time Condition Check
        if cond.condition_type == "time":
            # Support both YYYY-MM-DD and ISO Format
            try:
                # Try ISO first (from datetime-local input)
                target_date = datetime.fromisoformat(cond.target_value)
            except ValueError:
                try:
                    # Fallback to simple date
                    target_date = datetime.strptime(cond.target_value, "%Y-%m-%d")
                except ValueError:
                    continue # Invalid format
            
            if datetime.now() >= target_date:
                cond.is_met = True
                cond.current_value = datetime.now().isoformat()
        
        
        # 2. Grade/Attendance Logic using Versioned Records
        if cond.condition_type in ["attendance", "grade"]:
             # Fetch all records for this category
             # Note: category strings must match what is stored in records
             # For this demo, we assume "Attendance" and "Grade" are the categories
             category_map = {"attendance": "Attendance", "grade": "Grade"}
             target_cat = category_map.get(cond.condition_type, cond.condition_type.capitalize())
             
             records = db.query(models.RecordVersion).filter(
                 models.RecordVersion.student_id == cert.student_id,
                 models.RecordVersion.category == target_cat
             ).all()
             
             if not records:
                 continue
                 
             # Simple Logic: Check if ANY record meets the criteria (or average)
             # For MVP: Check if effective value >= target
             # We take the LATEST record as the "Current Status"
             latest_record = sorted(records, key=lambda x: x.id, reverse=True)[0]
             
             try:
                 current_val = float(latest_record.value)
                 target_val = float(cond.target_value)
                 
                 # Operator check (Assuming '>' since most conditions are "min requirement")
                 if current_val >= target_val:
                     cond.is_met = True
                     cond.current_value = str(current_val)
             except ValueError:
                 # String comparison (e.g. Grade 'A')
                 if latest_record.value == cond.target_value:
                     cond.is_met = True
                     cond.current_value = latest_record.value
    
    db.commit()

    # Check if ALL conditions are now met
    all_met = all(c.is_met for c in conditions)
    if all_met and cert.status != "UNLOCKED":
        cert.status = "UNLOCKED"
        db.commit()
    
    return {
        "status": "success", 
        "cert_status": cert.status, 
        "conditions": [{"type": c.condition_type, "met": c.is_met} for c in conditions]
    }

@app.delete("/certificates/{cert_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_certificate(
    cert_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.role != models.UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only Admin can delete certificates")
        
    cert = db.query(models.Certificate).filter(models.Certificate.id == cert_id).first()
    if not cert:
        raise HTTPException(status_code=404, detail="Certificate not found")
        
    # Delete associated conditions first (cascade usually handles this but being explicit)
    db.query(models.Condition).filter(models.Condition.certificate_id == cert_id).delete()
    db.delete(cert)
    db.commit()
    return None

@app.get("/certificates/all", response_model=List[schemas.CertificateResponse])
def get_all_certificates(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.role != models.UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only Admin can view all certificates")
    
    certs = db.query(models.Certificate).order_by(models.Certificate.id.desc()).all()
    # Populate Username
    for c in certs:
        c.student_username = c.student.username
    return certs

# --- Record & Governance Endpoints ---

@app.post("/records/add", response_model=schemas.RecordResponse)
def add_record(
    record: schemas.RecordCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    # Only Faculty/Admin can add records
    if current_user.role not in [models.UserRole.ADMIN, models.UserRole.FACULTY]:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    student = db.query(models.User).filter(models.User.username == record.student_username).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    # 1. Fetch Previous Record for chaining
    last_record = db.query(models.RecordVersion).filter(
        models.RecordVersion.student_id == student.id,
        models.RecordVersion.category == record.category
    ).order_by(models.RecordVersion.id.desc()).first()
    
    prev_hash = last_record.data_hash if last_record else "GENESIS_HASH"
    
    # 2. Compute New Hash
    # Hash(Category + Value + Timestamp + PreviousHash)
    # Using simple concatenation for MVP
    timestamp = datetime.utcnow()
    raw_data = f"{record.category}{record.value}{timestamp.isoformat()}{prev_hash}"
    new_hash = hashlib.sha256(raw_data.encode()).hexdigest()
    
    # 3. Save
    new_record = models.RecordVersion(
        student_id=student.id,
        category=record.category,
        value=record.value,
        timestamp=timestamp,
        issuer_id=current_user.id,
        previous_hash=prev_hash,
        data_hash=new_hash
    )
    db.add(new_record)
    db.commit()
    db.refresh(new_record)
    return new_record

@app.get("/records/{student_username}", response_model=List[schemas.RecordResponse])
def get_student_records(
    student_username: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    student = db.query(models.User).filter(models.User.username == student_username).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
        
    return db.query(models.RecordVersion).filter(models.RecordVersion.student_id == student.id).order_by(models.RecordVersion.id.desc()).all()

@app.post("/governance/create", response_model=schemas.PolicyResponse)
def create_policy(
    policy: schemas.PolicyCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.role != models.UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only Admin")
        
    new_policy = models.GovernancePolicy(
        name=policy.name,
        description=policy.description,
        activation_date=policy.activation_date,
        is_active=True # Auto-active for MVP
    )
    db.add(new_policy)
    db.commit()
    db.refresh(new_policy)
    return new_policy

@app.post("/governance/{policy_id}/freeze")
def freeze_policy(
    policy_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.role != models.UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only Admin")
        
    policy = db.query(models.GovernancePolicy).filter(models.GovernancePolicy.id == policy_id).first()
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")
        
    if policy.is_frozen:
        raise HTTPException(status_code=400, detail="Policy already frozen")
        
    policy.is_frozen = True
    db.commit()
    return {"status": "success", "message": "Policy frozen and immutable."}
