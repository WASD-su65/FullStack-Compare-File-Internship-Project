from __future__ import annotations
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, RedirectResponse
from .routes.compare import router as compare_router
from .routes.text_replace import router as text_replace_router
from .routes.auth import router as auth_router
from .middleware.security import SecurityHeadersMiddleware
from .middleware.auth_middleware import AuthMiddleware
from .database import init_db
from .models import TextReplaceHistory

app = FastAPI(title="Compare System API")

@app.on_event("startup")
async def startup_event():
    try:
        init_db()
    except Exception as e:
        print(f"Warning: Failed to initialize database: {e}")

app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(AuthMiddleware)
allowed_origins = [
    "http://localhost:8000",
    "http://127.0.0.1:8000",
    "http://localhost:3000",
    "http://127.0.0.1:3000"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type", "Authorization"],
)

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
STATIC_DIR = os.path.join(PROJECT_ROOT, "static")
if os.path.isdir(STATIC_DIR):
    app.mount("/static", StaticFiles(directory=STATIC_DIR, html=True), name="static")

@app.get("/")
def root():
    # Redirect to login page for authentication
    return RedirectResponse(url="/login", status_code=302)

@app.get("/dashboard")
def dashboard():
    # Main dashboard after login
    ui_path = os.path.join(STATIC_DIR, "index.html")
    if not os.path.isfile(ui_path):
        return {"error": "Dashboard not found"}
    return FileResponse(ui_path)

@app.get("/login.html")
def login_page():
    login_path = os.path.join(STATIC_DIR, "login.html")
    if not os.path.isfile(login_path):
        return {"error": "Login page not found"}
    return FileResponse(login_path)

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/system-stats")
def get_system_stats():
    import random
    import time
    

    return {
        "memory": {
            "total": 8.0,
            "used": round(2.1 + random.uniform(0, 1.5), 1),
            "available": round(5.9 - random.uniform(0, 1.5), 1),
            "percent": round(25 + random.uniform(0, 15), 1)
        },
        "disk": {
            "total": 50.0,
            "used": round(12.5 + random.uniform(0, 2), 1),
            "free": round(37.5 - random.uniform(0, 2), 1),
            "percent": round(25 + random.uniform(0, 5), 1)
        },
        "cpu": {
            "percent": round(15 + random.uniform(0, 25), 1),
            "count": 4
        }
    }

app.include_router(auth_router)
app.include_router(compare_router)
app.include_router(text_replace_router)
