# FullStack-Compare-File-Internship-Project
Creator : Poomipat Jitkrongsit
Eng : Compare File Between Main-FIle and Upload-File to get Result or Export to Check Information
Thai (ไทย) : เปรียบเทียบไฟล์ระหว่างไฟล์หลัก และ ไฟล์ที่ต้องการอัพโหลดเข้ามาเพื่อดูผลลัพธ์และดาวน์โหลดออกมาเพื่อเช็คข้อมูล

# Table of Contents / สารบัญ
- About / เกี่ยวกับโครงการ
- Features / ฟีเจอร์หลัก
- Tech Stack / เทคโนโลยีที่ใช้
- Project Structure / โครงสร้างโปรเจกต์
- Getting Started / วิธีเริ่มต้นใช้งาน
    - Prerequisites / ข้อกำหนดเบื้องต้น
    - Backend — Install & Run / ติดตั้งและรันฝั่ง Backend
    - Frontend — Run locally / รันหน้าเว็บ (Frontend)
    - Docker (optional) / Docker (ถ้าต้องการ)
- API Reference (suggested) / ตัวอย่าง API ที่แนะนำ
- File formats & Validation / รูปแบบไฟล์และการตรวจสอบ
- Testing / การทดสอบ
- Deployment / การ Deploy
- Contributing / การมีส่วนร่วม
- License / ใบอนุญาต
- Contact / ติดต่อ
- About file / About (แยกไฟล์)

# About / เกี่ยวกับโครงการ
**English**
FullStack-Compare-File is an internship project built to compare a trusted main file (source of truth) against an uploaded file (new data) and produce a reconciled result. The project contains a RESTful backend API for processing and comparison logic, and a minimal frontend for uploading files, visualizing differences, and exporting results.
Main goals:
- Detect and classify differences between two tabular datasets (e.g., missing records, mismatches, duplicates).
- Produce human-readable and machine-readable reports (CSV/Excel/JSON) that highlight the differences.
- Provide simple UI for quick verification and a programmable API for automation.

**ภาษาไทย**
FullStack-Compare-File เป็นโปรเจกต์ฝึกงานที่พัฒนาเพื่อเปรียบเทียบ ไฟล์หลัก (Main File) ซึ่งเป็นแหล่งข้อมูลอ้างอิง กับ ไฟล์ที่อัปโหลด (Upload File) ที่นำเข้ามาใหม่ โดยมีเป้าหมายเพื่อค้นหาและจัดประเภทความแตกต่าง ระบุรายการที่ขาดหายหรือไม่ตรงกัน และส่งออกผลลัพธ์เพื่อใช้ตรวจสอบหรืออัปเดตระบบอื่น ๆ ได้อย่างอัตโนมัติ
เป้าหมายหลัก:
- ตรวจจับและจำแนกความแตกต่างระหว่างชุดข้อมูลแบบตาราง เช่น ระเบียนขาดหาย ข้อมูลไม่ตรงกัน หรือข้อมูลซ้ำ
- สร้างรายงานที่อ่านง่ายสำหรับมนุษย์ และสามารถนำไปประมวลผลต่อ (CSV / Excel / JSON)
- มีหน้า UI สำหรับตรวจสอบอย่างรวดเร็ว และ API สำหรับการทำงานอัตโนมัติ

# Features / ฟีเจอร์หลัก
- Upload & compare: อัปโหลดไฟล์หลักและไฟล์เปรียบเทียบแล้วสั่งให้ระบบเปรียบเทียบ
- Diff classification: แยกประเภทผลลัพธ์เป็น Added / Removed / Modified / Unchanged / Duplicate
- Export: ส่งออกผลลัพธ์เป็น CSV / Excel / JSON
- Web UI: หน้าเว็บใช้งานง่ายสำหรับเลือกไฟล์ ดูผล และดาวน์โหลด
- API: มี endpoint สำหรับอัปโหลดไฟล์, เรียกฟังก์ชันเปรียบเทียบ, และดาวน์โหลดผล
- Validation & logs: ตรวจสอบรูปแบบไฟล์ รายงานข้อผิดพลาด และเก็บ log เบื้องต้น

