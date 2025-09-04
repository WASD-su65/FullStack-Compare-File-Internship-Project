from __future__ import annotations

import os
import re
import sys
import importlib.util
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import List, Optional
from datetime import timezone  # <<< เพิ่ม

import pandas as pd
from fastapi import APIRouter, UploadFile, File, HTTPException, Query, Header, Body
from fastapi.responses import FileResponse
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session
from openpyxl import load_workbook

from ..database import SessionLocal
from ..db_models import CompareSession, CompareResult
from ..config import ADMIN_TOKEN, DATABASE_URL, MASTER_EXCEL_PATH, SHEET_NAME

# -------------------------------------------------------------------
# Robust import for run_test_compare
# -------------------------------------------------------------------
try:
    from ..test_compare_insert_full_6 import run_test_compare  # type: ignore
except Exception:
    try:
        from test_compare_insert_full_6 import run_test_compare  # type: ignore
    except Exception:
        def _load_from_file(p: Path):
            if not p.is_file():
                raise FileNotFoundError(str(p))
            spec = importlib.util.spec_from_file_location("test_compare_insert_full_6", str(p))
            if not spec or not spec.loader:
                raise ImportError(f"cannot load spec from {p}")
            mod = importlib.util.module_from_spec(spec)
            sys.modules["test_compare_insert_full_6"] = mod
            spec.loader.exec_module(mod)  # type: ignore
            return getattr(mod, "run_test_compare")

        loaded = None
        runner_path = os.getenv("COMPARE_RUNNER_PATH", "").strip()
        if runner_path:
            loaded = _load_from_file(Path(runner_path))
        else:
            THIS_DIR = Path(__file__).resolve().parent
            PROJECT_ROOT = THIS_DIR.parent.parent
            for c in [
                PROJECT_ROOT / "test_compare_insert_full_6.py",
                PROJECT_ROOT / "scripts" / "test_compare_insert_full_6.py",
            ]:
                try:
                    loaded = _load_from_file(c)
                    break
                except Exception:
                    continue
            if not loaded:
                raise ModuleNotFoundError(
                    "run_test_compare not found. "
                    "Set COMPARE_RUNNER_PATH or place test_compare_insert_full_6.py in app/ or project root."
                )
        run_test_compare = loaded  # type: ignore
# -------------------------------------------------------------------

router = APIRouter()

# -------------------- Admin token helpers --------------------
def _extract_admin_token(
    x_admin_token: Optional[str],
    x_admin_token_alt: Optional[str],
    authorization: Optional[str],
    token_qs: Optional[str],
) -> str:
    if x_admin_token and x_admin_token.strip():
        return x_admin_token.strip()
    if x_admin_token_alt and x_admin_token_alt.strip():
        return x_admin_token_alt.strip()
    if authorization and authorization.lower().startswith("bearer "):
        return authorization.split(" ", 1)[1].strip()
    if token_qs and token_qs.strip():
        return token_qs.strip()
    return ""

def _require_admin(
    x_admin_token: Optional[str] = Header(None, convert_underscores=False),
    x_admin_token_alt: Optional[str] = Header(None, alias="X_Admin_Token"),
    authorization: Optional[str] = Header(None),
    token: Optional[str] = Query(None),
):
    client_token = _extract_admin_token(x_admin_token, x_admin_token_alt, authorization, token)
    ok = bool(ADMIN_TOKEN) and (client_token == ADMIN_TOKEN)
    if not ok:
        raise HTTPException(status_code=401, detail="invalid admin token")

# ---------------- Admin debug/check ----------------
@router.get("/admin/check")
def admin_check(
    x_admin_token: Optional[str] = Header(None, convert_underscores=False),
    x_admin_token_alt: Optional[str] = Header(None, alias="X_Admin_Token"),
    authorization: Optional[str] = Header(None),
    token: Optional[str] = Query(None),
):
    client_token = _extract_admin_token(x_admin_token, x_admin_token_alt, authorization, token)
    ok = bool(ADMIN_TOKEN) and (client_token == ADMIN_TOKEN)
    return {"ok": ok}

@router.get("/admin/debug")
def admin_debug(
    x_admin_token: Optional[str] = Header(None, convert_underscores=False),
    x_admin_token_alt: Optional[str] = Header(None, alias="X_Admin_Token"),
    authorization: Optional[str] = Header(None),
    token: Optional[str] = Query(None),
):
    client_token = _extract_admin_token(x_admin_token, x_admin_token_alt, authorization, token)
    return {
        "X-Admin-Token_len": len(x_admin_token or ""),
        "X_Admin_Token_len": len(x_admin_token_alt or ""),
        "Authorization_present": bool(authorization),
        "token_qs_len": len(token or ""),
        "server_token_len": len(ADMIN_TOKEN or ""),
        "match": bool(ADMIN_TOKEN) and (client_token == ADMIN_TOKEN),
    }

