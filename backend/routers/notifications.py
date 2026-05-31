from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
import httpx

from backend.database import get_db
from backend.models import Notification, User

router = APIRouter(tags=["notifications"])

# Matrix config — uses mimir bot
MATRIX_HOMESERVER = "https://matrix.janhellion.com"
MATRIX_ACCESS_TOKEN = None  # loaded from setting
MIMIR_USER = "@mimir:janhellion.com"
TARGET_ROOM = "!NFfnudwpucKUKNPxZq:janhellion.com"  # janhellion DM room


async def get_matrix_token(db: Session) -> str:
    """Get Matrix access token from settings or use stored one."""
    from backend.models import Setting
    setting = db.query(Setting).filter(Setting.key == "matrix_access_token").first()
    if setting:
        return setting.value
    return ""


def set_matrix_token(db: Session, token: str):
    from backend.models import Setting
    setting = db.query(Setting).filter(
        Setting.key == "matrix_access_token").first()
    if setting:
        setting.value = token
    else:
        db.add(Setting(key="matrix_access_token", value=token))
    db.commit()


async def send_matrix_message(message: str, db: Session) -> bool:
    """Send a message via Matrix using mimir bot credentials."""
    token = await get_matrix_token(db)
    if not token:
        return False
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            # Send message to DM room
            txn_id = f"pm-{datetime.utcnow().timestamp()}"
            r = await client.put(
                f"{MATRIX_HOMESERVER}/_matrix/client/v3/rooms/"
                f"{TARGET_ROOM}/send/m.room.message/{txn_id}",
                json={
                    "msgtype": "m.text",
                    "body": message,
                },
                headers={"Authorization": f"Bearer {token}"},
            )
            return r.status_code == 200
    except Exception:
        return False


# ── Schemas ────────────────────────────────────────────────────────────
class NotificationCreate(BaseModel):
    channel: str = "matrix"
    title: str = ""
    message: str = ""
    trigger_event: str = ""
    related_task_id: Optional[int] = None
    user_id: Optional[int] = None


class MatrixConfig(BaseModel):
    access_token: str


# ── Endpoints ──────────────────────────────────────────────────────────
@router.get("/api/notifications")
def list_notifications(user_id: Optional[int] = None,
                       limit: int = 20,
                       db: Session = Depends(get_db)):
    q = db.query(Notification).order_by(Notification.created_at.desc())
    if user_id:
        q = q.filter(Notification.user_id == user_id)
    return q.limit(limit).all()


@router.post("/api/notifications")
async def create_notification(data: NotificationCreate,
                              db: Session = Depends(get_db)):
    """Create a notification and send it via the configured channel."""
    notif = Notification(**data.model_dump())
    db.add(notif)
    db.commit()
    db.refresh(notif)

    # Send via channel
    sent = False
    if data.channel == "matrix":
        msg_parts = []
        if data.title:
            msg_parts.append(f"*{data.title}*")
        if data.message:
            msg_parts.append(data.message)
        full_msg = "\n\n".join(msg_parts)
        sent = await send_matrix_message(full_msg, db)

    notif.sent = sent
    notif.sent_at = datetime.utcnow() if sent else None
    db.commit()
    return {"id": notif.id, "sent": sent}


@router.post("/api/notifications/matrix-config")
def configure_matrix(data: MatrixConfig, db: Session = Depends(get_db)):
    """Store Matrix access token for sending notifications."""
    set_matrix_token(db, data.access_token)
    return {"ok": True}


@router.get("/api/notifications/matrix-status")
async def matrix_status(db: Session = Depends(get_db)):
    """Check if Matrix is configured and working."""
    token = await get_matrix_token(db)
    if not token:
        return {"configured": False, "message": "No Matrix token configured"}
    # Test by sending a message
    sent = await send_matrix_message(
        "🔔 pm notification test — Matrix is connected.", db)
    return {"configured": True, "working": sent}
