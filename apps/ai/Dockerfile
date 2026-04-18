FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PIP_NO_CACHE_DIR=1
ARG PRELOAD_MODELS=0
ARG SPACY_MODEL_WHL_URL="https://github.com/explosion/spacy-models/releases/download/en_core_web_sm-3.8.0/en_core_web_sm-3.8.0-py3-none-any.whl"

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        libgomp1 \
        default-jre-headless \
    && rm -rf /var/lib/apt/lists/*

COPY apps/ai/requirements.txt /tmp/requirements.txt

RUN pip install --upgrade pip \
    && pip install -r /tmp/requirements.txt \
    && pip install "${SPACY_MODEL_WHL_URL}"

# Optional warmup/download step. Disabled by default because some build environments
# block github/raw host resolution used by spaCy/NLTK/HF model downloads.
RUN if [ "$PRELOAD_MODELS" = "1" ]; then \
      python -m spacy download en_core_web_sm && \
      python -c "import nltk; nltk.download('averaged_perceptron_tagger_eng', quiet=True)" && \
      python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')"; \
    else \
      echo "Skipping optional model preload (PRELOAD_MODELS=$PRELOAD_MODELS)"; \
    fi

COPY apps/ai ./apps/ai
COPY models ./models

WORKDIR /app/apps/ai

EXPOSE 8001

CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8001"]
