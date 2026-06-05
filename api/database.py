import mysql.connector
from mysql.connector import pooling
from dotenv import load_dotenv
import os

load_dotenv()

DB_CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "port": int(os.getenv("DB_PORT", 3306)),
    "user": os.getenv("DB_USER", "root"),
    "password": os.getenv("DB_PASSWORD", ""),
    "database": os.getenv("DB_NAME", "expense_tracker"),
}

try:
    db_pool = pooling.MySQLConnectionPool(
        pool_name="expense_pool",
        pool_size=5,
        **DB_CONFIG
    )
except Exception as e:
    print(f"Failed to create connection pool: {e}")
    db_pool = None


def get_connection():
    if db_pool is None:
        raise RuntimeError("Database connection pool is not available")
    return db_pool.get_connection()
