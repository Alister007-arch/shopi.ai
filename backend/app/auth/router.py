import re
import secrets
import datetime
from datetime import timezone, timedelta
from typing import Optional
from pydantic import BaseModel, Field, field_validator, ConfigDict
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.config import settings
from backend.config.brand import BRAND
from backend.app.db.session import get_db
from backend.app.db.models import User, PasswordResetCode
from backend.app.notifications.service import dispatch_notification
from backend.app.auth.security import (
    hash_password, verify_password,
    create_access_token, create_refresh_token,
    decode_token, get_current_user
)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


EMAIL_REGEX = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"

# Schemas
class RegisterRequest(BaseModel):
    email: str = Field(..., pattern=EMAIL_REGEX, description="Valid email address")
    password: str = Field(..., min_length=8, description="Password must be at least 8 characters.")
    full_name: str = Field(..., min_length=2, max_length=100)
    phone: Optional[str] = None

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: Optional[str]) -> Optional[str]:
        if not v:
            return v
        cleaned = re.sub(r"[\s\-]", "", v.strip())
        if not re.match(r"^[6-9]\d{9}$", cleaned):
            raise ValueError("Phone number must be a valid 10-digit Indian mobile number.")
        return cleaned


class LoginRequest(BaseModel):
    email: str = Field(..., pattern=EMAIL_REGEX)
    password: str


class ForgotPasswordRequest(BaseModel):
    email: str = Field(..., pattern=EMAIL_REGEX)


class ResetPasswordRequest(BaseModel):
    email: str = Field(..., pattern=EMAIL_REGEX)
    code: str = Field(..., min_length=4, max_length=10)
    new_password: str = Field(..., min_length=8, description="Password must be at least 8 characters.")


class RefreshRequest(BaseModel):
    refresh_token: str


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    full_name: str
    phone: Optional[str] = None
    role: str


class AuthResponse(BaseModel):
    user: UserResponse
    access_token: str
    refresh_token: str
    token_type: str = "Bearer"


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    """Registers a new customer account and returns JWT credentials."""
    existing_user = db.query(User).filter(User.email == req.email.lower().strip()).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email address already exists.",
        )

    user = User(
        email=req.email.lower().strip(),
        hashed_password=hash_password(req.password),
        full_name=req.full_name.strip(),
        phone=req.phone,
        role="customer",
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token_payload = {"sub": str(user.id), "email": user.email, "role": user.role}
    access_token = create_access_token(token_payload)
    refresh_token = create_refresh_token(token_payload)

    return AuthResponse(
        user=UserResponse.model_validate(user),
        access_token=access_token,
        refresh_token=refresh_token,
    )


import time
from collections import defaultdict

LOGIN_ATTEMPTS: dict = defaultdict(list)
LOGIN_RATE_LIMIT_MAX = 5
LOGIN_RATE_LIMIT_WINDOW = 60  # seconds


def check_login_rate_limit(key: str):
    now = time.time()
    recent = [t for t in LOGIN_ATTEMPTS[key] if now - t < LOGIN_RATE_LIMIT_WINDOW]
    LOGIN_ATTEMPTS[key] = recent
    if len(recent) >= LOGIN_RATE_LIMIT_MAX:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many login attempts. Please wait 60 seconds and try again.",
        )
    LOGIN_ATTEMPTS[key].append(now)


@router.post("/login", response_model=AuthResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    """Authenticates user credentials and issues signed JWT tokens."""
    email_key = req.email.lower().strip()
    check_login_rate_limit(email_key)

    user = db.query(User).filter(User.email == email_key).first()
    pw_matches = False
    if user and verify_password(req.password, user.hashed_password):
        pw_matches = True

    if not user or not pw_matches:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Clear rate limit history on success
    LOGIN_ATTEMPTS.pop(email_key, None)

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled.",
        )

    token_payload = {"sub": str(user.id), "email": user.email, "role": user.role}
    access_token = create_access_token(token_payload)
    refresh_token = create_refresh_token(token_payload)

    return AuthResponse(
        user=UserResponse.model_validate(user),
        access_token=access_token,
        refresh_token=refresh_token,
    )


@router.post("/refresh")
def refresh_token_endpoint(req: RefreshRequest, db: Session = Depends(get_db)):
    """Exchanges a valid refresh token for a fresh access token."""
    payload = decode_token(req.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token.",
        )

    user_id = payload.get("sub")
    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User no longer active.",
        )

    new_access_token = create_access_token({
        "sub": str(user.id),
        "email": user.email,
        "role": user.role,
    })

    return {
        "access_token": new_access_token,
        "token_type": "Bearer",
    }


@router.get("/me", response_model=UserResponse)
def get_current_user_profile(current_user: User = Depends(get_current_user)):
    """Returns the authenticated user profile."""
    return UserResponse.model_validate(current_user)


class UpdateProfileRequest(BaseModel):
    full_name: Optional[str] = Field(None, min_length=2, max_length=100)
    phone: Optional[str] = None

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: Optional[str]) -> Optional[str]:
        if not v:
            return v
        cleaned = re.sub(r"[\s\-]", "", v.strip())
        if not re.match(r"^[6-9]\d{9}$", cleaned):
            raise ValueError("Phone number must be a valid 10-digit Indian mobile number.")
        return cleaned


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8)


