# ai/Dockerfile
FROM python:3.11-slim

WORKDIR /app

# 시스템 패키지: curl (healthcheck용)
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

# 의존성
COPY ai/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# 소스 복사
COPY ai/ /app/

# Flask 앱은 gateway:app, 포트 8080으로 서비스
EXPOSE 8080
ENV PYTHONUNBUFFERED=1

# ✅ HEALTHCHECK: heredoc 대신 curl 사용
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD curl -fsS http://127.0.0.1:8080/health || exit 1

# 프로덕션 WSGI 서버 실행
CMD ["gunicorn", "-w", "2", "-b", "0.0.0.0:8080", "gateway:app", "--timeout", "120"]
