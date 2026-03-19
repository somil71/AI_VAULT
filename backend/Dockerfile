# Dockerfile for LifeVault Backend
# Node.js 18 + Express

FROM node:18-slim

WORKDIR /app

# Copy package files and install production dependencies
COPY package*.json ./
RUN npm install --production

# Copy source code
COPY . .

# Expose Express port
EXPOSE 3000

# Start the application
CMD ["node", "src/server.js"]
