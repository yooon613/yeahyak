# ai/Dockerfile
FROM python:3.11-slim

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

# 1) 의존성 설치
COPY ai/requirements.txt /tmp/requirements.txt
RUN apt-get update && apt-get install -y --no-install-recommends build-essential \
 && pip install -r /tmp/requirements.txt \
 && apt-get purge -y build-essential && apt-get autoremove -y \
 && rm -rf /var/lib/apt/lists/*

# 2) 소스 복사
COPY ai /app

# 3) 컨테이너 내부 포트 (Gunicorn 8080)
EXPOSE 8080

# 4) 헬스체크 (gateway.py의 /health 사용)
HEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD python - <<'PY' || exit 1
import urllib.request, sys
try:
    with urllib.request.urlopen("http://127.0.0.1:8080/health", timeout=2) as r:
        sys.exit(0 if r.status==200 else 1)
except Exception:
    sys.exit(1)
PY

# 5) 서버 기동 (Flask 앱은 gateway.py의 app 객체)
CMD ["gunicorn", "-k", "uvicorn.workers.UvicornWorker", "gateway:app", "-b", "0.0.0.0:8080", "--timeout", "120"]
