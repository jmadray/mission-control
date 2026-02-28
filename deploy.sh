#!/bin/bash

# Mission Control Deployment Script
# Deploys from gateway server to jamlife production

set -e

echo "🚀 Deploying Mission Control to JAMLIFE..."

# Validate .env file exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found!"
    echo "Copy .env.example to .env and configure your API tokens"
    exit 1
fi

# Get GitHub token
TOKEN=$(cat ~/.config/gh/token)

# Push latest code to GitHub first
echo "📦 Pushing to GitHub..."
git push

# Deploy to jamlife
echo "🚢 Deploying to jamlife..."
ssh ratchet@100.67.147.121 "
    cd /opt/mission-control &&
    
    # Update from GitHub
    git remote set-url origin https://jmadray:${TOKEN}@github.com/jmadray/mission-control.git &&
    git pull &&
    
    # Rebuild and restart
    docker compose down &&
    docker compose up -d --build &&
    
    # Clean up token from remote URL
    git remote set-url origin https://github.com/jmadray/mission-control.git &&
    
    echo '✅ Mission Control deployed successfully!'
"

# Copy environment file to production
echo "⚙️ Copying environment configuration..."
scp .env ratchet@100.67.147.121:/opt/mission-control/.env

# Restart with new environment
ssh ratchet@100.67.147.121 "
    cd /opt/mission-control &&
    docker compose restart &&
    echo '🔄 Services restarted with new configuration'
"

echo "🎯 Deployment complete! Check https://control.jamlife.solutions"
