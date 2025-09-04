from __future__ import annotations

import os
import re as _re
import math
from datetime import datetime
from typing import Dict, Any, List

import pandas as pd
from sqlalchemy.orm import Session
from dotenv import load_dotenv

# รองรับทั้งกรณีไฟล์นี้อยู่ในแพ็กเกจ app/ และอยู่ที่รากโปรเจกต์
try:
    from .database import SessionLocal
    from .db_models import CompareSession, CompareResult
except Exception:
    from database import SessionLocal
    from db_models import CompareSession, CompareResult

load_dotenv()

SHEET_NAME = os.getenv("SHEET_NAME") or "Sheet1"
KEY_COLUMN  = os.getenv("KEY_COLUMN")  or "เลขวงจร"

# -------------------- glyph normalize helpers --------------------
_THAI_DIGITS = {ord(c): ord('0') + i for i, c in enumerate("๐๑๒๓๔๕๖๗๘๙")}
_FULLW_DIGITS = {ord(c): ord('0') + i for i, c in enumerate("０１２３４５６７８９")}
_X_LIKE = {'x','X','×','✕','Χ','χ','Х','х','Ｘ','ｘ'}  # Latin/Math/Greek/Cyrillic/Fullwidth

def _to_ascii_digits(s: str) -> str:
    if not isinstance(s, str):
        return "" if s is None else str(s)
    return s.translate(_THAI_DIGITS).translate(_FULLW_DIGITS)

def _unify_x_like(s: str) -> str:
    if not isinstance(s, str):
        s = "" if s is None else str(s)
    return "".join('X' if ch in _X_LIKE else ch for ch in s)

def _normalize_code(s: str) -> str:
    """เลขไทย/ฟูลวิดธ์ → ASCII, X-like → X, ลบตัวคั่นที่ไม่ใช่ [A-Za-z0-9], upper"""
    s = _to_ascii_digits(s)
    s = _unify_x_like(s)
    s = _re.sub(r"[^A-Za-z0-9]+", "", s)
    return s.upper().strip()

def _format_text(x: object) -> str:
    if x is None:
        return ""
    try:
        if isinstance(x, float) and (math.isnan(x) or pd.isna(x)):
            return ""
        if pd.isna(x):
            return ""
    except Exception:
        pass
    s = str(x).strip()
    if not s:
        return ""
    return (s[:1].upper() + s[1:].lower()) if s.isascii() else s

# -------------------- patterns --------------------
_SEP = r"[ \t\u00A0\-_./]*"  # space/NBSP/-_/./
PAT_ALPHA = _re.compile(rf"(?<![A-Za-z0-9])(\d{{4}}){_SEP}([A-Za-z]){_SEP}(\d{{4}})(?![A-Za-z0-9])")
PAT_ID    = _re.compile(rf"(?<![A-Za-z0-9])(\d{{4}}){_SEP}I{_SEP}D{_SEP}(\d{{3,}})(?![A-Za-z0-9])", _re.IGNORECASE)
OLD_TAG_REGEX = _re.compile(r"(เก่า|old)", _re.IGNORECASE)

# -------------------- IO --------------------
def _read_master(master_path: str) -> pd.DataFrame:
    ext = os.path.splitext(master_path)[1].lower()
    if ext != ".xlsx":
        raise ValueError("Master file must be an .xlsx")
    return pd.read_excel(master_path, sheet_name=SHEET_NAME, header=1, dtype=str)

def _read_compare(compare_path: str) -> pd.DataFrame:
    ext = os.path.splitext(compare_path)[1].lower()
    if ext == ".xlsx":
        try:
            return pd.read_excel(compare_path, dtype=str)
        except Exception:
            return pd.read_excel(compare_path, header=None, dtype=str)
    if ext == ".csv":
        try:
            return pd.read_csv(compare_path, dtype=str)
        except UnicodeDecodeError:
            return pd.read_csv(compare_path, encoding="utf-8-sig", dtype=str)
    try:
        return pd.read_excel(compare_path, dtype=str)
    except Exception:
        return pd.read_excel(compare_path, header=None, dtype=str)

# -------------------- extract --------------------
def _extract_all_circuits(text: str) -> List[str]:
    """ดึง 'ทุก' วงจรจากข้อความเดียว (รวมก่อน, unify ก่อนไล่ regex)"""
    if not isinstance(text, str):
        return []
    s = _unify_x_like(_to_ascii_digits(text))

    out: List[str] = []

    # #### A ####
    for m in PAT_ALPHA.finditer(s):
        start = m.start()
        prefix = s[max(0, start - 15): start]
        if OLD_TAG_REGEX.search(prefix):
            continue
        g1, g2, g3 = m.group(1), m.group(2), m.group(3)
        code = _normalize_code(f"{g1}{g2}{g3}")
        if code:
            out.append(code)

    # #### ID ####
    for m in PAT_ID.finditer(s):
        start = m.start()
        prefix = s[max(0, start - 15): start]
        if OLD_TAG_REGEX.search(prefix):
            continue
        g1, g2 = m.group(1), m.group(2)
        code = _normalize_code(f"{g1}ID{g2}")
        if code:
            out.append(code)

    return out

