from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
import hashlib
from jose import jwt, JWTError

from backend.database import get_db
from backend.models import User, Team, TeamMembership

router = APIRouter(tags=["auth"])

SECRET_KEY = "audhd-pm-secret-key-change-in-production-2026"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 30


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def verify_password(password: str, hashed: str) -> bool:
    return hash_password(password) == hashed


# ── Schemas ────────────────────────────────────────────────────────────
class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


class UserCreate(BaseModel):
    username: str
    password: str
    display_name: str = ""
    role: str = "user"


class UserUpdate(BaseModel):
    display_name: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None


class TeamCreate(BaseModel):
    name: str
    description: str = ""


class TeamAddMember(BaseModel):
    user_id: int
    role: str = "member"


# ── Helpers ────────────────────────────────────────────────────────────
def create_access_token(user_id: int, username: str, role: str):
    expire = datetime.utcnow() + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    payload = {
        "sub": str(user_id),
        "username": username,
        "role": role,
        "exp": expire,
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(token: str, db: Session) -> User:
    if not token:
        raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = int(payload["sub"])
    except (JWTError, ValueError):
        raise HTTPException(401, "Invalid token")
    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active:
        raise HTTPException(401, "User not found or inactive")
    return user


def _extract_token(authorization: str = "") -> str:
    if authorization.startswith("Bearer "):
        return authorization[7:]
    return authorization


# ── Auth Endpoints ─────────────────────────────────────────────────────
@router.post("/api/auth/login")
def login(data: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == data.username).first()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(401, "Invalid credentials")
    if not user.is_active:
        raise HTTPException(401, "Account inactive")
    token = create_access_token(user.id, user.username, user.role)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id, "username": user.username,
            "display_name": user.display_name, "role": user.role,
        },
    }


@router.post("/api/auth/verify")
def verify_token(token_data: dict, db: Session = Depends(get_db)):
    token = token_data.get("token", "")
    try:
        user = get_current_user(token, db)
        return {"valid": True, "user": {
            "id": user.id, "username": user.username,
            "display_name": user.display_name, "role": user.role,
        }}
    except HTTPException:
        return {"valid": False}


# ── User Management (admin only) ───────────────────────────────────────
@router.get("/api/users")
def list_users(authorization: str = "", db: Session = Depends(get_db)):
    token = _extract_token(authorization)
    current = get_current_user(token, db)
    if current.role != "admin":
        raise HTTPException(403, "Admin only")
    users = db.query(User).all()
    return [{"id": u.id, "username": u.username,
             "display_name": u.display_name, "role": u.role,
             "is_active": u.is_active} for u in users]


@router.post("/api/users", status_code=201)
def create_user(data: UserCreate, authorization: str = "",
                db: Session = Depends(get_db)):
    token = _extract_token(authorization)
    current = get_current_user(token, db)
    if current.role != "admin":
        raise HTTPException(403, "Admin only")
    existing = db.query(User).filter(User.username == data.username).first()
    if existing:
        raise HTTPException(400, "Username already exists")
    user = User(
        username=data.username,
        password_hash=hash_password(data.password),
        display_name=data.display_name,
        role=data.role if data.role in ("admin", "user") else "user",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"id": user.id, "username": user.username,
            "display_name": user.display_name, "role": user.role}


@router.put("/api/users/{user_id}")
def update_user(user_id: int, data: UserUpdate,
                authorization: str = "", db: Session = Depends(get_db)):
    token = _extract_token(authorization)
    current = get_current_user(token, db)
    if current.role != "admin" and current.id != user_id:
        raise HTTPException(403, "Not authorized")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")
    for key, val in data.model_dump(exclude_unset=True).items():
        setattr(user, key, val)
    db.commit()
    return {"id": user.id, "username": user.username,
            "display_name": user.display_name, "role": user.role,
            "is_active": user.is_active}


# ── Team Management ────────────────────────────────────────────────────
@router.get("/api/teams")
def list_teams(authorization: str = "", db: Session = Depends(get_db)):
    token = _extract_token(authorization)
    get_current_user(token, db)
    teams = db.query(Team).all()
    result = []
    for t in teams:
        members = db.query(TeamMembership).filter(
            TeamMembership.team_id == t.id).all()
        result.append({
            "id": t.id, "name": t.name, "description": t.description,
            "member_count": len(members),
            "members": [{"user_id": m.user_id, "role": m.role}
                        for m in members],
        })
    return result


@router.post("/api/teams", status_code=201)
def create_team(data: TeamCreate, authorization: str = "",
                db: Session = Depends(get_db)):
    token = _extract_token(authorization)
    current = get_current_user(token, db)
    if current.role != "admin":
        raise HTTPException(403, "Admin only")
    team = Team(name=data.name, description=data.description)
    db.add(team)
    db.commit()
    db.refresh(team)
    membership = TeamMembership(user_id=current.id, team_id=team.id, role="owner")
    db.add(membership)
    db.commit()
    return {"id": team.id, "name": team.name, "description": team.description}


@router.post("/api/teams/{team_id}/members")
def add_team_member(team_id: int, data: TeamAddMember,
                    authorization: str = "", db: Session = Depends(get_db)):
    token = _extract_token(authorization)
    current = get_current_user(token, db)
    if current.role != "admin":
        raise HTTPException(403, "Admin only")
    existing = db.query(TeamMembership).filter(
        TeamMembership.team_id == team_id,
        TeamMembership.user_id == data.user_id,
    ).first()
    if existing:
        raise HTTPException(400, "User already in team")
    membership = TeamMembership(
        user_id=data.user_id, team_id=team_id, role=data.role)
    db.add(membership)
    db.commit()
    return {"ok": True}


@router.delete("/api/teams/{team_id}/members/{user_id}")
def remove_team_member(team_id: int, user_id: int,
                       authorization: str = "",
                       db: Session = Depends(get_db)):
    token = _extract_token(authorization)
    current = get_current_user(token, db)
    if current.role != "admin":
        raise HTTPException(403, "Admin only")
    db.query(TeamMembership).filter(
        TeamMembership.team_id == team_id,
        TeamMembership.user_id == user_id,
    ).delete()
    db.commit()
    return {"ok": True}
