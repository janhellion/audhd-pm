from datetime import datetime
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import Setting, EnergyLog
from backend.schemas import SettingUpdate, EnergyLogCreate

router = APIRouter(tags=["settings"])


@router.get("/api/settings")
def get_settings(db: Session = Depends(get_db)):
    settings = db.query(Setting).all()
    return {s.key: s.value for s in settings}


@router.put("/api/settings/{key}")
def update_setting(key: str, data: SettingUpdate, db: Session = Depends(get_db)):
    setting = db.query(Setting).filter(Setting.key == key).first()
    if not setting:
        setting = Setting(key=key, value=data.value)
        db.add(setting)
    else:
        setting.value = data.value
    db.commit()
    return {key: data.value}


@router.post("/api/energy-log")
def log_energy(data: EnergyLogCreate, db: Session = Depends(get_db)):
    log = EnergyLog(**data.model_dump(), timestamp=datetime.utcnow())
    db.add(log)
    db.commit()
    return {"ok": True}
