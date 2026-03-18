# keycloak.py
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, jwk
import requests

security = HTTPBearer()

# Docker-internal URL for fetching JWKS
KEYCLOAK_INTERNAL_URL = "http://keycloak:8080/auth"  
REALM = "pristine-aiops"
CLIENT_ID = "app"

JWKS_URL = f"{KEYCLOAK_INTERNAL_URL}/realms/{REALM}/protocol/openid-connect/certs"

# Public URL of Keycloak for 'iss' validation (must match token 'iss')
ISSUER = f"https://auth.pristine-aiops.local/auth/realms/{REALM}"

_jwks = None

def get_jwks():
    """Fetch JWKS from Keycloak (Docker internal URL)"""
    global _jwks
    if _jwks is None:
        resp = requests.get(JWKS_URL)
        resp.raise_for_status()
        _jwks = resp.json()
    return _jwks

def get_signing_key(token, jwks):
    headers = jwt.get_unverified_header(token)
    kid = headers["kid"]
    key_dict = next(k for k in jwks["keys"] if k["kid"] == kid)
    return jwk.construct(key_dict)

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    jwks = get_jwks()
    try:
        key = get_signing_key(token, jwks)
        payload = jwt.decode(
            token,
            key.to_pem().decode("utf-8"),
            algorithms=["RS256"],
            audience="account",   # frontend client ID
            issuer=ISSUER,        # public URL (matches token)
        )
        return payload
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired token: {str(e)}",
        )

def require_admin(user: dict = Depends(get_current_user)):
    roles = user.get("realm_access", {}).get("roles", [])
    if "aiops-admin" not in roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin role required",
        )
    return user