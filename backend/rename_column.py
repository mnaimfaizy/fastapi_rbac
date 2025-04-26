import sqlite3

# Connect to the SQLite database
conn = sqlite3.connect("dev.db")
cursor = conn.cursor()

# Check if the column exists
cursor.execute("PRAGMA table_info(User)")
columns = [col[1] for col in cursor.fetchall()]

if "needsToChangePassword" in columns and "needs_to_change_password" not in columns:
    print("Renaming needsToChangePassword column to needs_to_change_password...")
    
    # SQLite does not support directly renaming columns,
    # so we need to create a new table with the desired schema
    cursor.execute("""
    CREATE TABLE User_new (
        first_name VARCHAR,
        last_name VARCHAR,
        email VARCHAR,
        password VARCHAR NOT NULL,
        is_active BOOLEAN NOT NULL,
        is_superuser BOOLEAN NOT NULL,
        last_updated_by INTEGER,
        needs_to_change_password BOOLEAN NOT NULL,  -- Renamed column
        expiry_date DATETIME,
        contact_phone VARCHAR,
        last_changed_password_date DATETIME,
        number_of_failed_attempts INTEGER,
        verified BOOLEAN NOT NULL,
        verification_code VARCHAR,
        id VARCHAR(36) NOT NULL,
        updated_at DATETIME,
        created_at DATETIME,
        PRIMARY KEY (id)
    )
    """)
    
    # Copy data from the original table to the new table
    cursor.execute("""
    INSERT INTO User_new 
    SELECT 
        first_name, last_name, email, password, is_active, is_superuser, 
        last_updated_by, needsToChangePassword, expiry_date, contact_phone, 
        last_changed_password_date, number_of_failed_attempts, verified, 
        verification_code, id, updated_at, created_at
    FROM User
    """)
    
    # Drop the original table
    cursor.execute("DROP TABLE User")
    
    # Rename the new table to the original table name
    cursor.execute("ALTER TABLE User_new RENAME TO User")
    
    # Recreate indexes
    cursor.execute("CREATE UNIQUE INDEX ix_User_email ON User (email)")
    cursor.execute("CREATE INDEX ix_User_first_name ON User (first_name)")
    cursor.execute("CREATE INDEX ix_User_id ON User (id)")
    cursor.execute("CREATE INDEX ix_User_last_name ON User (last_name)")
    
    print("Column renamed successfully!")
else:
    print("Either needsToChangePassword column does not exist or needs_to_change_password already exists")

# Commit changes and close connection
conn.commit()
conn.close()