# Tech Stack / เทคโนโลยีที่ใช้ (ตัวอย่าง)
- **Backend** : Python, FastAPI, Uvicorn, SQLAlchemy (หรือ ORM ที่ชอบ), Pandas (สำหรับเปรียบเทียบตาราง)
- **Frontend** : HTML / CSS / JavaScript (vanilla) — <pre> compare.html </pre>, <pre> login.html </pre> เป็นต้น
- **Database (optional)** : SQLite / PostgreSQL
- **Dev tools** : pytest (for tests), Docker (optional)

# Project Structure / โครงสร้างโปรเจกต์ (ตัวอย่าง)

<pre>
.
├── app/ # FastAPI app (หรือชื่อโฟลเดอร์ backend ของคุณ)
│ ├── main.py # entrypoint ของแอพ
│ ├── api/ # routing และ controllers
│ ├── services/ # logic สำหรับการเปรียบเทียบ
│ ├── models/ # ORM models / Pydantic schemas
│ └── utils/ # helper functions (file parsing, validation)
├── scripts/ # สคริปต์ช่วยเหลือ เช่น migration, seed
├── frontend/ # static frontend files (compare.html, css, js)
├── docker/ # Dockerfile / docker-compose
├── tests/ # unit & integration tests
├── requirements.txt
├── README.md
└── ABOUT.md</pre>

# Getting Started / วิธีเริ่มต้นใช้งาน
**Prerequisites / ข้อกำหนดเบื้องต้น**
- Python 3.9+ (หรือ 3.x ตามที่โปรเจกต์ต้องการ)
- pip หรือ pipenv / poetry
- (ถ้ามี) Docker & Docker Compose หากต้องการรันใน container
- เว็บเบราว์เซอร์สมัยใหม่

# Backend — Install & Run / ติดตั้งและรันฝั่ง Backend

1. Clone repository
<pre>git clone https://github.com/WASD-su65/FullStack-Compare-File-Internship-Project.git
cd FullStack-Compare-File-Internship-Project</pre>

2. สร้าง virtual environment และติดตั้ง dependencies
<pre>python -m venv .venv
source .venv/bin/activate # macOS / Linux
.\.venv\Scripts\activate # Windows PowerShell
pip install -r requirements.txt</pre>

3. สร้างไฟล์ environment (ถ้ามี <pre>.env.example</pre>) และตั้งค่า
<pre># .env (ตัวอย่าง)
APP_HOST=0.0.0.0
APP_PORT=8000
DATABASE_URL=sqlite:///./db.sqlite3
UPLOAD_DIR=./uploads</pre>

4. รันเซิร์ฟเวอร์ (ตัวอย่างใช้ Uvicorn)
<pre>uvicorn app.main:app --reload --host 0.0.0.0 --port 8000</pre>
หลังจากรันแล้ว คุณจะเห็น log ที่แจ้ง URL เช่น <pre>http://127.0.0.1:8000</pre> และถ้าเปิด <pre>/docs</pre> จะเห็น OpenAPI docs (ถ้าใช้ FastAPI)

# Frontend — Run locally / รันหน้าเว็บ (Frontend)

1.เปิดไฟล์ <pre>frontend/compare.html</pre> ในเบราว์เซอร์ หรือ

2.ถ้าต้องการเสิร์ฟไฟล์ static ผ่าน backend ให้ตรวจสอบว่า backend เสิร์ฟ static โฟลเดอร์ (เช่น <pre>app/static</pre> หรือ <pre>frontend</pre>) แล้วเปิด URL หน้าเว็บ

การใช้งานทั่วไป:
- เลือกไฟล์ Main File
- เลือกไฟล์ Upload File
- คลิกปุ่ม **Compare**
- ดูผลลัพธ์บน UI และกด Export เพื่อดาวน์โหลดผลลัพธ์
หาก frontend ของคุณใช้ bundler/packager (เช่น webpack, vite) ระบุคำสั่ง build / dev เพิ่มในส่วนนี้

# Docker (optional) / Docker (ถ้าต้องการ)

