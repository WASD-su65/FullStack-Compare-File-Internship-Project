from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, validator
from typing import Optional
import re
from ..auth import ldap_auth, create_access_token, get_current_user

router = APIRouter(prefix="/auth", tags=["Authentication"])

class LoginRequest(BaseModel):
    username: str
    password: str
    
    @validator('username')
    def validate_username(cls, v):
        if not v or len(v) > 50:
            raise ValueError('Invalid username')
        if not re.match(r'^[a-zA-Z0-9._-]+$', v):
            raise ValueError('Username contains invalid characters')
        return v.strip()
    
    @validator('password')
    def validate_password(cls, v):
        if not v or len(v) > 100:
            raise ValueError('Invalid password')
        return v

class LoginResponse(BaseModel):
    access_token: str
    token_type: str
    user: dict

@router.post("/login", response_model=LoginResponse)
def login(request: LoginRequest):
    """Login with LDAP credentials"""
    username = request.username.replace('(', '').replace(')', '').replace('*', '').replace('\\', '')
    
    print(f"Login attempt for user: {username}")
    user_info = ldap_auth.authenticate(username, request.password)
    print(f"Authentication result: {user_info is not None}")
    
    if not user_info:
        raise HTTPException(
            status_code=401,
            detail="Invalid username or password"
        )
    
    access_token = create_access_token(user_info)
    
    return LoginResponse(
        access_token=access_token,
        token_type="bearer",
        user=user_info
    )

@router.get("/me")
def get_me(current_user: dict = Depends(get_current_user)):
    """Get current user info"""
    return current_user

@router.post("/logout")
def logout():
    """Logout (client should remove token)"""
    return {"message": "Logged out successfully"}