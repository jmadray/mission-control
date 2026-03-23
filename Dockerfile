FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy application code
COPY . .

# Create data directory
RUN mkdir -p /app/data && chown -R 1000:1001 /app/data

# Expose port
EXPOSE 3000

# Run as ratchet user (1001:1002)
USER 1001:1002

CMD ["npm", "start"]