def _pick_service_type(info: dict) -> str:
    for key in ("ประเภท", "บริการ", "Service", "Service Type", "ประเภทบริการ"):
        if key in info and pd.notna(info[key]):
            return str(info[key])
    return ""

def _derive_service_category(circuit_norm: str, service_type) -> str:
    if not isinstance(service_type, str):
        return ""
    base = _format_text(str(service_type).split(":", 1)[0])
    if not isinstance(circuit_norm, str) or len(circuit_norm) < 5:
        return base
    fifth = circuit_norm[4].upper()
    if fifth not in {"J", "Y"}:
        return base
    st_norm    = service_type.strip().lower()
    st_compact = _re.sub(r"[^a-z0-9]+", "", st_norm)
    if "data" in st_norm or st_norm.startswith("data") or st_compact.startswith("data"):
        return "Broadband"
    return base

# -------------------- main compare --------------------
def run_test_compare(master_path: str, compare_path: str) -> Dict[str, Any]:
    if not master_path or not compare_path:
        raise ValueError("master_path and compare_path are required")

    # ===== Master =====
    mdf = _read_master(master_path)
    if KEY_COLUMN not in mdf.columns:
        raise ValueError(f"Master missing KEY_COLUMN: {KEY_COLUMN}")
    mdf[KEY_COLUMN] = mdf[KEY_COLUMN].astype(str).map(_normalize_code)
    mdf.rename(columns={KEY_COLUMN: "__KEY__"}, inplace=True)
    mdf.drop_duplicates(subset=["__KEY__"], inplace=True)
    master_dict = mdf.set_index("__KEY__").to_dict(orient="index")

    # ===== Compare: รวมค่าทุกแถว + รวม "ชื่อคอลัมน์" ด้วย → extract → explode =====
    cdf = _read_compare(compare_path)

    # 1) extract จาก header (ชื่อคอลัมน์)
    header_text = " ".join([("" if c is None else str(c)) for c in cdf.columns])
    header_codes = set(_extract_all_circuits(header_text))

    # 2) extract จากค่าของแถว
    cdf["__joined__"] = cdf.apply(
        lambda r: " ".join([("" if v is None else str(v)) for v in r.values]),
        axis=1
    )
    cdf["__circuits__"] = cdf["__joined__"].map(_extract_all_circuits)
    cdf = cdf[cdf["__circuits__"].map(lambda L: isinstance(L, list) and len(L) > 0)].copy()
    cdf = cdf.explode("__circuits__", ignore_index=True)
    cdf.rename(columns={"__circuits__": "norm_circuit"}, inplace=True)
    cdf["raw_circuit"] = cdf["norm_circuit"]

    # 3) รวม header_codes ที่ยังไม่อยู่ในแถวเข้าไปด้วย (กรณีเลขอยู่บนชื่อคอลัมน์ เช่น 4261X0051)
    codes_in_rows = set(cdf["norm_circuit"].tolist()) if not cdf.empty else set()
    extra_codes = list(header_codes - codes_in_rows)
    if extra_codes:
        extra_df = pd.DataFrame({
            "norm_circuit": extra_codes,
            "raw_circuit":  extra_codes
        })
        cdf = pd.concat([cdf[["norm_circuit","raw_circuit"]], extra_df], ignore_index=True)
    else:
        cdf = cdf[["norm_circuit","raw_circuit"]]

    # ===== DB: สร้าง session พร้อม filename เสมอ =====
    db: Session = SessionLocal()
    session = CompareSession(
        created_at=datetime.utcnow(),
        filename=os.path.basename(compare_path) or "uploaded"
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    # ===== Build results =====
    results: List[Dict[str, Any]] = []
    matched_total = 0
    unmatched_total = 0

    for row in cdf.itertuples():
        circuit_norm = getattr(row, "norm_circuit")
        info    = master_dict.get(circuit_norm)
        matched = 1 if info is not None else 0

        customer       = _format_text((info or {}).get("ลูกค้า"))
        project_name   = _format_text((info or {}).get("ชื่อโครงการ"))
        province       = _format_text((info or {}).get("จังหวัด"))
        service_type   = _pick_service_type(info or {})
        service_cat    = _derive_service_category(circuit_norm, service_type)

        results.append({
            "session_id":       session.id,
            "circuit_raw":      circuit_norm,
            "circuit_norm":     circuit_norm,
            "matched":          matched,
            "customer":         customer if matched else "",
            "project_name":     project_name if matched else "",
            "province":         province if matched else "",
            "service_type":     service_type if matched else "",
            "service_category": service_cat if matched else "",
        })

        if matched: matched_total += 1
        else:       unmatched_total += 1

    # กันซ้ำ (ต่อ job) + แทน NaN ด้วย None
    df_out = pd.DataFrame(results).drop_duplicates(subset=["circuit_norm"])
    df_out = df_out.where(pd.notnull(df_out), None)
    if not df_out.empty:
        db.bulk_insert_mappings(CompareResult, df_out.to_dict(orient="records"))
        db.commit()

    job_id = session.id
    db.close()

    return {
        "job_id":          int(job_id),
        "matched_total":   int(matched_total),
        "unmatched_total": int(unmatched_total),
        "total_records":   int(matched_total + unmatched_total),
    }
