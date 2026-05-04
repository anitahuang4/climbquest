import os
import jwt


class AuthError(Exception):
    pass


def verify_supabase_jwt(token: str) -> dict:
    secret = os.environ.get("SUPABASE_JWT_SECRET")
    if not secret:
        raise AuthError("SUPABASE_JWT_SECRET not configured on the server")
    try:
        payload = jwt.decode(
            token,
            secret,
            algorithms=["HS256"],
            audience="authenticated",
        )
    except jwt.ExpiredSignatureError:
        raise AuthError("token expired")
    except jwt.InvalidTokenError as e:
        raise AuthError(f"invalid token: {e}")

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
