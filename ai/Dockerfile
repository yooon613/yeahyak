FROM python:3.11-slim

WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends curl \
 && rm -rf /var/lib/apt/lists/*

# 소스 복사 (requirements.txt 포함)
COPY ai/ /app/

# 패키지 설치 + gunicorn 보강 설치
RUN pip install --no-cache-dir -r requirements.txt \
 && pip install --no-cache-dir gunicorn

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD curl -fsS http://127.0.0.1:8080/health || exit 1
CMD ["gunicorn","-b","0.0.0.0:8080","gateway:app"]
