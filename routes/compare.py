from __future__ import annotations

import os
import re
import sys
import importlib.util
import logging
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import List, Optional
from datetime import timezone

import pandas as pd
from datetime import datetime, timedelta
from fastapi import APIRouter, UploadFile, File, HTTPException, Query, Header, Body, Request
from fastapi.responses import FileResponse
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError, IntegrityError, OperationalError
from openpyxl import load_workbook

from ..database import SessionLocal
from ..db_models import CompareSession, CompareResult
from ..config import ADMIN_TOKEN, DATABASE_URL, MASTER_EXCEL_PATH, SHEET_NAME, JOB_RETENTION_DAYS
try:
    from ..test_compare_insert_full_6 import run_test_compare
except Exception:
    try:
        from test_compare_insert_full_6 import run_test_compare
    except Exception:
        def _load_from_file(p: Path):
            if not p.is_file():
                raise FileNotFoundError(str(p))
            resolved_path = p.resolve()
            project_root = Path(__file__).resolve().parent.parent.parent
            if not resolved_path.is_relative_to(project_root):
                raise ImportError("Path not allowed")
            if resolved_path.suffix != '.py':
                raise ImportError("Invalid file type")
            module_name = "secure_test_module"
            
            spec = importlib.util.spec_from_file_location(module_name, resolved_path)
            if not spec or not spec.loader:
                raise ImportError("Cannot load module spec")
            mod = importlib.util.module_from_spec(spec)
            
            try:
                spec.loader.exec_module(mod)
            except Exception as e:
                raise ImportError(f"Failed to execute module: {e}")
            
            if not hasattr(mod, "run_test_compare"):
                raise ImportError("run_test_compare function not found in module")
            return getattr(mod, "run_test_compare")

        loaded = None
        if True:
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
                    "Place test_compare_insert_full_6.py in project root or scripts folder."
                )
        run_test_compare = loaded

router = APIRouter()

def _cleanup_old_jobs():
    """Auto cleanup jobs older than JOB_RETENTION_DAYS (except pinned)"""
    try:
        db = SessionLocal()
        try:
            cutoff_date = datetime.now() - timedelta(days=JOB_RETENTION_DAYS)
            old_sessions = db.query(CompareSession).filter(
                CompareSession.created_at < cutoff_date,
                CompareSession.pinned != True
            ).all()
            
            deleted_count = 0
            for session in old_sessions:
                try:
                    db.query(CompareResult).filter(CompareResult.session_id == session.id).delete(synchronize_session=False)
                    db.delete(session)
                    deleted_count += 1
                except Exception as e:
                    print(f"Warning: Failed to delete old job {session.id}: {e}")
            
            if deleted_count > 0:
                db.commit()
                print(f"Auto-cleaned {deleted_count} old jobs (older than {JOB_RETENTION_DAYS} days)")
        finally:
            db.close()
    except Exception as e:
        print(f"Warning: Auto cleanup failed: {e}")

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
        parts = authorization.split(" ", 1)
        return parts[1].strip() if len(parts) > 1 else ""
    if token_qs and token_qs.strip():
        return token_qs.strip()
    return ""

def _require_admin(
    x_admin_token: Optional[str] = Header(None, convert_underscores=False),
    x_admin_token_alt: Optional[str] = Header(None, alias="X_Admin_Token"),
    authorization: Optional[str] = Header(None),
    token: Optional[str] = None,
):
    if not ADMIN_TOKEN:
        raise HTTPException(status_code=500, detail="Admin token not configured")
    
    client_token = _extract_admin_token(x_admin_token, x_admin_token_alt, authorization, token)
    
    import hmac
    if not client_token or not hmac.compare_digest(client_token, ADMIN_TOKEN):
        raise HTTPException(status_code=401, detail="invalid admin token")
