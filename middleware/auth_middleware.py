from fastapi import Request, HTTPException
from fastapi.responses import RedirectResponse
from starlette.middleware.base import BaseHTTPMiddleware
from ..auth import verify_token

class AuthMiddleware(BaseHTTPMiddleware):
    def __init__(self, app):
        super().__init__(app)
        self.public_paths = {
            "/", "/login", "/static/login.html", "/auth/login", "/health", 
            "/static/", "/favicon.ico", "/favicon.svg", "/jobs", "/system-stats"
        }
    
    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        
        if any(path.startswith(public) for public in self.public_paths):
            return await call_next(request)
        
        if path in ['/jobs', '/system-stats', '/text-replace/history', '/compare-upload'] or path.startswith('/api/') or path.startswith('/text-replace/') or path.startswith('/admin/') or path.startswith('/export/'):
            return await call_next(request)
        
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            if "text/html" in request.headers.get("accept", ""):
                return RedirectResponse(url="/login", status_code=302)
            raise HTTPException(status_code=401, detail="Authentication required")
        
        token = auth_header.split(" ")[1]
        user = verify_token(token)
        if not user:
            if "text/html" in request.headers.get("accept", ""):
                return RedirectResponse(url="/login", status_code=302)
            raise HTTPException(status_code=401, detail="Invalid or expired token")
        
        request.state.user = user
        return await call_next(request)