from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt
import requests
import os

# Load env vars
KEYCLOAK_URL = os.getenv("KEYCLOAK_URL", "http://192.168.1.201:1165/")
REALM = os.getenv("KEYCLOAK_REALM", "Pristine-AIOps")
CLIENT_ID = os.getenv("KEYCLOAK_CLIENT_ID", "frontend")

ISSUER = f"{KEYCLOAK_URL}/realms/{REALM}"
JWKS_URL = f"{ISSUER}/protocol/openid-connect/certs"

# Simple token scheme (Bearer)
security = HTTPBearer()

# Cache JWKS so we don’t refetch it each request
_jwks_cache = None

def get_jwks():
    global _jwks_cache
    if _jwks_cache is None:
        resp = requests.get(JWKS_URL, verify=False)
        resp.raise_for_status()
        _jwks_cache = resp.json()
    return _jwks_cache

def verify_jwt(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    jwks = get_jwks()
    unverified_header = jwt.get_unverified_header(token)

    rsa_key = {}
    for key in jwks["keys"]:
        if key["kid"] == unverified_header["kid"]:
            rsa_key = {
                "kty": key["kty"],
                "kid": key["kid"],
                "use": key["use"],
                "n": key["n"],
                "e": key["e"]
            }

    if not rsa_key:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid key")

    try:
        payload = jwt.decode(
            token,
            rsa_key,
            algorithms=["RS256"],
            issuer=ISSUER,
            options={"verify_aud": False, "verify_iss": False},  # 👈 disable strict audience validation
        )

        # Log for debug
        print("✅ JWT verified successfully for:", payload.get("preferred_username"))
        print("Token audience:", payload.get("aud"))
        print("Authorized party (azp):", payload.get("azp"))

    except JWTError as e:
        print("❌ JWT decode error:", str(e))
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Token verification failed: {str(e)}"
        )

    user = {
        "username": payload.get("preferred_username"),
        "email": payload.get("email"),
        "roles": payload.get("realm_access", {}).get("roles", []),
    }
    return user