@router.get("/admin/check")
def admin_check(
    x_admin_token: Optional[str] = Header(None, convert_underscores=False),
    x_admin_token_alt: Optional[str] = Header(None, alias="X_Admin_Token"),
    authorization: Optional[str] = Header(None),
):
    if not ADMIN_TOKEN:
        return {"ok": False}
    
    client_token = _extract_admin_token(x_admin_token, x_admin_token_alt, authorization, None)
    
    import hmac
    try:
        ok = bool(client_token) and hmac.compare_digest(client_token, ADMIN_TOKEN)
    except (TypeError, ValueError):
        ok = False
    return {"ok": ok}

@router.get("/admin/debug")
def admin_debug(
    x_admin_token: Optional[str] = Header(None, convert_underscores=False),
    x_admin_token_alt: Optional[str] = Header(None, alias="X_Admin_Token"),
    authorization: Optional[str] = Header(None),
):
    _require_admin(x_admin_token, x_admin_token_alt, authorization, None)
    client_token = _extract_admin_token(x_admin_token, x_admin_token_alt, authorization, None)
    import hmac
    return {
        "X-Admin-Token_len": len(x_admin_token or ""),
        "X_Admin_Token_len": len(x_admin_token_alt or ""),
        "Authorization_present": bool(authorization),
        "server_token_len": len(ADMIN_TOKEN or ""),
        "match": bool(ADMIN_TOKEN) and (hmac.compare_digest(client_token, ADMIN_TOKEN) if client_token else False),
    }

