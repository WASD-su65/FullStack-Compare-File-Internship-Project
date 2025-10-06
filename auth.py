import os
import ldap3
from typing import Optional, Dict, Any
from fastapi import HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from datetime import datetime, timedelta

LDAP_SERVER = os.getenv("LDAP_SERVER", "localhost")
LDAP_BASE_DN = os.getenv("LDAP_BASE_DN", "dc=example,dc=com")
LDAP_USER_DN = os.getenv("LDAP_USER_DN", "ou=users,dc=example,dc=com")
LDAP_BIND_DN = os.getenv("LDAP_BIND_DN", "cn=admin,dc=example,dc=com")
LDAP_BIND_PASSWORD = os.getenv("LDAP_BIND_PASSWORD", "")


JWT_SECRET = os.getenv("JWT_SECRET", "your-secret-key-change-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = int(os.getenv("JWT_EXPIRE_HOURS", "8"))

security = HTTPBearer(auto_error=False)

class LDAPAuth:
    def __init__(self):
        print(f"LDAP: Connecting to server: {LDAP_SERVER}:389")
        try:
            self.server = ldap3.Server(LDAP_SERVER, port=389, get_info=ldap3.ALL)
            print(f"LDAP: Server object created successfully")
        except Exception as e:
            print(f"LDAP: Server creation failed: {e}")
            raise
    
    def authenticate(self, username: str, password: str) -> Optional[Dict[str, Any]]:
        """Authenticate user against LDAP"""
        try:
            print(f"LDAP: Attempting bind with DN: {LDAP_BIND_DN}")
            conn = ldap3.Connection(
                self.server,
                user=LDAP_BIND_DN,
                password=LDAP_BIND_PASSWORD,
                auto_bind=True
            )
            print(f"LDAP: Bind successful")
            
            search_filter = f"(sAMAccountName={username})"
            print(f"LDAP: Searching with filter: {search_filter} in base: {LDAP_USER_DN}")
            
            conn.search(
                search_base=LDAP_USER_DN,
                search_filter=search_filter,
                attributes=['sAMAccountName', 'cn', 'mail', 'memberOf']
            )
            
            print(f"LDAP: Found {len(conn.entries)} entries")
            if not conn.entries:
                print(f"LDAP: No user found with sAMAccountName: {username}")
                return None
            
            user_entry = conn.entries[0]
            user_dn = user_entry.entry_dn
            
            try:
                user_conn = ldap3.Connection(
                    self.server,
                    user=user_dn,
                    password=password,
                    auto_bind=True
                )
            except:
                domain_user = f"CSOC\\{username}"
                user_conn = ldap3.Connection(
                    self.server,
                    user=domain_user,
                    password=password,
                    auto_bind=True
                )
            
            user_info = {
                "username": str(user_entry.sAMAccountName),
                "name": str(user_entry.cn),
                "email": str(user_entry.mail) if user_entry.mail else "",
                "groups": [str(group) for group in user_entry.memberOf] if user_entry.memberOf else []
            }
            
            user_conn.unbind()
            conn.unbind()
            
            return user_info
            
        except Exception as e:
            print(f"LDAP authentication error: {e}")
            print(f"LDAP: Server: {LDAP_SERVER}, Bind DN: {LDAP_BIND_DN}")
            return None

def create_access_token(user_info: Dict[str, Any]) -> str:
    """Create JWT access token"""
    expire = datetime.utcnow() + timedelta(hours=JWT_EXPIRE_HOURS)
    payload = {
        "sub": user_info["username"],
        "name": user_info["name"],
        "email": user_info["email"],
        "groups": user_info["groups"],
        "exp": expire
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def verify_token(token: str) -> Optional[Dict[str, Any]]:
    """Verify JWT token"""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.JWTError:
        return None

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict[str, Any]:
    """Get current authenticated user"""
    if not credentials:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    user = verify_token(credentials.credentials)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    return user

def get_optional_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Optional[Dict[str, Any]]:
    """Get current user if authenticated, None otherwise"""
    if not credentials:
        return None
    
    return verify_token(credentials.credentials)

ldap_auth = LDAPAuth()