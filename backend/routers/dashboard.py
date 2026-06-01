from datetime import datetime, timedelta, date
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from backend.database import get_db
from backend.models import Task, Project, EnergyLog
from backend.schemas import TaskResponse, DashboardResponse, task_to_response

router = APIRouter(tags=["dashboard"])


@router.get("/api/dashboard")
def get_dashboard(db: Session = Depends(get_db)):
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

    # Auto-resurface deferred tasks whose time has come
    db.query(Task).filter(
        Task.status == "deferred",
        Task.deferred_until.isnot(None),
        Task.deferred_until <= datetime.utcnow(),
    ).update({"status": "active", "deferred_until": None})
    db.commit()

    # Banana task
    banana_q = db.query(Task).filter(
        Task.is_banana == True,
        Task.status == "active",
        Task.completed_at.is_(None),
    ).first()

    # All active tasks sorted by priority desc
    active_tasks = db.query(Task).filter(
        Task.status == "active",
        Task.completed_at.is_(None),
    ).order_by(Task.priority.desc(), Task.position).all()

    # Energy insights — last 7 days
    week_ago = today - timedelta(days=7)
    energy_logs = db.query(EnergyLog).filter(
        EnergyLog.timestamp >= week_ago
    ).order_by(EnergyLog.timestamp.desc()).all()

    energy_counts = {"low": 0, "medium": 0, "high": 0}
    for log in energy_logs:
        if log.level in energy_counts:
            energy_counts[log.level] += 1

    # Tasks completed this week for sparkline
    completed_this_week = db.query(func.date(Task.completed_at), func.count(Task.id)).filter(
        Task.completed_at >= week_ago,
        Task.status == "completed",
    ).group_by(func.date(Task.completed_at)).all()

    week_dates = [(today - timedelta(days=i)).strftime("%a") for i in range(6, -1, -1)]
    completion_counts = {row[0]: row[1] for row in completed_this_week}
    sparkline = []
    for d in week_dates:
        day_start = today - timedelta(days=6 - week_dates.index(d))
        key = day_start.strftime("%Y-%m-%d")
        sparkline.append(completion_counts.get(key, 0))

    # Recent completions
    recent = db.query(Task).filter(
        Task.completed_at >= today - timedelta(days=1),
        Task.status == "completed",
    ).order_by(Task.completed_at.desc()).limit(5).all()

    # Deferral rate
    deferred_count = db.query(func.count(Task.id)).filter(
        Task.status == "deferred",
    ).scalar() or 0
    active_count = db.query(func.count(Task.id)).filter(
        Task.status == "active",
    ).scalar() or 1
    deferral_rate = min(1.0, deferred_count / max(1, active_count + deferred_count))

    # Current energy
    last_energy = db.query(EnergyLog).order_by(EnergyLog.timestamp.desc()).first()
    energy_state = last_energy.level if last_energy else "medium"

    banana = task_to_response(banana_q) if banana_q else None
    today_tasks = [task_to_response(t) for t in active_tasks]
    recent_tasks = [task_to_response(t) for t in recent]

    return {
        "banana": banana,
        "today_tasks": today_tasks,
        "recent_completions": recent_tasks,
        "deferral_rate": deferral_rate,
        "energy_state": energy_state,
        "energy_insights": {
            "week_totals": energy_counts,
            "sparkline": sparkline,
            "days": week_dates,
        },
        "stats": {
            "total_active": active_count,
            "total_deferred": deferred_count,
            "completed_today": sum(1 for t in recent if t.completed_at and t.completed_at >= today),
        },
    }


@router.get("/api/tasks/search")
def search_tasks(q: str = "", energy: str = "", priority_min: int = 0,
                 status: str = "active", db: Session = Depends(get_db)):
    query = db.query(Task).filter(Task.status == status)
    if q:
        query = query.filter(Task.title.ilike(f"%{q}%"))
    if energy:
        query = query.filter(Task.energy_level == energy)
    if priority_min > 0:
        query = query.filter(Task.priority >= priority_min)
    tasks = query.order_by(Task.priority.desc(), Task.position).limit(50).all()
    return [task_to_response(t) for t in tasks]


@router.get("/api/calendar")
def get_calendar(year: int = 0, month: int = 0, db: Session = Depends(get_db)):
    """Get tasks grouped by date for calendar view."""
    now = datetime.utcnow()
    y = year or now.year
    m = month or now.month

    month_start = datetime(y, m, 1)
    if m == 12:
        month_end = datetime(y + 1, 1, 1)
    else:
        month_end = datetime(y, m + 1, 1)

    tasks = db.query(Task).filter(
        Task.created_at < month_end,
        Task.status.in_(["active", "completed"]),
    ).all()

    # Group by due_date or completed_at date
    by_date = {}
    for t in tasks:
        d = None
        if t.due_date:
            d = t.due_date.strftime("%Y-%m-%d")
        elif t.completed_at:
            d = t.completed_at.strftime("%Y-%m-%d")
        else:
            d = t.created_at.strftime("%Y-%m-%d")
        if d not in by_date:
            by_date[d] = []
        by_date[d].append(task_to_response(t))

    return {
        "year": y,
        "month": m,
        "days": {k: [{"id": t.id, "title": t.title, "status": t.status,
                      "energy_level": t.energy_level, "is_banana": t.is_banana}
                     for t in v] for k, v in by_date.items()},
    }
