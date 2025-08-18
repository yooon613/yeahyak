FROM python:3.11-slim

WORKDIR /app

# healthcheck용 curl
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

# 의존성
COPY requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# 소스 복사 (컨텍스트가 ai/ 이므로 점(.)이 ai/를 의미)
COPY . /app/

EXPOSE 8080
ENV PYTHONUNBUFFERED=1

# 헬스체크
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD curl -fsS http://127.0.0.1:8080/health || exit 1

# 실행
CMD ["gunicorn", "-w", "2", "-b", "0.0.0.0:8080", "gateway:app", "--timeout", "120"]
