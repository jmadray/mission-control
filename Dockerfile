FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy application code
COPY . .

# Create config directory and set permissions
RUN mkdir -p /config && chown -R 1000:1001 /config

# Expose port
EXPOSE 3000

# Switch to non-root user with docker group
USER 1000:1001

CMD ["npm", "start"]
