# Multi-stage Dockerfile for React Frontend
# Supports development, testing, and production environments

# Base stage with common dependencies
FROM node:18-alpine as base

WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm ci

# Development stage
FROM base as development

ENV NODE_ENV=development
ENV VITE_MODE=development

# Copy app files
COPY . .

# Expose the development server port
EXPOSE 5173

# Start the development server
CMD ["npm", "run", "dev", "--", "--host"]

# Testing stage
FROM base as testing

ENV NODE_ENV=testing
ENV VITE_MODE=testing

# Copy app files
COPY . .

# Expose the development server port (for testing with hot reload)
EXPOSE 3000

# Start the development server for testing
CMD ["npm", "run", "dev", "--", "--host", "--port", "3000"]

# Production build stage
FROM base as build

ENV NODE_ENV=production
ENV VITE_MODE=production

# Copy app files
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM nginx:alpine as production

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built application from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
