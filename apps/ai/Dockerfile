FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PIP_NO_CACHE_DIR=1

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
    && python -m spacy download en_core_web_sm \
    && python -c "import nltk; nltk.download('averaged_perceptron_tagger_eng', quiet=True)" \
    && python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')"

COPY apps/ai ./apps/ai
COPY models ./models

WORKDIR /app/apps/ai

EXPOSE 8001

CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8001"]
