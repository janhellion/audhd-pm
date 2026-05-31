FROM python:3.12-slim

WORKDIR /app

# Install dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt uvicorn

# Copy application
COPY backend/ /app/backend/
COPY frontend/ /app/frontend/

# Create data directory
RUN mkdir -p /app/data

EXPOSE 8000

CMD ["python3", "-m", "uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