@router.post("/compare-upload")
async def compare_upload(
    compare_file: UploadFile = File(...),
    master_file: UploadFile | None = File(None),
):
    try:
        cmp_suffix = os.path.splitext(compare_file.filename or "")[1] or ".xlsx"
        cf_path = None
        mf_path = None
        
        try:
            allowed_extensions = {'.xlsx', '.xls', '.csv'}
            if cmp_suffix.lower() not in allowed_extensions:
                raise HTTPException(status_code=400, detail="Invalid file type")
            
            if compare_file.filename:
                original_ext = os.path.splitext(compare_file.filename)[1].lower()
                if original_ext not in allowed_extensions:
                    raise HTTPException(status_code=400, detail="Invalid file extension")
            
            if compare_file.filename:
                import re
                dangerous_patterns = [r'\.\.', r'[<>:"|?*]', r'^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$']
                executable_exts = ['.exe', '.bat', '.cmd', '.com', '.scr', '.pif', '.js', '.vbs', '.jar', '.py', '.php', '.asp', '.jsp']
                
                filename_clean = compare_file.filename.strip()
                for pattern in dangerous_patterns:
                    if re.search(pattern, filename_clean, re.IGNORECASE):
                        raise HTTPException(status_code=400, detail="Invalid filename")
                
                file_ext = os.path.splitext(filename_clean)[1].lower()
                if file_ext in executable_exts:
                    raise HTTPException(status_code=400, detail="Executable files not allowed")
            
            if compare_file.content_type:
                allowed_mime_types = {
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'application/vnd.ms-excel',
                    'text/csv',
                    'application/csv'
                }
                if compare_file.content_type not in allowed_mime_types:
                    raise HTTPException(status_code=400, detail="Invalid MIME type")
            
            content = await compare_file.read()
            if len(content) > 50 * 1024 * 1024:
                raise HTTPException(status_code=413, detail="File too large")
            
            if len(content) < 4:
                raise HTTPException(status_code=400, detail="Invalid file format")
            
            xlsx_signature = content[:4] == b'PK\x03\x04'
            xls_signature = len(content) >= 8 and content[:8] == b'\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1'
            
            csv_signature = False
            if cmp_suffix.lower() == '.csv':
                try:
                    import io
                    with io.BytesIO(content) as csv_buffer:
                        test_df = pd.read_csv(csv_buffer, nrows=1)
                        csv_signature = True
                except (pd.errors.EmptyDataError, pd.errors.ParserError, UnicodeDecodeError, ValueError) as e:
                    logging.warning(f"CSV validation failed: {e}")
                    csv_signature = False
                except Exception as e:
                    logging.exception(f"Unexpected error during CSV validation: {e}")
                    csv_signature = False
            
            if not (xlsx_signature or xls_signature or csv_signature):
                raise HTTPException(status_code=400, detail="Invalid file format")
            
            await compare_file.seek(0)
            
            if not content:
                raise HTTPException(status_code=400, detail="Empty file not allowed")
            
            safe_suffix = cmp_suffix if cmp_suffix in allowed_extensions else '.xlsx'
            with NamedTemporaryFile(delete=False, suffix=safe_suffix, prefix='compare_') as tfc:
                cf_path = tfc.name
                tfc.write(content)
                tfc.flush()

            if master_file is not None:
                master_suffix = os.path.splitext(master_file.filename or "")[1]
                if master_suffix.lower() not in {'.xlsx', '.xls'}:
                    raise HTTPException(status_code=400, detail="Invalid master file type")
                
                if master_file.filename:
                    original_master_ext = os.path.splitext(master_file.filename)[1].lower()
                    if original_master_ext not in {'.xlsx', '.xls'}:
                        raise HTTPException(status_code=400, detail="Invalid master file extension")
                    
                    dangerous_patterns = [r'\.\.', r'[<>:"|?*]', r'^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$']
                    executable_exts = ['.exe', '.bat', '.cmd', '.com', '.scr', '.pif', '.js', '.vbs', '.jar', '.py', '.php', '.asp', '.jsp']
                    
                    master_filename_clean = master_file.filename.strip()
                    for pattern in dangerous_patterns:
                        if re.search(pattern, master_filename_clean, re.IGNORECASE):
                            raise HTTPException(status_code=400, detail="Invalid master filename")
                    
                    master_file_ext = os.path.splitext(master_filename_clean)[1].lower()
                    if master_file_ext in executable_exts:
                        raise HTTPException(status_code=400, detail="Executable master files not allowed")
                
                if master_file.content_type:
                    master_allowed_mime = {
                        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                        'application/vnd.ms-excel'
                    }
                    if master_file.content_type not in master_allowed_mime:
                        raise HTTPException(status_code=400, detail="Invalid master file MIME type")
                
                master_content = await master_file.read()
                if len(master_content) > 50 * 1024 * 1024:
                    raise HTTPException(status_code=413, detail="Master file too large")
                
                if not master_content:
                    raise HTTPException(status_code=400, detail="Empty master file not allowed")
                
                if len(master_content) >= 4:
                    master_xlsx_sig = master_content[:4] == b'PK\x03\x04'
                    master_xls_sig = len(master_content) >= 8 and master_content[:8] == b'\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1'
                    if not (master_xlsx_sig or master_xls_sig):
                        raise HTTPException(status_code=400, detail="Invalid master file format")
                else:
                    raise HTTPException(status_code=400, detail="Invalid master file format")
                    
                safe_master_suffix = master_suffix if master_suffix.lower() in {'.xlsx', '.xls'} else '.xlsx'
                with NamedTemporaryFile(delete=False, suffix=safe_master_suffix, prefix='master_') as tfm:
                    mf_path = tfm.name
                    tfm.write(master_content)
                    tfm.flush()
            else:
                if not MASTER_EXCEL_PATH:
                    raise HTTPException(status_code=500, detail="Master file not configured")
                
                master_path = Path(MASTER_EXCEL_PATH).resolve()
                allowed_base_dirs = [
                    Path(__file__).resolve().parent.parent.parent,
                    Path('/opt/compare-system').resolve()
                ]
                
                if not any(str(master_path).startswith(str(base_dir)) for base_dir in allowed_base_dirs):
                    raise HTTPException(status_code=500, detail="Master file path not allowed")
                
                if not master_path.exists():
                    raise HTTPException(status_code=500, detail="Master file not found")
                    
                mf_path = str(master_path)

            res = run_test_compare(master_path=mf_path, compare_path=cf_path)
            return res
        finally:
            if cf_path and os.path.exists(cf_path):
                try:
                    os.unlink(cf_path)
                except (OSError, IOError) as e:
                    logging.warning(f"Failed to cleanup temp file {cf_path}: {e}")
            if mf_path and mf_path != MASTER_EXCEL_PATH and os.path.exists(mf_path):
                try:
                    os.unlink(mf_path)
                except (OSError, IOError) as e:
                    logging.warning(f"Failed to cleanup temp file {mf_path}: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/jobs")
