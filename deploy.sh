#!/bin/bash

# Mission Control Deployment Script
# Deploys from gateway server to jamlife production

set -e

echo "🚀 Deploying Mission Control to JAMLIFE..."

# Get GitHub token
TOKEN=$(cat ~/.config/gh/token)

# Deploy to jamlife
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

echo "🎯 Deployment complete! Check https://control.jamlife.solutions"
