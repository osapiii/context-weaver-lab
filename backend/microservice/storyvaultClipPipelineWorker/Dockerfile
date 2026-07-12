FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY main.py .
COPY completion_email.py .
CMD exec uvicorn main:app --host 0.0.0.0 --port ${PORT:-8080}
