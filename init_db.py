from backend import database, models
import os

def init_db():
    print("Connecting to DB at:", database.SQLALCHEMY_DATABASE_URL)
    try:
        models.Base.metadata.create_all(bind=database.engine)
        print("Tables created successfully.")
    except Exception as e:
        print(f"Error creating tables: {e}")

if __name__ == "__main__":
    # If running as script, ensure path is correct relative to execution from root
    init_db()
