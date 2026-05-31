from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import Project, Task
from backend.schemas import ProjectCreate, ProjectUpdate, ProjectResponse, TaskResponse

router = APIRouter(prefix="/api/projects", tags=["projects"])


@router.get("", response_model=list[ProjectResponse])
def list_projects(db: Session = Depends(get_db)):
    projects = db.query(Project).order_by(Project.position).all()
    return projects


@router.post("", response_model=ProjectResponse, status_code=201)
def create_project(data: ProjectCreate, db: Session = Depends(get_db)):
    proj = Project(**data.model_dump())
    max_pos = db.query(Project.position).order_by(Project.position.desc()).first()
    proj.position = (max_pos[0] or 0) + 1.0 if max_pos and max_pos[0] else 1.0
    db.add(proj)
    db.commit()
    db.refresh(proj)
    return proj


@router.get("/{project_id}", response_model=ProjectResponse)
def get_project(project_id: int, db: Session = Depends(get_db)):
    proj = db.query(Project).filter(Project.id == project_id).first()
    if not proj:
        raise HTTPException(404, "Project not found")
    return proj


@router.put("/{project_id}", response_model=ProjectResponse)
def update_project(project_id: int, data: ProjectUpdate, db: Session = Depends(get_db)):
    proj = db.query(Project).filter(Project.id == project_id).first()
    if not proj:
        raise HTTPException(404, "Project not found")
    for key, val in data.model_dump(exclude_unset=True).items():
        setattr(proj, key, val)
    proj.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(proj)
    return proj


@router.delete("/{project_id}")
def delete_project(project_id: int, db: Session = Depends(get_db)):
    proj = db.query(Project).filter(Project.id == project_id).first()
    if not proj:
        raise HTTPException(404, "Project not found")
    # Unlink tasks
    db.query(Task).filter(Task.project_id == project_id).update(
        {"project_id": None}
    )
    db.delete(proj)
    db.commit()
    return {"ok": True}
