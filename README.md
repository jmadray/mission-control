# Mission Control

A unified dashboard for monitoring Tony's JAMLIFE infrastructure.

## Features

- 📊 **System Overview** - Docker system information and health
- 🐳 **Container Management** - Real-time container status and monitoring
- ⚡ **Live Updates** - WebSocket-powered real-time updates
- 🎛️ **Clean Interface** - Terminal-inspired dark theme
- 🔒 **Secure Access** - Protected by Authelia through Traefik

## Services Monitored

- Saltbox services (Sonarr, Radarr, Overseerr, etc.)
- Custom applications (Scoreboard, Print Queue, etc.)
- System containers and infrastructure

## Tech Stack

- **Backend**: Node.js + Express
- **Frontend**: Vanilla JavaScript + WebSocket
- **Docker**: Dockerode for Docker API integration
- **Deployment**: Docker Compose with Saltbox integration

## Deployment

The application is deployed using Docker Compose and integrated with Saltbox's Traefik reverse proxy.

### URL
https://control.jamlife.solutions

### Local Development
```bash
npm install
npm run dev
```

## Configuration

- Accessible via Traefik with SSL termination
- Protected by Authelia authentication
- Monitors Docker socket at `/var/run/docker.sock`
- Reads Saltbox configurations from `/opt/saltbox`

## Author

Built by Ratchet 🔧 for Tony's infrastructure monitoring needs.
