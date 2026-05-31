from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, Float, Boolean, ForeignKey, JSON
from sqlalchemy.orm import relationship
from backend.database import Base


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(500), nullable=False)
    description = Column(Text, default="")
    status = Column(String(20), default="active")  # active, completed, deferred, archived
    energy_level = Column(String(10), default="medium")  # low, medium, high
    priority = Column(Integer, default=0)  # 0=unset, higher=more important
    interest_level = Column(Integer, default=0)  # 0=unset, higher=more interesting
    micro_step = Column(String(500), default="")  # the 2-minute opening action
    is_banana = Column(Boolean, default=False)  # the "one thing" for today
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)
    parent_id = Column(Integer, ForeignKey("tasks.id"), nullable=True)
    position = Column(Float, default=0.0)
    deferred_until = Column(DateTime, nullable=True)
    metadata_json = Column(JSON, default=dict)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    project = relationship("Project", back_populates="tasks")
    subtasks = relationship("Task", backref="parent", remote_side=[id],
                            foreign_keys=[parent_id])


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text, default="")
    color = Column(String(7), default="#eb5e28")  # paprika default
    stability_slider = Column(Integer, default=70)  # 0=surprise, 100=stability
    position = Column(Float, default=0.0)
    icon = Column(String(50), default="folder")

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    tasks = relationship("Task", back_populates="project", order_by="Task.position")


class Tag(Base):
    __tablename__ = "tags"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, nullable=False)
    color = Column(String(7), default="#888888")


class TaskTag(Base):
    __tablename__ = "task_tags"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id"))
    tag_id = Column(Integer, ForeignKey("tags.id"))


class EnergyLog(Base):
    __tablename__ = "energy_logs"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=True)
    level = Column(String(10))  # low, medium, high
    note = Column(String(500), default="")
    timestamp = Column(DateTime, default=datetime.utcnow)


class Setting(Base):
    __tablename__ = "settings"

    key = Column(String(100), primary_key=True)
    value = Column(Text, default="")
