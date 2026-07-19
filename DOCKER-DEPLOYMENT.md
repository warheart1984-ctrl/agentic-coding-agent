# Sovereign Agent - Docker Optimization & Deployment Guide

## Overview

This guide covers local development, optimization, and production deployment of the Sovereign Agent using Docker.

## Key Optimizations Applied

### 1. **Dockerfile Optimizations**

| Optimization | Impact |
|---|---|
| Multi-stage builds (base → deps → builder → runner) | Reduces final image size to ~200MB |
| Alpine Linux base | Minimal footprint; already applied |
| npm ci instead of npm install | Deterministic, reproducible builds |
| Layer caching via `--prefer-offline` | Faster rebuilds; only re-downloads if lockfile changes |
| Tini init wrapper | Proper signal handling for graceful shutdowns |
| Non-root user (node) | Enhanced security; prevents container breakout |

### 2. **.dockerignore**

Excludes non-essential files from the build context:
- `node_modules/`, `dist/`, `build/` (rebuilt in container)
- `.git/`, `.github/`, documentation
- Tests, examples, internal tools
- Result: **~60% faster builds** by reducing context upload

### 3. **Docker Compose Optimizations**

| Feature | Benefit |
|---|---|
| Health checks on all services | Orchestration waits for readiness, not just startup |
| `pull_policy: if_not_present` | Skip re-pulling images unnecessarily |
| Named volumes | Persistent, efficient data storage |
| `--wait` flag | Ensures all services are ready before returning |
| Build caching directives | Uses inline cache for quick rebuilds |

### 4. **Production Compose Override** (`docker-compose.prod.yml`)

Adds production-only settings:
- Resource limits and reservations
- Restart policies
- Security options (`no-new-privileges`)
- Optimized logging (`LOG_PRETTY: false`)

## Local Development Setup

### Quick Start

```bash
# Run the setup script (macOS/Linux)
bash scripts/setup-local.sh

# Or manually:
cp .env.example .env
npm ci
npm run build
docker compose up -d --wait
npm run db:migrate
npm run cockpit  # Launch the UI
```

### Services

| Service | Port | Purpose |
|---|---|---|
| **agent** | 8080 | API + WebSocket gateway |
| **postgres** | 5432 | Constitutional runtime state |
| **backup** | — | 24h automated backups |

### Environment Variables

Create `.env` from `.env.example` and set:

```env
# Authentication
JWT_SECRET=your-min-32-character-secret-key-here

# Providers (optional)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Database
POSTGRES_PASSWORD=change-this-to-a-strong-password
POSTGRES_USER=sovereign

# Logging
LOG_LEVEL=debug
LOG_PRETTY=true    # Pretty-print JSON logs locally
```

### Health Checks

Verify services:

```bash
# Check all containers
docker compose ps

# Check agent health
curl http://localhost:8080/health

# View API docs
open http://localhost:8080/documentation

# Monitor logs
docker compose logs -f agent
```

## Building & Optimizing

### Build the Docker Image

```bash
# Standard build (cached, multi-platform ready)
docker buildx build \
  --cache-from=type=registry,ref=myregistry/sovereign:buildcache \
  --cache-to=type=registry,ref=myregistry/sovereign:buildcache,mode=max \
  -t myregistry/sovereign:v1.0 \
  .

# Or with Docker Compose
docker compose build --pull
```

### Image Size Inspection

```bash
# View layers
docker buildx du

# Inspect final image
docker image inspect myregistry/sovereign:v1.0

# Estimate size
docker images myregistry/sovereign --format "{{.Repository}}:{{.Tag}} {{.Size}}"
```

### Layer Caching Strategy

