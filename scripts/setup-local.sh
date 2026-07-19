#!/bin/bash
# Sovereign Agent - Local Development Setup

set -e

echo "=== Sovereign Agent Local Setup ==="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Check dependencies
echo "${YELLOW}Step 1: Checking dependencies...${NC}"
command -v docker &> /dev/null || { echo "Docker not found. Please install Docker Desktop."; exit 1; }
command -v node &> /dev/null || { echo "Node.js not found. Please install Node.js 20+."; exit 1; }
echo "${GREEN}✓ Docker and Node.js found${NC}"
echo ""

# 2. Create .env from example if it doesn't exist
echo "${YELLOW}Step 2: Setting up environment...${NC}"
if [ ! -f .env ]; then
    cp .env.example .env
    echo "${GREEN}✓ Created .env from .env.example${NC}"
    echo "${YELLOW}⚠ Review .env and set your API keys:${NC}"
    echo "  - JWT_SECRET (min 32 chars)"
    echo "  - OPENAI_API_KEY (optional)"
    echo "  - ANTHROPIC_API_KEY (optional)"
    echo "  - POSTGRES_PASSWORD (recommended: change from default)"
else
    echo "${GREEN}✓ .env already exists${NC}"
fi
echo ""

# 3. Install dependencies
echo "${YELLOW}Step 3: Installing Node dependencies...${NC}"
npm ci
echo "${GREEN}✓ Dependencies installed${NC}"
echo ""

# 4. Build TypeScript
echo "${YELLOW}Step 4: Building TypeScript...${NC}"
npm run build
echo "${GREEN}✓ Build complete${NC}"
echo ""

# 5. Start containers
echo "${YELLOW}Step 5: Starting Docker services...${NC}"
docker compose down --remove-orphans 2>/dev/null || true
docker compose up -d --wait
echo "${GREEN}✓ Services started${NC}"
echo ""

# 6. Database setup
echo "${YELLOW}Step 6: Initializing database...${NC}"
npm run db:migrate
echo "${GREEN}✓ Database ready${NC}"
echo ""

# 7. Verification
echo "${YELLOW}Step 7: Verifying services...${NC}"
sleep 2
curl -s http://localhost:8080/health > /dev/null && \
    echo "${GREEN}✓ Agent service is healthy${NC}" || \
    echo "${YELLOW}⚠ Agent may still be starting. Check 'docker compose logs agent' in 10s${NC}"
echo ""

echo "${GREEN}=== Setup Complete ===${NC}"
echo ""
echo "Next steps:"
echo "  • Cockpit UI:      npm run cockpit"
echo "  • Run tests:       npm test"
echo "  • Agent logs:      docker compose logs -f agent"
echo "  • API docs:        http://localhost:8080/documentation"
echo "  • Postgres:        localhost:5432 (postgres/sovereign_password)"
echo ""