# ---------------- Upload & Jobs ----------------
@router.post("/compare-upload")
async def compare_upload(
    compare_file: UploadFile = File(...),
    master_file: UploadFile | None = File(None),
):
    try:
        cmp_suffix = os.path.splitext(compare_file.filename or "")[1] or ".xlsx"
        with NamedTemporaryFile(delete=False, suffix=cmp_suffix) as tfc:
            cf_path = tfc.name
            tfc.write(await compare_file.read())

        if master_file is not None:
            with NamedTemporaryFile(delete=False, suffix=".xlsx") as tfm:
                mf_path = tfm.name
                tfm.write(await master_file.read())
        else:
            mf_path = MASTER_EXCEL_PATH

        res = run_test_compare(master_path=mf_path, compare_path=cf_path)
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/jobs")
def list_jobs():
    db: Session = SessionLocal()
    try:
        sessions: List[CompareSession] = db.query(CompareSession).order_by(CompareSession.id.desc()).all()
        out = []
        for s in sessions:
            total = db.query(CompareResult).filter(CompareResult.session_id == s.id).count()
            matched = db.query(CompareResult).filter(
                CompareResult.session_id == s.id, CompareResult.matched == 1
            ).count()

            # >>> ส่ง ISO8601 + 'Z' เสมอ (ถือว่า created_at เป็น UTC)
            ca = s.created_at
            if ca is not None:
                if ca.tzinfo is None:
                    created_iso = ca.replace(tzinfo=timezone.utc).isoformat().replace("+00:00", "Z")
                else:
                    created_iso = ca.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
            else:
                created_iso = None

            out.append({
                "job_id": s.id,
                "created_at": created_iso,   # <<< เปลี่ยนมาใช้ค่านี้
                "pinned": bool(s.pinned),
                "total_records": total,
                "matched_total": matched,
                "unmatched_total": total - matched,
            })
        return out
    finally:
        db.close()


@router.get("/jobs/{job_id}/records")
def get_records(
    job_id: int,
    project: str = Query(default=""),
    province: str = Query(default=""),
    customer: str = Query(default=""),
    status: str = Query(default=""),  # Found/Unmatched
    q: str = Query(default=""),
):
    db: Session = SessionLocal()
    try:
        query = db.query(CompareResult).filter(CompareResult.session_id == job_id)
        if project: query = query.filter(CompareResult.project_name == project)
        if province: query = query.filter(CompareResult.province == province)
        if customer: query = query.filter(CompareResult.customer == customer)
        if status:
            if status == "Found": query = query.filter(CompareResult.matched == 1)
            elif status == "Unmatched": query = query.filter(CompareResult.matched == 0)
        if q:
            like = f"%{q}%"
            query = query.filter(
                (CompareResult.customer.ilike(like)) |
                (CompareResult.project_name.ilike(like)) |
                (CompareResult.province.ilike(like)) |
                (CompareResult.service_type.ilike(like)) |
                (CompareResult.circuit_norm.ilike(like)) |
                (CompareResult.circuit_raw.ilike(like))
            )
        results = query.order_by(CompareResult.matched.desc(), CompareResult.id).all()
        return [
            {
                "id": r.id,
                "customer": r.customer,
                "project": r.project_name,
                "province": r.province,
                "type": r.service_category,
                "service_category": r.service_category,
                "circuit_number": r.circuit_norm,
                "circuit_norm": r.circuit_norm,
                "status": "Found" if r.matched else "Unmatched",
            }
            for r in results
        ]
    finally:
        db.close()

# ---------------- PIN / UNPIN ----------------
@router.post("/jobs/{job_id}/pin")
def pin_job(job_id: int, payload: dict = Body(...)):
    pinned = bool(payload.get("pinned"))
    db: Session = SessionLocal()
    try:
        s = db.query(CompareSession).filter(CompareSession.id == job_id).first()
        if not s:
            raise HTTPException(404, "job not found")
        s.pinned = pinned
        db.commit()
        return {"ok": True, "job_id": job_id, "pinned": s.pinned}
    finally:
        db.close()

