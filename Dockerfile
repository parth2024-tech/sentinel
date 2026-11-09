# Sentinel - System Diagnostics & Telemetry Runtime
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

LABEL org.opencontainers.image.title="Sentinel"
LABEL org.opencontainers.image.description="Industrial System Diagnostics & Posture Engine"
LABEL org.opencontainers.image.source="https://github.com/parth2024-tech/sentinel"
LABEL org.opencontainers.image.licenses="MIT"

COPY package.json ./

CMD ["node", "-e", "console.log('Sentinel Diagnostics Runtime Active')"]
