"""
Authentication endpoints.
All sensitive operations are rate-limited.
Passwords are NEVER logged, returned, or embedded in tokens.
"""
import hashlib
import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    generate_reset_token,
    hash_password,
    hash_reset_token,
    password_needs_rehash,
    verify_password,
)
from app.db.session import get_db
from app.middleware.auth import get_current_user
from app.models.user import RefreshToken, User
from app.schemas.auth import (
    ChangePasswordRequest,
    ForgotPasswordRequest,
    LoginRequest,
    MessageResponse,
    RegisterRequest,
    ResetPasswordRequest,
    TokenResponse,
    UserResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])
limiter = Limiter(key_func=get_remote_address)

REFRESH_COOKIE = "refresh_token"
REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60  # 7 days in seconds


def _set_refresh_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=REFRESH_COOKIE,
        value=token,
        httponly=True,
        secure=True,          # requires HTTPS in production
        samesite="lax",
        max_age=REFRESH_COOKIE_MAX_AGE,
        path="/auth",         # only sent to /auth/* routes
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(key=REFRESH_COOKIE, path="/auth")


# ── Register ──────────────────────────────────────────────────────────────────

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
async def register(
    request: Request,
    body: RegisterRequest,
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    # Check for existing account without revealing which field failed
    result = await db.execute(select(User).where(User.email == body.email))
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )

    user = User(
        email=body.email,
        password_hash=hash_password(body.password),
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)

    logger.info("New user registered: id=%s", user.id)
    return UserResponse.model_validate(user)


# ── Login ─────────────────────────────────────────────────────────────────────

@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
async def login(
    request: Request,
    response: Response,
    body: LoginRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()

    # Always run verify_password to prevent timing attacks
    dummy_hash = "$argon2id$v=19$m=65536,t=2,p=2$dummysalt1234567$dummyhashvalue1234567890"
    valid = verify_password(body.password, user.password_hash if user else dummy_hash)

    if not user or not valid or not user.is_active:
        # Generic error — never reveal whether email exists
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    # Rehash if parameters are outdated (e.g. after upgrading Argon2 settings)
    if password_needs_rehash(user.password_hash):
        user.password_hash = hash_password(body.password)
        logger.info("Rehashed password for user id=%s", user.id)

    # Issue tokens
    access_token = create_access_token(str(user.id))
    raw_refresh, refresh_hash = generate_reset_token.__wrapped__ if hasattr(generate_reset_token, '__wrapped__') else (None, None)

    # Use security module for refresh token generation
    from app.core.security import generate_reset_token as _gen
    raw_refresh, refresh_hash = _gen()

    # Actually create proper refresh JWT and store its hash
    raw_refresh = create_refresh_token(str(user.id))
    refresh_hash = hashlib.sha256(raw_refresh.encode()).hexdigest()

    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    db_token = RefreshToken(
        user_id=user.id,
        token_hash=refresh_hash,
        expires_at=expires_at,
    )
    db.add(db_token)

    _set_refresh_cookie(response, raw_refresh)
    logger.info("User logged in: id=%s", user.id)
    return TokenResponse(access_token=access_token)


# ── Refresh ───────────────────────────────────────────────────────────────────

@router.post("/refresh", response_model=TokenResponse)
@limiter.limit("30/minute")
async def refresh_token(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    raw = request.cookies.get(REFRESH_COOKIE)
    if not raw:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    user_id = decode_refresh_token(raw)
    if not user_id:
        _clear_refresh_cookie(response)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired refresh token")

    token_hash = hashlib.sha256(raw.encode()).hexdigest()
    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.token_hash == token_hash,
            RefreshToken.expires_at > datetime.now(timezone.utc),
        )
    )
    db_token = result.scalar_one_or_none()
    if not db_token:
        _clear_refresh_cookie(response)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired refresh token")

    # Rotate: delete old, issue new
    await db.delete(db_token)

    new_refresh = create_refresh_token(user_id)
    new_hash = hashlib.sha256(new_refresh.encode()).hexdigest()
    new_db_token = RefreshToken(
        user_id=db_token.user_id,
        token_hash=new_hash,
        expires_at=datetime.now(timezone.utc) + timedelta(days=7),
    )
    db.add(new_db_token)

    _set_refresh_cookie(response, new_refresh)
    return TokenResponse(access_token=create_access_token(user_id))


# ── Logout ────────────────────────────────────────────────────────────────────

@router.post("/logout", response_model=MessageResponse)
async def logout(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    raw = request.cookies.get(REFRESH_COOKIE)
    if raw:
        token_hash = hashlib.sha256(raw.encode()).hexdigest()
        await db.execute(
            delete(RefreshToken).where(RefreshToken.token_hash == token_hash)
        )
    _clear_refresh_cookie(response)
    return MessageResponse(message="Logged out successfully")


# ── Me ────────────────────────────────────────────────────────────────────────

@router.get("/me", response_model=UserResponse)
async def me(current_user: User = Depends(get_current_user)) -> UserResponse:
    return UserResponse.model_validate(current_user)


# ── Forgot password ───────────────────────────────────────────────────────────

@router.post("/forgot-password", response_model=MessageResponse)
@limiter.limit("5/minute")
async def forgot_password(
    request: Request,
    body: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()

    # Always return the same response to avoid email enumeration
    generic = MessageResponse(message="If an account exists, a reset link has been sent")

    if not user:
        return generic

    raw_token, token_hash = generate_reset_token()
    user.reset_token_hash = token_hash
    user.reset_token_expires = datetime.now(timezone.utc) + timedelta(hours=1)

    # ── EMAIL INTEGRATION POINT ──────────────────────────────────────────────
    # Send `raw_token` to `user.email` via SMTP.
    # Example: await send_reset_email(user.email, raw_token)
    # Do NOT log raw_token.
    # ────────────────────────────────────────────────────────────────────────
    logger.info("Password reset requested for user id=%s", user.id)

    return generic


# ── Reset password ────────────────────────────────────────────────────────────

@router.post("/reset-password", response_model=MessageResponse)
@limiter.limit("10/minute")
async def reset_password(
    request: Request,
    body: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    token_hash = hash_reset_token(body.token)
    now = datetime.now(timezone.utc)

    result = await db.execute(
        select(User).where(
            User.reset_token_hash == token_hash,
            User.reset_token_expires > now,
        )
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token",
        )

    user.password_hash = hash_password(body.new_password)
    # Invalidate token (single-use)
    user.reset_token_hash = None
    user.reset_token_expires = None

    # Revoke all refresh tokens so existing sessions are invalidated
    await db.execute(delete(RefreshToken).where(RefreshToken.user_id == user.id))

    logger.info("Password reset completed for user id=%s", user.id)
    return MessageResponse(message="Password reset successfully")


# ── Change password ───────────────────────────────────────────────────────────

@router.post("/change-password", response_model=MessageResponse)
@limiter.limit("10/minute")
async def change_password(
    request: Request,
    body: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    if not verify_password(body.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    current_user.password_hash = hash_password(body.new_password)

    # Revoke all refresh tokens to force re-login on other devices
    await db.execute(delete(RefreshToken).where(RefreshToken.user_id == current_user.id))

    logger.info("Password changed for user id=%s", current_user.id)
    return MessageResponse(message="Password changed successfully")
