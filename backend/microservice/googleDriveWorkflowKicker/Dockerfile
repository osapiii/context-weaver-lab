FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py workflow_input_inspect.py ./
COPY knowledge_storage_paths.py ./

EXPOSE 8080

ENV PORT=8080
ENV PYTHONPATH=/app
ENV SERVICE_NAME=googleDriveWorkflowKicker

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080", "--timeout-keep-alive", "60"]
