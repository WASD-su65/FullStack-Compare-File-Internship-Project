# app/main.py
from __future__ import annotations
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from .routes.compare import router as compare_router  # ← ใช้ router ใต้ app/routes

app = FastAPI(title="Compare System API")

# CORS เปิดกว้างสำหรับ UI
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
STATIC_DIR = os.path.join(PROJECT_ROOT, "static")
if os.path.isdir(STATIC_DIR):
    app.mount("/static", StaticFiles(directory=STATIC_DIR, html=True), name="static")

@app.get("/")
def root():
    ui_path = os.path.join(PROJECT_ROOT, "compare.html")
    if not os.path.isfile(ui_path):
        return {"hint": "Put compare.html at project root or open /docs for API."}
    return FileResponse(ui_path)

@app.get("/health")
def health():
    return {"status": "ok"}

app.include_router(compare_router)
