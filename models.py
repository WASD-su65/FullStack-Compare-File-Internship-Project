from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql import func

Base = declarative_base()

class TextReplaceHistory(Base):
    __tablename__ = "text_replace_history"
    
    id = Column(Integer, primary_key=True, index=True)
    zip_id = Column(String(36), unique=True, index=True)
    find_text = Column(Text, nullable=False)
    replace_text = Column(Text, nullable=False)
    total_files = Column(Integer, nullable=False)
    successful = Column(Integer, nullable=False)
    failed = Column(Integer, nullable=False)
    success_rate = Column(String(10), nullable=False)
    total_replacements = Column(Integer, default=0)
    files_with_matches = Column(Integer, default=0)
    files_no_matches = Column(Integer, default=0)
    zip_path = Column(String(500), nullable=False)
    zip_available = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=False)