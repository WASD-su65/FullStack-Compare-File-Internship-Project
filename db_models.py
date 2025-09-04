# app/db_models.py
from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, Index, ForeignKey
from sqlalchemy.orm import declarative_base, relationship
from sqlalchemy.sql import func

Base = declarative_base()

class CompareSession(Base):
    __tablename__ = "compare_sessions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    created_at = Column(DateTime, server_default=func.now(), index=True)
    pinned = Column(Boolean, default=False, nullable=False)
    archived_at = Column(DateTime, nullable=True)

    # >>> สำคัญ: ให้ตรงกับ DB จริงที่มีคอลัมน์ filename NOT NULL
    # ถ้า DB เป็น NOT NULL ไม่มี default ให้ใส่ค่าเสมอเวลา INSERT
    filename = Column(String(255), nullable=False)

    results = relationship("CompareResult", back_populates="session", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_sessions_created_at", "created_at"),
        Index("ix_sessions_pinned_archived", "pinned", "archived_at"),
    )

class CompareResult(Base):
    __tablename__ = "compare_results"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(Integer, ForeignKey("compare_sessions.id", ondelete="CASCADE"), index=True)
    created_at = Column(DateTime, server_default=func.now(), index=True)

    # ฟิลด์ที่ UI ใช้อยู่
    customer = Column(String(255))
    project_name = Column(String(255))
    province = Column(String(255))
    service_type = Column(String(255))
    service_category = Column(String(255))

    circuit_norm = Column(String(255), index=True)
    circuit_raw = Column(Text)
    matched = Column(Integer)  # 0/1

    session = relationship("CompareSession", back_populates="results")

    __table_args__ = (
        Index("ix_results_session_id_created_at", "session_id", "created_at"),
        Index("ix_results_matched_session", "matched", "session_id"),
    )