def list_jobs():
    _cleanup_old_jobs()
    
    db: Session = SessionLocal()
    try:
        from sqlalchemy import func
        
        from sqlalchemy import case
        
        sessions_with_counts = db.query(
            CompareSession.id,
            CompareSession.created_at,
            CompareSession.pinned,
            func.count(CompareResult.id).label('total_records'),
            func.sum(case((CompareResult.matched == 1, 1), else_=0)).label('matched_total')
        ).outerjoin(
            CompareResult, CompareSession.id == CompareResult.session_id
        ).group_by(
            CompareSession.id, CompareSession.created_at, CompareSession.pinned
        ).order_by(CompareSession.id.desc()).all()
        
        out = []
        for s in sessions_with_counts:
            total = s.total_records or 0
            matched = s.matched_total or 0

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
                "created_at": created_iso,
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
    status: str = Query(default=""),
    q: str = Query(default=""),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10000, ge=10, le=50000),
):
    if job_id <= 0:
        raise HTTPException(status_code=400, detail="Invalid job ID")
    
    db: Session = SessionLocal()
    try:
        session_exists = db.query(CompareSession).filter(CompareSession.id == job_id).first()
        if not session_exists:
            raise HTTPException(status_code=404, detail="Job not found")
        
        query = db.query(CompareResult).filter(CompareResult.session_id == job_id)
        if project: query = query.filter(CompareResult.project_name == project)
        if province: query = query.filter(CompareResult.province == province)
        if customer: query = query.filter(CompareResult.customer == customer)
        if status:
            if status == "Found": query = query.filter(CompareResult.matched == 1)
            elif status == "Unmatched": query = query.filter(CompareResult.matched == 0)
        if q:
            safe_q = q.replace('%', '\%').replace('_', '\_')[:100]
            like_pattern = f"%{safe_q}%"
            query = query.filter(
                (CompareResult.customer.ilike(like_pattern)) |
                (CompareResult.project_name.ilike(like_pattern)) |
                (CompareResult.province.ilike(like_pattern)) |
                (CompareResult.service_type.ilike(like_pattern)) |
                (CompareResult.circuit_norm.ilike(like_pattern)) |
                (CompareResult.circuit_raw.ilike(like_pattern))
            )
        offset = (page - 1) * page_size
        results = query.order_by(CompareResult.matched.desc(), CompareResult.id).offset(offset).limit(page_size).all()
        return [
            {
                "id": r.id,
                "customer": r.customer,
                "project": r.project_name,
                "province": r.province,
                "branch": r.branch,
                "sla": r.sla,
                "service_category": r.service_category,
                "circuit_norm": r.circuit_norm,
                "status": "Found" if r.matched else "Unmatched",
            }
            for r in results
        ]
    finally:
        db.close()

@router.post("/jobs/{job_id}/pin")
def pin_job(job_id: int, payload: dict = Body(...)):
    pinned = bool(payload.get("pinned"))
    db: Session = SessionLocal()
    try:
        s = db.query(CompareSession).filter(CompareSession.id == job_id).first()
        if not s:
            raise HTTPException(404, "job not found")
        s.pinned = pinned
        try:
            db.commit()
        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
        return {"ok": True, "job_id": job_id, "pinned": s.pinned}
    finally:
        db.close()

def _delete_single_job(db: Session, job_id: int) -> tuple[bool, str]:
    """Delete a single job with proper error handling."""
    try:
        db.query(CompareResult).filter(CompareResult.session_id == job_id).delete(synchronize_session=False)
        db.query(CompareSession).filter(CompareSession.id == job_id).delete(synchronize_session=False)
        return True, ""
    except (SQLAlchemyError, IntegrityError, OperationalError) as e:
        logging.warning(f"Database error deleting job {job_id}: {e}")
        return False, f"delete_error: {str(e)}"
    except Exception as e:
        logging.exception(f"Unexpected error deleting job {job_id}: {e}")
        return False, f"unexpected_error: {str(e)}"

