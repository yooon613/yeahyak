# 파이썬 3.11-slim 이미지를 기반으로 사용
FROM python:3.11-slim

# 작업 디렉토리를 /app으로 설정
WORKDIR /app

# 시스템 패키지 설치
# libgomp1은 lightgbm 사용을 위해 필수
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    libgomp1 \
 && rm -rf /var/lib/apt/lists/*

# 파이썬 의존성 설치를 위해 requirements.txt 복사
COPY ai/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# 애플리케이션 소스 코드 복사
COPY ai/ /app/

# 컨테이너 포트 8080 노출
EXPOSE 8080
ENV PORT=8080

# Gunicorn을 사용하여 애플리케이션 실행
# --workers: 워커 프로세스 수, --timeout: 요청 타임아웃
CMD ["gunicorn", "-b", "0.0.0.0:8080", "gateway:app", "--workers", "1", "--timeout", "180"]
