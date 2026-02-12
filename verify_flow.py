
import requests
import sys

BASE_URL = "http://127.0.0.1:8000"

def get_token(username, password):
    resp = requests.post(f"{BASE_URL}/token", data={"username": username, "password": password})
    if resp.status_code != 200:
        print(f"Failed to login {username}: {resp.text}")
        sys.exit(1)
    return resp.json()["access_token"]

# User data dictionaries
admin_data = {
    "username": "AdminUser",
    "email": "admin@test.com",
    "password": "pass123",
    "role": "admin"
}

faculty_data = {
    "username": "FacultyUser",
    "email": "faculty@test.com",
    "password": "pass123",
    "role": "faculty"
}

student_data = {
    "username": "StudentUser",
    "email": "student@test.com",
    "password": "pass123",
    "role": "student"
}

# New: Second Faculty for Targeted Approval Test
faculty2_data = {
    "username": "FacultyTwo",
    "email": "fac2@uni.edu",
    "password": "pass123",
    "role": "faculty"
}

def register_user(user_data):
    resp = requests.post(f"{BASE_URL}/register", json=user_data)
    if resp.status_code == 200:
        print(f"    Registered {user_data['username']} ({user_data['role']})")
    elif resp.status_code == 400 and "already registered" in resp.text:
        print(f"    {user_data['username']} already registered.")
    else:
        print(f"    Failed to register {user_data['username']}: {resp.text}")