@router.delete("/admin/jobs/bulk")
def bulk_delete_jobs(
    job_ids: List[int] = Body(..., embed=True),
    x_admin_token: Optional[str] = Header(None, convert_underscores=False),
    x_admin_token_alt: Optional[str] = Header(None, alias="X_Admin_Token"),
    authorization: Optional[str] = Header(None),
):
    _require_admin(x_admin_token, x_admin_token_alt, authorization, None)

    db: Session = SessionLocal()
    deleted, skipped = [], []
    try:
        sessions = db.query(CompareSession).filter(CompareSession.id.in_(job_ids)).all()
        session_map = {s.id: s for s in sessions}
        
        for jid in job_ids:
            s = session_map.get(jid)
            if not s:
                skipped.append({"job_id": jid, "reason": "not_found"})
                continue
            if s.pinned:
                skipped.append({"job_id": jid, "reason": "pinned"})
                continue
            
            success, error_msg = _delete_single_job(db, jid)
            if success:
                deleted.append(jid)
            else:
                skipped.append({"job_id": jid, "reason": error_msg})
        
        if deleted:
            db.commit()
        return {"ok": True, "deleted": deleted, "skipped": skipped}
    except Exception as e:
        db.rollback()
        logging.exception(f"Bulk delete operation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    finally:
        db.close()

@router.get("/export/summary")
def export_summary(job_id: int = Query(...)):
    """
    ดึงข้อมูล summary จาก DB โดยตรง (ไม่ใช้ไฟล์ MASTER)
    ถ้าใน compare_results มีคอลัมน์ 'sla' จะดึงมาใช้ด้วย
    """
    try:
        engine = create_engine(DATABASE_URL)
        with engine.connect() as conn:
            has_sla = False
            try:
                chk = conn.execute(text("SHOW COLUMNS FROM compare_results LIKE 'sla'")).fetchone()
                has_sla = bool(chk)
            except Exception:
                has_sla = False

            allowed_cols = ['customer', 'project_name', 'province', 'service_type', 'service_category', 'circuit_norm']
            if has_sla:
                allowed_cols.append('sla')
            select_cols = ', '.join(allowed_cols)
            
            rows = conn.execute(
                text(f"""
                    SELECT {select_cols}
                    FROM compare_results
                    WHERE session_id = :sid AND matched = 1
                """),
                {"sid": job_id},
            ).fetchall()

        def derive_category(circuit_norm: str, service_type) -> str:
            def _fmt(x):
                if x is None: return ""
                s = str(x).strip()
                return s.capitalize() if s and s.isascii() else s

            base = _fmt(str(service_type).split(":")[0] if service_type else "")
            if not isinstance(circuit_norm, str) or len(circuit_norm) < 5:
                return base
            fifth = circuit_norm[4].upper()
            if fifth not in {"J", "Y"}:
                return base
            st_norm = (service_type or "").strip().lower()
            st_compact = re.sub(r"[^a-z0-9]+", "", st_norm)
            if ("data" in st_norm) or st_norm.startswith("data") or st_compact.startswith("data"):
                return "Broadband"
            return base

        export_dict: dict[tuple, dict] = {}
        for r in rows:
            customer = (r.customer or "").strip()
            project  = (r.project_name or "").strip()
            province = (r.province or "").strip()
            srvc_ty  = r.service_type or r.service_category
            circuit  = (r.circuit_norm or "").strip().upper()
            if not circuit:
                continue

            category = derive_category(circuit, srvc_ty)
            key = (customer, project, province, category)

            if key not in export_dict:
                export_dict[key] = {"circuits": set(), "sla": None}
            export_dict[key]["circuits"].add(circuit)

            try:
                sla_val = getattr(r, "sla", None)
                if sla_val not in (None, ""):
                    export_dict[key]["sla"] = sla_val
            except Exception:
                pass

        rows_out = []
        for i, ((cust, proj, prov, cat), data) in enumerate(export_dict.items(), start=1):
            count = len(data["circuits"])
            type_label = f"{cat} : {count}" if cat else f"{count}"
            rows_out.append(
                {
                    "#": i,
                    "ลูกค้า": cust,
                    "ชื่อโครงการ": proj,
                    "SLA": data.get("sla"),
                    "จังหวัด": prov,
                    "ประเภท": type_label,
                    "จำนวนวงจร": count,
                    "เลขวงจร": ", ".join(sorted(data["circuits"])),
                }
            )

        df = pd.DataFrame(rows_out)
        with NamedTemporaryFile(delete=False, suffix=".xlsx") as tf:
            temp_path = tf.name
        
        try:
            df.to_excel(temp_path, index=False)
            wb = load_workbook(temp_path)
            ws = wb.active
            widths = {"A": 5, "B": 60, "C": 150, "D": 10, "E": 20, "F": 30, "G": 10, "H": 1000}
            for col, w in widths.items():
                ws.column_dimensions[col].width = w
            wb.save(temp_path)
            wb.close()

            ts = pd.Timestamp.now().strftime("%d%m%y_%H%M")
            filename = f"summary_export_job{job_id}_{ts}.xlsx"
            
            def cleanup_file(file_path: str):
                try:
                    clean_path = Path(file_path).resolve()
                    import tempfile
                    allowed_dirs = [Path('/tmp').resolve(), Path(tempfile.gettempdir()).resolve()]
                    
                    if not any(clean_path.is_relative_to(allowed_dir) for allowed_dir in allowed_dirs):
                        logging.warning(f"Attempted to delete file outside allowed directories: {file_path}")
                        return
                    
                    if clean_path.exists() and clean_path.is_file():
                        clean_path.unlink()
                except (OSError, IOError) as e:
                    logging.warning(f"Failed to cleanup export file {file_path}: {e}")
                except Exception as e:
                    logging.exception(f"Unexpected error during file cleanup: {e}")
            
            import threading
            threading.Timer(10.0, lambda: cleanup_file(temp_path)).start()
            
            return FileResponse(
                path=temp_path,
                media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                filename=filename,
            )
        except Exception:
            if os.path.exists(temp_path):
                try:
                    os.unlink(temp_path)
                except (OSError, IOError) as e:
                    logging.warning(f"Failed to cleanup temp file on error: {e}")
            raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Export summary failed: {e}")

@router.post("/admin/cleanup-jobs")
def cleanup_old_jobs_admin(
    x_admin_token: Optional[str] = Header(None, convert_underscores=False),
    x_admin_token_alt: Optional[str] = Header(None, alias="X_Admin_Token"),
    authorization: Optional[str] = Header(None),
):
    """Manual cleanup of old jobs (admin only)"""
    _require_admin(x_admin_token, x_admin_token_alt, authorization, None)
    
    try:
        db = SessionLocal()
        try:
            cutoff_date = datetime.now() - timedelta(days=JOB_RETENTION_DAYS)
            old_sessions = db.query(CompareSession).filter(
                CompareSession.created_at < cutoff_date,
                CompareSession.pinned != True
            ).all()
            
            deleted_count = 0
            for session in old_sessions:
                try:
                    db.query(CompareResult).filter(CompareResult.session_id == session.id).delete(synchronize_session=False)
                    db.delete(session)
                    deleted_count += 1
                except Exception as e:
                    print(f"Warning: Failed to delete old job {session.id}: {e}")
            
            if deleted_count > 0:
                db.commit()
            
            return {
                "ok": True,
                "deleted_count": deleted_count,
                "retention_days": JOB_RETENTION_DAYS,
                "cutoff_date": cutoff_date.strftime('%Y-%m-%d %H:%M:%S')
            }
        finally:
            db.close()
    except Exception as e:
        return {"ok": False, "error": str(e)}




