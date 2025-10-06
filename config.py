import os
from dotenv import load_dotenv
try:
    load_dotenv('.env.docker')
except (FileNotFoundError, PermissionError, OSError) as e:
    import logging
    logging.warning(f"Could not load .env.docker: {e}")

try:
    load_dotenv()
except (FileNotFoundError, PermissionError, OSError) as e:
    import logging
    logging.warning(f"Could not load .env: {e}")

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable must be set")
MASTER_EXCEL_PATH = os.getenv("MASTER_EXCEL_PATH", "NT.CSOC-MS.xlsx")
SHEET_NAME = os.getenv("SHEET_NAME", "Sheet1")
KEY_COLUMN = os.getenv("KEY_COLUMN", "เลขวงจร")

try:
    RETENTION_DAYS = int(os.getenv("RETENTION_DAYS", "90"))
except ValueError:
    RETENTION_DAYS = 90

try:
    CLEANUP_BATCH_SIZE = int(os.getenv("CLEANUP_BATCH_SIZE", "10000"))
except ValueError:
    CLEANUP_BATCH_SIZE = 10000
ARCHIVE_TO_PARQUET = os.getenv("ARCHIVE_TO_PARQUET", "false").lower() == "true"
ARCHIVE_DIR = os.getenv("ARCHIVE_DIR", "archives")

ADMIN_TOKEN = os.getenv("ADMIN_TOKEN")
if not ADMIN_TOKEN:
    raise ValueError("ADMIN_TOKEN environment variable must be set")


try:
    TEXT_REPLACE_FILE_RETENTION_DAYS = int(os.getenv("TEXT_REPLACE_FILE_RETENTION_DAYS", "1"))
except ValueError:
    TEXT_REPLACE_FILE_RETENTION_DAYS = 1

try:
    TEXT_REPLACE_HISTORY_RETENTION_DAYS = int(os.getenv("TEXT_REPLACE_HISTORY_RETENTION_DAYS", "90"))
except ValueError:
    TEXT_REPLACE_HISTORY_RETENTION_DAYS = 90

try:
    JOB_RETENTION_DAYS = int(os.getenv("JOB_RETENTION_DAYS", "60"))
except ValueError:
    JOB_RETENTION_DAYS = 60
