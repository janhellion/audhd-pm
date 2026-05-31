import os
import hashlib
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
os.makedirs(DATA_DIR, exist_ok=True)

DATABASE_URL = os.environ.get("DATABASE_URL", f"sqlite:///{os.path.join(DATA_DIR, 'audhd_pm.db')}")

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    import backend.models  # noqa: F401
    Base.metadata.create_all(bind=engine)

    # Seed admin user
    db = SessionLocal()
    try:
        existing = db.query(backend.models.User).filter(
            backend.models.User.username == "janhellion"
        ).first()
        if not existing:
            admin = backend.models.User(
                username="janhellion",
                password_hash=hashlib.sha256(b"Pol1graf1K").hexdigest(),
                display_name="Jan Hellion",
                role="admin",
            )
            db.add(admin)
            db.commit()
            print("Admin user seeded: janhellion")
    finally:
        db.close()
