# app/config.py
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
MASTER_EXCEL_PATH = os.getenv("MASTER_EXCEL_PATH", "Your-File.xlsx")
SHEET_NAME = os.getenv("SHEET_NAME", "Sheet1")
KEY_COLUMN = os.getenv("KEY_COLUMN", "circuit_number")

RETENTION_DAYS = int(os.getenv("RETENTION_DAYS", "90"))
CLEANUP_BATCH_SIZE = int(os.getenv("CLEANUP_BATCH_SIZE", "10000"))
ARCHIVE_TO_PARQUET = os.getenv("ARCHIVE_TO_PARQUET", "false").lower() == "true"
ARCHIVE_DIR = os.getenv("ARCHIVE_DIR", "archives")

ADMIN_TOKEN = os.getenv("ADMIN_TOKEN", "7Qvt6t2738")
