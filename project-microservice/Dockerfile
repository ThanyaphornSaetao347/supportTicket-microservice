# Base image
FROM node:20-alpine

# Set working directory
WORKDIR /usr/src/project

# Install dependencies only when needed
COPY package*.json ./

# Optional: สำหรับบางเครื่องที่ใช้ `node-gyp`
RUN apk add --no-cache python3 make g++

RUN npm install

# Copy rest of the application
COPY . .

# Build the app
RUN npm run build

# Expose the port used by this microservice (เปลี่ยนตามจริง)
EXPOSE 3007

# Default command
CMD ["npm", "run", "start:prod"]
