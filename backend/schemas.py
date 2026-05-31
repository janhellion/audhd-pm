from pydantic import BaseModel
from typing import Optional, List, TYPE_CHECKING
from datetime import datetime

if TYPE_CHECKING:
    from backend.models import Task


class TaskBase(BaseModel):
    title: str
    description: str = ""
    energy_level: str = "medium"
    priority: int = 0
    interest_level: int = 0
    micro_step: str = ""
    is_banana: bool = False
    project_id: Optional[int] = None
    parent_id: Optional[int] = None
    position: float = 0.0


class TaskCreate(TaskBase):
    pass


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    energy_level: Optional[str] = None
    priority: Optional[int] = None
    interest_level: Optional[int] = None
    micro_step: Optional[str] = None
    is_banana: Optional[bool] = None
    project_id: Optional[int] = None
    parent_id: Optional[int] = None
    position: Optional[float] = None
    deferred_until: Optional[datetime] = None
    metadata_json: Optional[dict] = None


class TaskResponse(TaskBase):
    id: int
    status: str
    completed_at: Optional[datetime] = None
    deferred_until: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    subtasks: List["TaskResponse"] = []
    metadata_json: dict = {}

    model_config = {"from_attributes": True}


def task_to_response(task: "Task") -> TaskResponse:
    """Convert a Task ORM object to a TaskResponse, handling None subtasks."""
    data = {
        "id": task.id,
        "title": task.title,
        "description": task.description or "",
        "status": task.status,
        "energy_level": task.energy_level or "medium",
        "priority": task.priority or 0,
        "interest_level": task.interest_level or 0,
        "micro_step": task.micro_step or "",
        "is_banana": task.is_banana or False,
        "project_id": task.project_id,
        "parent_id": task.parent_id,
        "position": task.position or 0.0,
        "completed_at": task.completed_at,
        "deferred_until": task.deferred_until,
        "created_at": task.created_at,
        "updated_at": task.updated_at,
        "subtasks": [task_to_response(st) for st in (task.subtasks or [])],
        "metadata_json": task.metadata_json or {},
    }
    return TaskResponse(**data)


class ProjectBase(BaseModel):
    name: str
    description: str = ""
    color: str = "#eb5e28"
    stability_slider: int = 70
    position: float = 0.0
    icon: str = "folder"


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None
    stability_slider: Optional[int] = None
    position: Optional[float] = None
    icon: Optional[str] = None


class ProjectResponse(ProjectBase):
    id: int
    created_at: datetime
    updated_at: datetime
    tasks: List[TaskResponse] = []

    model_config = {"from_attributes": True}


class TagBase(BaseModel):
    name: str
    color: str = "#888888"


class TagResponse(TagBase):
    id: int


class EnergyLogCreate(BaseModel):
    task_id: Optional[int] = None
    level: str
    note: str = ""


class SettingUpdate(BaseModel):
    value: str


class DashboardResponse(BaseModel):
    banana: Optional[TaskResponse] = None
    today_tasks: List[TaskResponse] = []
    active_projects: List[ProjectResponse] = []
    recent_completions: List[TaskResponse] = []
    deferral_rate: float = 0.0
    energy_state: str = "medium"