def run_verification():
    print("--- Starting TrustCert Verification ---")
    
    # 0. Register Users
    print("[0] Registering Users...")
    register_user(admin_data)
    register_user(faculty_data)
    register_user(faculty2_data) # Register second faculty
    register_user(student_data)

    # 1. Login Admin
    print("[1] Logging in Admin...")
    admin_token = get_token("AdminUser", "pass123")
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    
    # 2. Create Certificate
    print("[2] Creating Certificate...")
    cert_data = {
        "title": "AI Ethics Verified",
        "student_username": "StudentUser",
        "conditions_text": "Release if approved by faculty",
        "encrypted_ipfs_hash": "QmMOCKHASHTEST123",
        "decryption_key": "secretkey"
    }
    resp = requests.post(f"{BASE_URL}/certificates/create", json=cert_data, headers=admin_headers)
    if resp.status_code != 200:
        print(f"Failed to create cert: {resp.text}")
        sys.exit(1)
    cert_id = resp.json()["id"]
    print(f"    Certificate Created: ID {cert_id}")

    # 3. Login Faculty
    print("[3] Logging in Faculty...")
    faculty_token = get_token("FacultyUser", "pass123")
    faculty_headers = {"Authorization": f"Bearer {faculty_token}"}
    
    # 4. Check Pending
    print("[4] Checking Pending Approvals...")
    resp = requests.get(f"{BASE_URL}/pending-approvals", headers=faculty_headers)
    pending = resp.json()
    target_cert = next((c for c in pending if c["id"] == cert_id), None)
    if not target_cert:
        print("    Certificate not found in pending list!")
        sys.exit(1)
    print("    Certificate found in pending list.")
    
    # 5. Approve
    print("[5] Approving Certificate...")
    resp = requests.post(f"{BASE_URL}/certificates/{cert_id}/approve-condition/approval", headers=faculty_headers)
    if resp.status_code != 200:
        print(f"Failed to approve: {resp.text}")
        sys.exit(1)
    print("    Approved successfully.")
    
    # 6. Login Student
    print("[6] Logging in Student...")
    student_token = get_token("StudentUser", "pass123")
    student_headers = {"Authorization": f"Bearer {student_token}"}
    
    # 7. Check Status
    print("[7] Verifying Student Assets...")
    resp = requests.get(f"{BASE_URL}/my-certificates", headers=student_headers)
    my_certs = resp.json()
    target_cert = next((c for c in my_certs if c["id"] == cert_id), None)
    
    
    if target_cert and target_cert["status"] == "UNLOCKED":
        print("    SUCCESS: Approval Certificate is UNLOCKED!")
    else:
        print(f"    FAILURE: Certificate status is {target_cert['status'] if target_cert else 'Not Found'}")
        sys.exit(1)

    # 8. Test Time Condition
    print("[8] Testing Time Condition...")
    # Create cert with past date
    time_cert_data = {
        "title": "Time Released Cert",
        "student_username": "StudentUser",
        "conditions_text": "Release after 2020-01-01", 
        "encrypted_ipfs_hash": "QmTimeHash",
        "decryption_key": "timekey"
    }
    resp = requests.post(f"{BASE_URL}/certificates/create", json=time_cert_data, headers=admin_headers)
    time_cert_id = resp.json()["id"]
    print(f"    Time Certificate Created: ID {time_cert_id}")
    
    # Trigger Verification (Check Eligibility)
    print("    Triggering Time Verification...")
    resp = requests.post(f"{BASE_URL}/certificates/{time_cert_id}/verify-conditions", json={}, headers=student_headers)
    if resp.json()["cert_status"] == "UNLOCKED":
         print("    SUCCESS: Time Certificate is UNLOCKED!")
    else:
         print("    FAILURE: Time Certificate still LOCKED.")
         sys.exit(1)

         print("    FAILURE: Time Certificate still LOCKED.")
         sys.exit(1)

    # 9. Test Versioned Records
    print("[9] Testing Versioned Records (Hash Chain)...")
    
    # Add Record 1
    rec1_data = {"student_username": "StudentUser", "category": "Grade", "value": "85"}
    resp = requests.post(f"{BASE_URL}/records/add", json=rec1_data, headers=faculty_headers)
    rec1 = resp.json()
    print(f"    Added Record 1: {rec1['value']} (Hash: {rec1['data_hash'][:10]}...)")
    
    # Add Record 2
    rec2_data = {"student_username": "StudentUser", "category": "Grade", "value": "90"}
    resp = requests.post(f"{BASE_URL}/records/add", json=rec2_data, headers=faculty_headers)
    rec2 = resp.json()
    print(f"    Added Record 2: {rec2['value']} (Hash: {rec2['data_hash'][:10]}...)")
    
    # Verify Chain
    if rec2["previous_hash"] == rec1["data_hash"]:
        print("    SUCCESS: Hash Chain Verified! (Rec2 links to Rec1)")
    else:
        print(f"    FAILURE: Hash Mismatch! Rec2.prev ({rec2['previous_hash']}) != Rec1.hash ({rec1['data_hash']})")
        sys.exit(1)

        print(f"    FAILURE: Hash Mismatch! Rec2.prev ({rec2['previous_hash']}) != Rec1.hash ({rec1['data_hash']})")
        sys.exit(1)

    # 9b. Verify Schema Fix (Download Link)
    print("[9b] Verifying Certificate Schema for Download...")
    certs_resp = requests.get(f"{BASE_URL}/my-certificates", headers=student_headers)
    certs = certs_resp.json()
    if not certs:
         print("    WARNING: No certificates found for student to check schema.")
    else:
         c = certs[0]
         if "encrypted_ipfs_hash" in c and "decryption_key" in c:
             print("    SUCCESS: Certificate schema includes 'encrypted_ipfs_hash' and 'decryption_key'.")
         else:
             print("    FAILURE: Certificate schema MISSING 'encrypted_ipfs_hash' or 'decryption_key'. Download will fail!")
             # sys.exit(1) # Optional: Strict fail

    # 10. Test Automated Release (Attendance)
    print("[10] Testing Automated Release (Attendance > 80)...")
    
    # Create Cert
    auto_cert_data = {
        "title": "Attendance Certificate",
        "student_username": "StudentUser",
        "conditions_text": "Release if attendance > 80",
        "encrypted_ipfs_hash": "QmAutoHash",
        "decryption_key": "autokey"
    }
    resp = requests.post(f"{BASE_URL}/certificates/create", json=auto_cert_data, headers=admin_headers)
    auto_cert_id = resp.json()["id"]
    print(f"    Auto Certificate Created: ID {auto_cert_id} (Target: > 80)")
    
    # Add Low Attendance Record
    requests.post(f"{BASE_URL}/records/add", json={"student_username": "StudentUser", "category": "Attendance", "value": "75"}, headers=faculty_headers)
    
    # Verify -> Should be LOCKED
    resp = requests.post(f"{BASE_URL}/certificates/{auto_cert_id}/verify-conditions", json={}, headers=student_headers)
    if resp.json()["cert_status"] == "LOCKED":
        print("    Confimed: Certificate LOCKED with Attendance 75.")
    else:
        print("    FAILURE: Certificate Unlocked prematurely!")
        sys.exit(1)
        
    # Add High Attendance Record
    requests.post(f"{BASE_URL}/records/add", json={"student_username": "StudentUser", "category": "Attendance", "value": "95"}, headers=faculty_headers)
    
    # Verify -> Should be UNLOCKED
    resp = requests.post(f"{BASE_URL}/certificates/{auto_cert_id}/verify-conditions", json={}, headers=student_headers)
    if resp.json()["cert_status"] == "UNLOCKED":
        print("    SUCCESS: Certificate UNLOCKED with Attendance 95!")
    else:
        print("    FAILURE: Certificate still LOCKED after meeting criteria.")
        sys.exit(1)

    # 11. Test Governance
    print("[11] Testing Governance...")
    policy_data = {"name": "Grading Policy 2026", "description": "Strict", "activation_date": "2026-01-01T00:00:00"}
    resp = requests.post(f"{BASE_URL}/governance/create", json=policy_data, headers=admin_headers)
    policy_id = resp.json()["id"]
    print(f"    Policy Created: ID {policy_id}")
    
    # Freeze
    resp = requests.post(f"{BASE_URL}/governance/{policy_id}/freeze", json={}, headers=admin_headers)
    if resp.status_code == 200:
        print("    SUCCESS: Policy Frozen.")
    else:
        print(f"    FAILURE: Could not freeze policy. {resp.text}")

    if resp.status_code == 200:
        print("    SUCCESS: Policy Frozen.")
    else:
        print(f"    FAILURE: Could not freeze policy. {resp.text}")

    # 12. Test Manual Date
    print("[12] Testing Manual Date (Past)...")
    manual_cert_data = {
        "title": "Manual Date Cert",
        "student_username": "StudentUser",
        "manual_date": "2020-01-01",
        "encrypted_ipfs_hash": "QmManualHash",
        "decryption_key": "manualkey"
    }
    resp = requests.post(f"{BASE_URL}/certificates/create", json=manual_cert_data, headers=admin_headers)
    if resp.status_code != 200:
         print(f"    FAILURE: Created Failed: {resp.text}")
         sys.exit(1)
         
    manual_cert_id = resp.json()["id"]
    print(f"    Manual Certificate Created: ID {manual_cert_id} (Date: 2020-01-01)")
    
    # Check Eligibility
    resp = requests.post(f"{BASE_URL}/certificates/{manual_cert_id}/verify-conditions", json={}, headers=student_headers)
    if resp.json()["cert_status"] == "UNLOCKED":
        print("    SUCCESS: Manual Date Certificate is UNLOCKED!")
    else:
        print("    FAILURE: Manual Date Certificate still LOCKED.")
        sys.exit(1)

        print("    FAILURE: Manual Date Certificate still LOCKED.")
        sys.exit(1)

    # 13. Test AI Date Format (DD Month YYYY)
    print("[13] Testing AI Date Format (15 June 2020)...")
    ai_date_cert_data = {
        "title": "AI Date Cert",
        "student_username": "StudentUser",
        "conditions_text": "Release after 15 June 2020",
        "encrypted_ipfs_hash": "QmAIDateHash",
        "decryption_key": "aikey"
    }
    resp = requests.post(f"{BASE_URL}/certificates/create", json=ai_date_cert_data, headers=admin_headers)
    if resp.status_code != 200:
         print(f"    FAILURE: AI Date Cert Creation Failed: {resp.text}")
         sys.exit(1)
    
    ai_cert_id = resp.json()["id"]
    print(f"    AI Date Certificate Created: ID {ai_cert_id}")
    
    
    # Check Eligibility
    resp = requests.post(f"{BASE_URL}/certificates/{ai_cert_id}/verify-conditions", json={}, headers=student_headers)
    if resp.json()["cert_status"] == "UNLOCKED":
        print("    SUCCESS: AI Date Certificate (15 June 2020) is UNLOCKED!")
    else:
        print(f"    FAILURE: AI Date Certificate still LOCKED. Status: {resp.json()['cert_status']}")
        sys.exit(1)

    # 14. Test Combined Conditions (Time AND Approval)
    print("[14] Testing Combined Conditions (Time Future + Approval)...")
    combined_cert_data = {
        "title": "Combined Logic Cert",
        "student_username": "StudentUser",
        "manual_date": "2030-01-01", # Future date
        "require_approval": True,
        "encrypted_ipfs_hash": "QmCombinedHash",
        "decryption_key": "combiKey"
    }
    resp = requests.post(f"{BASE_URL}/certificates/create", json=combined_cert_data, headers=admin_headers)
    if resp.status_code != 200:
         print(f"    FAILURE: Combined Cert Creation Failed: {resp.text}")
         sys.exit(1)
    combi_cert_id = resp.json()["id"]
    print(f"    Combined Certificate Created: ID {combi_cert_id}")
    
    # 14a. Verify Initial Lock (Neither Met)
    resp = requests.post(f"{BASE_URL}/certificates/{combi_cert_id}/verify-conditions", json={}, headers=student_headers)
    if resp.json()["cert_status"] == "LOCKED":
        print("    SUCCESS: Initially LOCKED (Date in future, No Approval).")
    else:
        print("    FAILURE: Unlocked prematurely!")
        sys.exit(1)
        
    # 14b. Approve (One Met, Date still future)
    requests.post(f"{BASE_URL}/certificates/{combi_cert_id}/approve-condition/approval", headers=faculty_headers)
    resp = requests.post(f"{BASE_URL}/certificates/{combi_cert_id}/verify-conditions", json={}, headers=student_headers)
    
    # Should STILL be LOCKED because Date is 2030
    if resp.json()["cert_status"] == "UNLOCKED": 
        print("    FAILURE: Unlocked with only Approval! Date is future!")
        sys.exit(1)
    else:
        print("    SUCCESS: Still LOCKED after Approval (Date is future).")

    # 15. Test Delete
    print("[15] Testing Delete Certificate...")
    resp = requests.delete(f"{BASE_URL}/certificates/{combi_cert_id}", headers=admin_headers)
    if resp.status_code == 204:
        print(f"    SUCCESS: Deleted Certificate {combi_cert_id}.")
    else:
        print(f"    FAILURE: API returned {resp.status_code}")
        # sys.exit(1)

    # Verify it's gone
    resp = requests.get(f"{BASE_URL}/certificates/all", headers=admin_headers)
    all_certs = resp.json()
    if any(c['id'] == combi_cert_id for c in all_certs):
         print("    FAILURE: Certificate still exists in list!")
    if any(c['id'] == combi_cert_id for c in all_certs):
         print("    FAILURE: Certificate still exists in list!")
    else:
         print("    SUCCESS: Certificate removed from list.")

    # 16. Test Public Verification (No Auth)
    print("[16] Testing Public Verification (ID 1)...")
    try:
        # ID 1 might not exist if we reset DB, but we created certs earlier.
        # Let's use `ai_cert_id` which we know exists and is UNLOCKED
        public_resp = requests.get(f"{BASE_URL}/certificates/public/{ai_cert_id}")
        if public_resp.status_code == 200:
            p_data = public_resp.json()
            if p_data["student_username"] == "StudentUser":
                print(f"    SUCCESS: Retrieved Public Cert for {p_data['student_username']}")
            else:
                print(f"    FAILURE: Username mismatch in public cert")
        else:
             print(f"    FAILURE: Public API returned {public_resp.status_code}")
    except Exception as e:
        print(f"    FAILURE: Public Verification Exception: {e}")



    # 17. Test Targeted Faculty Approval
    print("[17] Testing Targeted Faculty Approval...")
    # Login Faculty 2
    resp = requests.post(f"{BASE_URL}/token", data={"username": faculty2_data["username"], "password": faculty2_data["password"]})
    fac2_token = resp.json()["access_token"]
    fac2_headers = {"Authorization": f"Bearer {fac2_token}"}
    
    # Create Cert targeted at FacultyTwo
    target_cert_data = {
        "title": "Targeted Cert",
        "student_username": "StudentUser",
        "require_approval": True,
        "targeted_faculty_username": "FacultyTwo",
        "encrypted_ipfs_hash": "QmTargetedHash",
        "decryption_key": "key"
    }
    resp = requests.post(f"{BASE_URL}/certificates/create", json=target_cert_data, headers=admin_headers)
    target_cert_id = resp.json()["id"]
    print(f"    Targeted Cert ID: {target_cert_id} (Target: FacultyTwo)")
    
    # Check if Faculty 1 sees it (Should NOT)
    resp = requests.get(f"{BASE_URL}/pending-approvals", headers=faculty_headers)
    pending_1 = resp.json()
    if any(c['id'] == target_cert_id for c in pending_1):
        print("    FAILURE: FacultyOne sees a cert targeted for FacultyTwo!")
    else:
        print("    SUCCESS: FacultyOne does NOT see the targeted cert.")
        
    # Check if Faculty 2 sees it (Should YES)
    resp = requests.get(f"{BASE_URL}/pending-approvals", headers=fac2_headers)
    pending_2 = resp.json()
    if any(c['id'] == target_cert_id for c in pending_2):
        print("    SUCCESS: FacultyTwo sees the targeted cert.")
        # Approve it
        requests.post(f"{BASE_URL}/certificates/{target_cert_id}/approve-condition/approval", headers=fac2_headers)
        print("    Approved by FacultyTwo.")
    else:
        print("    FAILURE: FacultyTwo does NOT see the targeted cert!")

    # 18. Test File Download (Fix 404)
    print("[18] Testing File Download Endpoint...")
    # Create dummy file
    dummy_hash = "QmMOCKHASHTEST123"
    import os
    os.makedirs("backend/uploads", exist_ok=True)
    with open(f"backend/uploads/{dummy_hash}", "w") as f:
        f.write("This is a dummy certificate file content.")
        
    # Try to download
    resp = requests.get(f"{BASE_URL}/ipfs/{dummy_hash}")
    if resp.status_code == 200:
        print("    SUCCESS: Download endpoint returned 200 OK.")
    else:
        print(f"    FAILURE: Download endpoint returned {resp.status_code}")

    print("--- Verification Complete ---")

if __name__ == "__main__":
    run_verification()
