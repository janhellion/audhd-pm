from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import Task, Project, EnergyLog
from backend.schemas import TaskCreate, TaskUpdate, TaskResponse, task_to_response

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


@router.get("", response_model=list[TaskResponse])
def list_tasks(
    status: str = None,
    project_id: int = None,
    db: Session = Depends(get_db),
):
    q = db.query(Task).filter(Task.parent_id.is_(None))
    if status:
        q = q.filter(Task.status == status)
    if project_id is not None:
        q = q.filter(Task.project_id == project_id)
    return [task_to_response(t) for t in q.order_by(Task.position).all()]


@router.post("", response_model=TaskResponse, status_code=201)
def create_task(data: TaskCreate, db: Session = Depends(get_db)):
    task = Task(**data.model_dump())
    max_pos = db.query(Task.position).filter(
        Task.project_id == data.project_id
    ).order_by(Task.position.desc()).first()
    task.position = (max_pos[0] or 0) + 1.0 if max_pos and max_pos[0] else 1.0
    db.add(task)
    db.commit()
    db.refresh(task)
    return task_to_response(task)


@router.get("/{task_id}", response_model=TaskResponse)
def get_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(404, "Task not found")
    return task_to_response(task)


@router.put("/{task_id}", response_model=TaskResponse)
def update_task(task_id: int, data: TaskUpdate, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(404, "Task not found")
    for key, val in data.model_dump(exclude_unset=True).items():
        setattr(task, key, val)
    task.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(task)
    return task_to_response(task)


@router.delete("/{task_id}")
def delete_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(404, "Task not found")
    task.status = "archived"
    task.updated_at = datetime.utcnow()
    db.commit()
    return {"ok": True}


@router.post("/{task_id}/complete", response_model=TaskResponse)
def complete_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(404, "Task not found")
    task.status = "completed"
    task.completed_at = datetime.utcnow()
    task.is_banana = False
    task.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(task)
    return task_to_response(task)


@router.post("/{task_id}/initiate", response_model=TaskResponse)
def initiate_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(404, "Task not found")
    log = EnergyLog(task_id=task_id, level=task.energy_level or "medium", note="initiated")
    db.add(log)
    db.commit()
    return task_to_response(task)


@router.post("/{task_id}/defer", response_model=TaskResponse)
def defer_task(
    task_id: int,
    until_days: int = 1,
    db: Session = Depends(get_db),
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(404, "Task not found")
    task.deferred_until = datetime.utcnow() + timedelta(days=until_days)
    task.status = "deferred"
    task.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(task)
    return task_to_response(task)


@router.post("/{task_id}/reactivate", response_model=TaskResponse)
def reactivate_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(404, "Task not found")
    task.status = "active"
    task.deferred_until = None
    task.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(task)
    return task_to_response(task)