# ---------------- Admin: Bulk Delete ----------------
@router.delete("/admin/jobs/bulk")
def bulk_delete_jobs(
    job_ids: List[int] = Body(..., embed=True),
    x_admin_token: Optional[str] = Header(None, convert_underscores=False),
    x_admin_token_alt: Optional[str] = Header(None, alias="X_Admin_Token"),
    authorization: Optional[str] = Header(None),
    token: Optional[str] = Query(None),
):
    _require_admin(x_admin_token, x_admin_token_alt, authorization, token)

    db: Session = SessionLocal()
    deleted, skipped = [], []
    try:
        for jid in job_ids:
            s = db.query(CompareSession).filter(CompareSession.id == jid).first()
            if not s:
                skipped.append({"job_id": jid, "reason": "not_found"})
                continue
            if s.pinned:
                skipped.append({"job_id": jid, "reason": "pinned"})
                continue
            db.query(CompareResult).filter(CompareResult.session_id == jid).delete(synchronize_session=False)
            db.query(CompareSession).filter(CompareSession.id == jid).delete(synchronize_session=False)
            deleted.append(jid)
        db.commit()
        return {"ok": True, "deleted": deleted, "skipped": skipped}
    finally:
        db.close()

# ---------------- Export Summary XLSX ----------------
@router.get("/export/summary")
def export_summary(job_id: int = Query(...)):
    try:
        master_df = pd.read_excel(MASTER_EXCEL_PATH, sheet_name=SHEET_NAME, header=1)
        master_df["ชื่อโครงการ"] = master_df["ชื่อโครงการ"].astype(str).str.strip().str.lower()

        def _fmt_sla(x):
            if pd.isna(x): return None
            try:
                f = float(x)
                return int(f) if f.is_integer() else f
            except Exception:
                return x

        master_df["SLA"] = master_df["SLA"].apply(_fmt_sla)
        sla_lookup = master_df.drop_duplicates("ชื่อโครงการ").set_index("ชื่อโครงการ")["SLA"].to_dict()

        engine = create_engine(DATABASE_URL)
        with engine.connect() as conn:
            query = text("""
                SELECT customer, project_name, province, service_type, service_category, circuit_norm
                FROM compare_results
                WHERE session_id = :sid AND matched = 1
            """)
            rows = conn.execute(query, {"sid": job_id}).fetchall()

        def derive_category(circuit_norm: str, service_type) -> str:
            def _fmt(x):
                if x is None: return ""
                s = str(x).strip()
                return s.capitalize() if s and s.isascii() else s
            base = _fmt(str(service_type).split(":")[0] if service_type else "")
            if not isinstance(circuit_norm, str) or len(circuit_norm) < 5: return base
            fifth = circuit_norm[4].upper()
            if fifth not in {"J", "Y"}: return base
            st_norm = (service_type or "").strip().lower()
            st_compact = re.sub(r"[^a-z0-9]+", "", st_norm)
            if ("data" in st_norm) or st_norm.startswith("data") or st_compact.startswith("data"):
                return "Broadband"
            return base

        export_dict = {}
        for r in rows:
            cust = (r.customer or "").strip()
            proj = (r.project_name or "").strip()
            prov = (r.province or "").strip()
            cat  = derive_category(r.circuit_norm, r.service_type or r.service_category)
            cnum = (r.circuit_norm or "").strip().upper()
            if not cnum: continue
            key = (cust, proj, prov, cat)
            export_dict.setdefault(key, {"circuits": set()})["circuits"].add(cnum)

        rows_out = []
        for i, ((cust, proj, prov, cat), data) in enumerate(export_dict.items(), start=1):
            proj_key = (proj or "").strip().lower()
            rows_out.append({
                "#": i, "ลูกค้า": cust, "ชื่อโครงการ": proj,
                "SLA": sla_lookup.get(proj_key), "จังหวัด": prov,
                "ประเภท": f"{cat} : {len(data['circuits'])}",
                "จำนวนวงจร": len(data["circuits"]),
                "เลขวงจร": ", ".join(sorted(data["circuits"])),
            })

        df = pd.DataFrame(rows_out)
        with NamedTemporaryFile(delete=False, suffix=".xlsx") as tf:
            temp_path = tf.name
        df.to_excel(temp_path, index=False)
        wb = load_workbook(temp_path)
        ws = wb.active
        widths = {"A":5,"B":60,"C":150,"D":10,"E":20,"F":30,"G":10,"H":1000}
        for col, w in widths.items():
            ws.column_dimensions[col].width = w
        wb.save(temp_path)

        ts = pd.Timestamp.now().strftime("%d%m%y_%H%M")
        filename = f"summary_export_job{job_id}_{ts}.xlsx"
        return FileResponse(
            path=temp_path,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            filename=filename
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Export summary failed: {e}")