@router.put("/profile", response_model=UserResponse)
def update_profile(
    req: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Updates user personal details."""
    if req.full_name is not None:
        current_user.full_name = req.full_name.strip()
    if req.phone is not None:
        current_user.phone = req.phone
    db.commit()
    db.refresh(current_user)
    return UserResponse.model_validate(current_user)


@router.post("/change-password")
def change_password(
    req: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Changes user password after validating current password."""
    if not verify_password(req.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect.",
        )
    current_user.hashed_password = hash_password(req.new_password)
    db.commit()
    return {"status": "success", "message": "Password updated successfully."}


@router.delete("/account")
def delete_account(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Deactivates and removes user account."""
    current_user.is_active = False
    db.commit()
    return {"status": "success", "message": "Account has been deactivated."}


FORGOT_ATTEMPTS: dict = defaultdict(list)
FORGOT_RATE_LIMIT_MAX = 5
FORGOT_RATE_LIMIT_WINDOW = 60  # seconds

RESET_ATTEMPTS: dict = defaultdict(list)
RESET_RATE_LIMIT_MAX = 5
RESET_RATE_LIMIT_WINDOW = 60  # seconds


@router.post("/forgot-password")
def forgot_password(req: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """Initiates a password reset request and sends a 6-digit verification code to the registered email."""
    email_key = req.email.lower().strip()
    now = time.time()
    recent = [t for t in FORGOT_ATTEMPTS[email_key] if now - t < FORGOT_RATE_LIMIT_WINDOW]
    FORGOT_ATTEMPTS[email_key] = recent
    if len(recent) >= FORGOT_RATE_LIMIT_MAX:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many password reset requests. Please wait 60 seconds and try again.",
        )
    FORGOT_ATTEMPTS[email_key].append(now)

    user = db.query(User).filter(User.email == email_key).first()
    reset_code = None

    if user and user.is_active:
        # Invalidate previous unused codes for this email
        db.query(PasswordResetCode).filter(
            PasswordResetCode.email == email_key,
            PasswordResetCode.is_used == False,
        ).update({"is_used": True})

        # Generate cryptographically secure 6-digit code
        reset_code = f"{secrets.randbelow(900000) + 100000}"
        now_dt = datetime.datetime.now(timezone.utc)
        expires_at = now_dt + timedelta(minutes=15)

        entry = PasswordResetCode(
            email=email_key,
            code=reset_code,
            expires_at=expires_at,
            is_used=False,
        )
        db.add(entry)
        db.commit()

        # Dispatch transactional notification
        try:
            dispatch_notification(
                channel="email",
                recipient=user.email,
                event_type="password_reset",
                subject=f"{BRAND.name} Password Reset Code",
                content=(
                    f"Hi {user.full_name},\n\n"
                    f"We received a request to reset your password for your {BRAND.name} account.\n\n"
                    f"Your 6-digit verification code is: {reset_code}\n\n"
                    f"This code will expire in 15 minutes.\n"
                    f"If you did not make this request, you can safely ignore this email.\n\n"
                    f"Warm regards,\n{BRAND.name} Security Team"
                ),
            )
        except Exception:
            pass

    return {
        "status": "success",
        "message": "If an account exists with this email, a 6-digit verification code has been sent to your email address. Please check your inbox and spam folder.",
    }


@router.post("/reset-password")
def reset_password(req: ResetPasswordRequest, db: Session = Depends(get_db)):
    """Verifies the reset code and updates the user's password."""
    email_key = req.email.lower().strip()
    now = time.time()
    recent = [t for t in RESET_ATTEMPTS[email_key] if now - t < RESET_RATE_LIMIT_WINDOW]
    RESET_ATTEMPTS[email_key] = recent
    if len(recent) >= RESET_RATE_LIMIT_MAX:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many password reset attempts. Please wait 60 seconds and try again.",
        )
    RESET_ATTEMPTS[email_key].append(now)

    clean_code = req.code.strip()
    now_dt = datetime.datetime.now(timezone.utc)

    reset_record = db.query(PasswordResetCode).filter(
        PasswordResetCode.email == email_key,
        PasswordResetCode.code == clean_code,
        PasswordResetCode.is_used == False,
    ).order_by(PasswordResetCode.created_at.desc()).first()

    if not reset_record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification code. Please check and try again.",
        )

    # Check expiration (handle timezone-aware or naive datetimes gracefully)
    expires_at = reset_record.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if now_dt > expires_at:
        reset_record.is_used = True
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification code has expired. Please request a new code.",
        )

    user = db.query(User).filter(User.email == email_key).first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User account not found or disabled.",
        )

    # Update password and consume reset code
    user.hashed_password = hash_password(req.new_password)
    reset_record.is_used = True
    db.commit()

    # Clear rate limit history on success
    RESET_ATTEMPTS.pop(email_key, None)
    LOGIN_ATTEMPTS.pop(email_key, None)

    # Dispatch security alert notification
    try:
        dispatch_notification(
            channel="email",
            recipient=user.email,
            event_type="password_changed",
            subject=f"{BRAND.name} Password Changed Successfully",
            content=(
                f"Hi {user.full_name},\n\n"
                f"The password for your {BRAND.name} account was successfully updated.\n\n"
                f"If you did not perform this action, please contact our support team immediately at {BRAND.supportEmail}.\n\n"
                f"Warm regards,\n{BRAND.name} Security Team"
            ),
        )
    except Exception:
        pass

    return {
        "status": "success",
        "message": "Your password has been successfully reset. You can now sign in with your new password.",
    }


