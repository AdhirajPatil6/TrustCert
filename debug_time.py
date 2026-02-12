from backend import database, models
from datetime import datetime

db = database.SessionLocal()
try:
    print(f"Current UTC: {datetime.utcnow()}")
    vault = db.query(models.Vault).order_by(models.Vault.id.desc()).first()
    if vault:
        print(f"Last Vault ID: {vault.app_id}")
        print(f"Stored Unlock Time: {vault.unlock_time}")
        print(f"Type: {type(vault.unlock_time)}")
        print(f"Is Unlocked? {datetime.utcnow() > vault.unlock_time}")
    else:
        print("No vaults found.")
finally:
    db.close()
