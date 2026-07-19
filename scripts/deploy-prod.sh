#!/bin/bash
# Sovereign Agent - Production Deployment

# This script deploys to a production environment.
# Requires: Docker, docker-compose, and environment variables.

set -e

REGISTRY="${REGISTRY:-docker.io}"
REPO="${REPO:-myorg/sovereign-agent}"
VERSION="${VERSION:-latest}"
ENVIRONMENT="${ENVIRONMENT:-production}"

echo "=== Sovereign Agent Production Deployment ==="
echo "Registry:   $REGISTRY"
echo "Repository: $REPO"
echo "Version:    $VERSION"
echo "Environment: $ENVIRONMENT"
echo ""

# 1. Build Docker image with caching
echo "Step 1: Building Docker image..."
docker buildx build \
  --cache-from=type=registry,ref=$REGISTRY/$REPO:buildcache \
  --cache-to=type=registry,ref=$REGISTRY/$REPO:buildcache,mode=max \
  --output type=image,push=true \
  -t $REGISTRY/$REPO:$VERSION \
  -t $REGISTRY/$REPO:latest \
  .

echo "✓ Image built and pushed: $REGISTRY/$REPO:$VERSION"
echo ""

# 2. Deploy or update services
echo "Step 2: Deploying services..."

# For single-host production (Docker Swarm or Compose)
export DOCKER_REGISTRY=$REGISTRY
export DOCKER_REPO=$REPO
export DOCKER_VERSION=$VERSION

docker compose -f docker-compose.yml \
  -f docker-compose.prod.yml \
  up -d --pull always --wait

echo "✓ Services deployed"
echo ""

# 3. Run migrations
echo "Step 3: Running database migrations..."
docker compose exec -T agent npm run db:migrate
echo "✓ Migrations complete"
echo ""

# 4. Health check
echo "Step 4: Verifying deployment..."
RETRIES=0
MAX_RETRIES=30
until curl -sf http://localhost:8080/health > /dev/null || [ $RETRIES -eq $MAX_RETRIES ]; do
  echo "Waiting for service to be healthy... ($RETRIES/$MAX_RETRIES)"
  sleep 2
  RETRIES=$((RETRIES + 1))
done

if [ $RETRIES -lt $MAX_RETRIES ]; then
  echo "✓ Services healthy"
else
  echo "✗ Services failed to become healthy"
  docker compose logs agent
  exit 1
fi

echo ""
echo "=== Deployment Complete ==="
echo ""
echo "Access the application:"
echo "  • API:            http://localhost:8080"
echo "  • Health:         http://localhost:8080/health"
echo "  • Swagger docs:   http://localhost:8080/documentation"
echo ""
echo "Monitor logs:"
echo "  • Agent logs:     docker compose logs -f agent"
echo "  • Database logs:  docker compose logs -f postgres"
echo "  • All logs:       docker compose logs -f"
echo ""
