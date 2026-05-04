import os

import jwt
from jwt import PyJWKClient


class AuthError(Exception):
    pass


_jwks_client: PyJWKClient | None = None


def _get_jwks_client() -> PyJWKClient:
    global _jwks_client
    if _jwks_client is None:
        url = os.environ.get("SUPABASE_URL")
        if not url:
            raise AuthError("SUPABASE_URL not configured on the server")
        jwks_url = f"{url.rstrip('/')}/auth/v1/.well-known/jwks.json"
        _jwks_client = PyJWKClient(jwks_url, cache_keys=True)
    return _jwks_client


def verify_supabase_jwt(token: str) -> dict:
    try:
        header = jwt.get_unverified_header(token)
    except jwt.InvalidTokenError as e:
        raise AuthError(f"invalid token: {e}")

    alg = header.get("alg", "")

    try:
        if alg == "HS256":
            secret = os.environ.get("SUPABASE_JWT_SECRET")
            if not secret:
                raise AuthError("SUPABASE_JWT_SECRET not configured")
            payload = jwt.decode(
                token, secret, algorithms=["HS256"], audience="authenticated"
            )
        elif alg in ("ES256", "RS256"):
            client = _get_jwks_client()
            signing_key = client.get_signing_key_from_jwt(token)
            payload = jwt.decode(
                token,
                signing_key.key,
                algorithms=[alg],
                audience="authenticated",
            )
        else:
            raise AuthError(f"unsupported alg: {alg}")
    except jwt.ExpiredSignatureError:
        raise AuthError("token expired")
    except jwt.InvalidTokenError as e:
        raise AuthError(f"invalid token: {e}")
    except AuthError:
        raise
    except Exception as e:
        raise AuthError(f"verification failed: {e}")

    user_id = payload.get("sub")
    if not user_id:
        raise AuthError("token missing sub")

    metadata = payload.get("user_metadata") or {}
    username = metadata.get("username") or payload.get("email") or "climber"
    return {
        "id": user_id,
        "username": username,
        "email": payload.get("email"),
    }
