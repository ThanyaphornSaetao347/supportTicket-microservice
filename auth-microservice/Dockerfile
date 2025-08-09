# Base image
FROM node:18-alpine

# ติดตั้ง build tools สำหรับ bcrypt
RUN apk add --no-cache python3 make g++

# Set working directory
WORKDIR /usr/src/auth

# Install dependencies only when needed
COPY package*.json ./

# Optional: สำหรับบางเครื่องที่ใช้ `node-gyp`
# RUN apk add --no-cache python3 make g++

RUN npm install

# Copy rest of the application
COPY . .

# Build the app
RUN npm run build

# Expose the port used by this microservice (เปลี่ยนตามจริง)
EXPOSE 3002

# Default command
CMD ["npm", "run", "start:prod"]
