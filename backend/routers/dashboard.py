from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional
from backend.database import get_db
from backend.models import Task, Project, EnergyLog, Setting
from backend.schemas import (
    TaskCreate, TaskUpdate, TaskResponse,
    ProjectResponse, DashboardResponse, task_to_response,
)

router = APIRouter(tags=["dashboard"])


@router.get("/api/dashboard", response_model=DashboardResponse)
def get_dashboard(db: Session = Depends(get_db)):
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    tomorrow = today + timedelta(days=1)

    # Banana task
    banana_q = db.query(Task).filter(
        Task.is_banana == True,
        Task.status == "active",
        Task.completed_at.is_(None),
    ).first()

    # Today's active tasks
    today_tasks_q = db.query(Task).filter(
        Task.status == "active",
        Task.completed_at.is_(None),
    ).order_by(Task.position).all()

    # Recent completions (last 24h)
    recent = db.query(Task).filter(
        Task.completed_at >= today,
        Task.status == "completed",
    ).order_by(Task.completed_at.desc()).limit(5).all()

    # Deferral rate
    week_ago = today - timedelta(days=7)
    deferred_count = db.query(func.count(Task.id)).filter(
        Task.deferred_until.isnot(None),
        Task.updated_at >= week_ago,
    ).scalar() or 0
    active_count = db.query(func.count(Task.id)).filter(
        Task.status == "active",
    ).scalar() or 1
    deferral_rate = min(1.0, deferred_count / max(1, active_count))

    # Energy state
    last_energy = db.query(EnergyLog).order_by(EnergyLog.timestamp.desc()).first()
    energy_state = last_energy.level if last_energy else "medium"

    # Convert to responses using helper
    banana = task_to_response(banana_q) if banana_q else None
    today_tasks = [task_to_response(t) for t in today_tasks_q]
    recent_tasks = [task_to_response(t) for t in recent]

    return DashboardResponse(
        banana=banana,
        today_tasks=today_tasks,
        active_projects=[],  # projects loaded separately if needed
        recent_completions=recent_tasks,
        deferral_rate=deferral_rate,
        energy_state=energy_state,
    )
