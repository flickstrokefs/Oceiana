"""
Password hashing with Argon2id and JWT utilities.
Passwords are NEVER logged, returned in responses, or embedded in tokens.
"""
import secrets
import hashlib
from datetime import datetime, timedelta, timezone
from typing import Optional

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, VerificationError, InvalidHashError
from jose import JWTError, jwt

from app.core.config import settings

# Argon2id with OWASP-recommended parameters
_ph = PasswordHasher(
    time_cost=2,       # iterations
    memory_cost=65536, # 64 MiB
    parallelism=2,
    hash_len=32,
    salt_len=16,
)


def hash_password(plain: str) -> str:
    """Return an Argon2id hash of the password."""
    return _ph.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    """Securely verify password. Returns False on any mismatch or error."""
    try:
        return _ph.verify(hashed, plain)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def password_needs_rehash(hashed: str) -> bool:
    """True if the hash parameters are outdated and should be rehashed."""
    return _ph.check_needs_rehash(hashed)


# ── JWT ──────────────────────────────────────────────────────────────────────

ALGORITHM = "HS256"


def _create_token(
    subject: str,
    secret: str,
    expires_delta: timedelta,
    token_type: str,
) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": subject,        # user id only
        "type": token_type,
        "jti": secrets.token_hex(16),  # unique per token — ensures rotation always differs
        "iat": now,
        "exp": now + expires_delta,
    }
    return jwt.encode(payload, secret, algorithm=ALGORITHM)


def create_access_token(user_id: str) -> str:
    return _create_token(
        subject=user_id,
        secret=settings.JWT_SECRET,
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        token_type="access",
    )


def create_refresh_token(user_id: str) -> str:
    return _create_token(
        subject=user_id,
        secret=settings.JWT_REFRESH_SECRET,
        expires_delta=timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        token_type="refresh",
    )


def decode_access_token(token: str) -> Optional[str]:
    """Return user_id string or None if invalid/expired."""
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[ALGORITHM])
        if payload.get("type") != "access":
            return None
        return payload.get("sub")
    except JWTError:
        return None


def decode_refresh_token(token: str) -> Optional[str]:
    """Return user_id string or None if invalid/expired."""
    try:
        payload = jwt.decode(token, settings.JWT_REFRESH_SECRET, algorithms=[ALGORITHM])
        if payload.get("type") != "refresh":
            return None
        return payload.get("sub")
    except JWTError:
        return None


# ── Reset tokens ─────────────────────────────────────────────────────────────

def generate_reset_token() -> tuple[str, str]:
    """
    Returns (raw_token, token_hash).
    Store only token_hash in the database; send raw_token to the user.
    """
    raw = secrets.token_urlsafe(48)
    hashed = hashlib.sha256(raw.encode()).hexdigest()
    return raw, hashed


def hash_reset_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()