ตัวอย่าง Dockerfile / docker-compose (ปรับตามโปรเจกต์จริง):
<pre># Dockerfile (ตัวอย่าง)
FROM python:3.10-slim
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY . /app
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]</pre>
<pre># docker-compose.yml (ตัวอย่าง)
version: '3.8'
services:
web:
build: .
ports:
- "8000:8000"
volumes:
- .:/app
environment:
- DATABASE_URL=sqlite:///./db.sqlite3</pre>

# API Reference (suggested) / ตัวอย่าง API ที่แนะนำ
**Note**: ปรับ endpoint ให้ตรงกับโค้ดของคุณใน repository หากชื่อ/โครงสร้างจริงต่างจากด้านล่าง

1. <pre>POST /api/upload</pre> — Upload a file
**Request** (multipart/form-data)
- <pre>file</pre>: file to upload
- <pre>file_type</pre>: <pre>main</pre> or <pre>upload</pre>

**Response**
<pre>
{
"status": "success",
"file_id": "<uuid>",
"message": "File uploaded"
}</pre>

2. <pre>POST /api/compare</pre> — Compare two uploaded files
**Request (JSON)**
<pre>
{
"main_file_id": "<uuid>",
"upload_file_id": "<uuid>",
"key_columns": ["id", "email"],
"compare_columns": ["name","address","status"]
}</pre>

**Response**
<pre>
{
"status": "success",
"summary": {
"total_main": 1000,
"total_upload": 980,
"added": 10,
"removed": 30,
"modified": 20
},
"report_id": "<uuid>"
}</pre>

3. <pre>GET /api/report/{report_id}</pre> — Download report (CSV/Excel/JSON)
**Parameters**
- <pre>format</pre> : <pre>csv</pre> / <pre>xlsx</pre> / <pre>json</pre> (query param)
**Response**
- File download of the comparison report

4. <pre>GET /api/health</pre> — Health check
**Response**
<pre>{ "status": "ok" }</pre>

# File formats & Validation / รูปแบบไฟล์และการตรวจสอบ
**Supported formats (suggested)** : CSV, XLSX, TSV, JSON

**Validation steps**:
1. Check file extension & declared MIME type
2. Parse header columns and validate required key columns
3. Check for duplicate keys if that is disallowed
4. Normalize simple data types (trim whitespace, lowercasing email, date parsing)
5. Provide friendly error messages detailing which rows failed to parse

**Example CSV header** :
<pre>id,name,email,address,status</pre>

# Testing / การทดสอบ
- Tests should be placed under <pre>tests/</pre> and runnable with pytest
<pre>pytest -q</pre>

แนะนำเขียน unit test สำหรับ:
- file parsing and validation
- comparison logic (edge cases: missing keys, different types)
- API endpoints (upload, compare, report)

# Deployment / การ Deploy
**Simple approach** : รันบน VPS / VM ด้วย Uvicorn + Reverse proxy เช่น Nginx **Container approach** : สร้าง Docker image และนำไปรันบน container platform (Docker Swarm / Kubernetes / Cloud Run)

**Steps (high level)** :
1. Build production image (no <pre>--reload</pre>)
2. ตั้งค่า environment variables ให้เหมาะสม
3. หากใช้ DB ที่ persist ให้เชื่อมต่อ DB ภายนอก (Postgres, MySQL ฯลฯ)

# Contributing / การมีส่วนร่วม
ยินดีรับ Pull Requests และ Issues นะครับ — กรุณาทำตามขั้นตอน:

1. Fork repo
2. สร้าง branch ใหม่ <pre>feature/your-feature</pre> หรือ <pre>fix/issue-number</pre>
3. สร้าง PR พร้อมคำอธิบายการเปลี่ยนแปลง
4. เพิ่ม tests หากเป็นไปได้

**Code style** : ใช้ <pre>flake8</pre> / <pre>black</pre> (แนะนำ) เพื่อความสม่ำเสมอ

# License / ใบอนุญาต
Englist : Use #Creater : Poomipat Jitkrongsit ภาษาไทย : ใช้ #Creater : Poomipat Jitkrongsit

# Contact / ติดต่อ
- GitHub: <pre>https://github.com/WASD-su65/FullStack-Compare-File-Internship-Project</pre>
- Maintainer / ผู้ดูแล: (ระบุชื่อหรืออีเมล)
