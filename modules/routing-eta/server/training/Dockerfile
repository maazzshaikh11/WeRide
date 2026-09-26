# ETA sidecar (LightGBM inference) — prod image.
# Build:  docker build -t weride-eta-sidecar ./server/training
# Run:    docker run -p 5000:5000 -v $(pwd)/models:/app/models weride-eta-sidecar
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY sidecar.py .

# Trained model is mounted at runtime (never baked into the image).
ENV MODEL_PATH=/app/models/eta_model.txt
ENV PORT=5000

EXPOSE 5000

CMD ["python", "sidecar.py"]