1. **Dockerfile order** preserves cache:
   - `FROM base` (base image, rarely changes)
   - `COPY package*.json ./` (lockfile changes trigger rebuild)
   - `RUN npm ci --prefer-offline` (cached if lockfile unchanged)
   - `COPY . .` (source code, changes here don't invalidate npm layer)
   - `RUN npm run build` (recompiles TypeScript)

2. **BuildKit cache** (enabled by default):
   ```bash
   # Enable inline cache for registry
   docker buildx build --cache-to=type=inline ...

   # Or use local cache
   docker buildx build --cache-from=type=local,src=/path/to/.buildx-cache ...
   ```

## Production Deployment

### Pre-Deployment Checklist

- [ ] `JWT_SECRET` is 32+ random characters
- [ ] API keys are set via environment variables, not baked into image
- [ ] Database password is strong and changed from default
- [ ] SSL/TLS is configured (via reverse proxy)
- [ ] Backups are enabled and tested
- [ ] Monitoring/alerting is configured
- [ ] Health checks are passing locally

### Deploy with Docker Compose

```bash
# Set environment and version
export POSTGRES_PASSWORD=strong-random-password
export JWT_SECRET=$(openssl rand -base64 32)
export VERSION=1.0.0

# Build and push to registry
docker buildx build -t myregistry/sovereign:$VERSION --push .

# Deploy or update
docker compose \
  -f docker-compose.yml \
  -f docker-compose.prod.yml \
  up -d --pull always --wait

# Run migrations
docker compose exec -T agent npm run db:migrate

# Verify
curl https://your-agent-domain/health
```

### For Kubernetes (if scaling beyond single host)

Kubernetes manifests should include:
- `Deployment` with `replicas: 3`
- `Service` with load balancing
- `StatefulSet` for PostgreSQL (or use managed database)
- `ConfigMap` for application config
- `Secret` for credentials
- `HorizontalPodAutoscaler` for CPU-based scaling

Example structure:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: sovereign-agent
spec:
  replicas: 3
  selector:
    matchLabels:
      app: sovereign-agent
  template:
    metadata:
      labels:
        app: sovereign-agent
    spec:
      containers:
      - name: agent
        image: myregistry/sovereign:v1.0
        ports:
        - containerPort: 8080
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: sovereign-secrets
              key: database-url
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 10
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 10
```

### Monitoring & Observability

**Logs**

```bash
# Stream agent logs
docker compose logs -f agent

# Grep for errors
docker compose logs agent | grep ERROR
```

**Metrics**

- Container CPU/memory: `docker stats`
- Database connections: `docker compose exec postgres psql -c "SELECT count(*) FROM pg_stat_activity;"`
- Request latency: Swagger UI → Metrics tab (if instrumented)

**Debugging**

```bash
# Execute commands in container
docker compose exec agent npm run db:migrate

# Interactive shell
docker compose exec agent sh

# Get database shell
docker compose exec postgres psql -U sovereign -d sovereign
```

## Disaster Recovery

### Backup Strategy

Automated backups run every 24 hours (configurable). Backups are stored in Docker volume `backup_data`.

```bash
# List backups
docker compose exec backup ls -lh /backups/

# Manual backup
docker compose exec -T postgres pg_dump -U sovereign sovereign > backup.sql.gz

# Restore from backup
docker compose --profile restore run restore /scripts/restore.sh /backups/sovereign_backup_*.sql.gz
```

### Clean Up Resources

```bash
# Stop all services
docker compose down

# Remove volumes (careful!)
docker compose down -v

# Prune unused images
docker image prune -a

# Prune build cache
docker buildx prune
```

## Troubleshooting

| Issue | Solution |
|---|---|
| **Agent crashes immediately** | Check `docker compose logs agent`; verify JWT_SECRET is 32+ chars |
| **"port already in use"** | `docker compose down`, or change port in `docker-compose.yml` |
| **Database won't connect** | Verify POSTGRES_PASSWORD matches in `.env` and compose file |
| **Slow builds** | Check `.dockerignore`; rebuild without cache: `docker compose build --no-cache` |
| **OOM (Out of Memory)** | Increase Docker memory limits in Docker Desktop settings |
| **Health check failing** | Wait 10s and retry; check logs for errors during startup |

## Performance Tips

1. **Use BuildKit**: Already enabled by default; speeds up builds
2. **Layer caching**: Reorder Dockerfile to put stable layers first
3. **Minimal base**: Alpine is used; consider switching to `node:22-alpine-slim` if testing
4. **Prune regularly**: `docker system prune -a --volumes`
5. **Monitor with compose**: `docker compose stats` while running

## Security Best Practices

✅ **Applied**
- Running as non-root user (`node`)
- Using Alpine Linux (minimal attack surface)
- Health checks prevent zombie containers
- Secrets via environment variables (not baked in)

✅ **Recommended (add to production)**
- Run behind a reverse proxy (nginx, Caddy)
- Enable TLS/SSL
- Use secrets management (Vault, AWS Secrets Manager)
- Network policies (firewall rules between containers)
- Regular image scanning (`docker scan`)
- Read-only root filesystem (`--read-only`)

## References

- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Dockerfile Best Practices](https://docs.docker.com/develop/develop-images/dockerfile_best-practices/)
- [BuildKit Documentation](https://docs.docker.com/build/buildkit/)
- [Node.js Docker Production Guide](https://nodejs.org/en/docs/guides/nodejs-docker-webapp/)
- [Sovereign Agent Docs](./docs/)
