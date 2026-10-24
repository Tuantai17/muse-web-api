FROM python:3.12-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends chromium fonts-wqy-zenhei ca-certificates \
 && rm -rf /var/lib/apt/lists/*

RUN useradd --create-home --uid 1000 muse
WORKDIR /app

COPY pyproject.toml README.md ./
COPY src ./src
RUN pip install --no-cache-dir .

ENV MUSE2API_HOST=0.0.0.0 \
    MUSE2API_PORT=7860 \
    MUSE2API_DATA_DIR=/app/data \
    MUSE2API_ADMIN_KEY=muse123456 \
    MUSE2API_CHROMIUM_PATH=/usr/bin/chromium \
    MUSE2API_DRIVER=browser \
    CHROME_NO_SANDBOX=1

RUN mkdir -p /app/data && chown -R muse:muse /app
USER muse

EXPOSE 7860
CMD ["muse2api"]
