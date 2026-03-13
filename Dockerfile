# Use an official Python runtime as a parent image
FROM python:3.12-slim

# Install system dependencies including Node.js (v20)
RUN apt-get update && \
    apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install uv for Python dependency management
RUN pip install uv

# Set the working directory
WORKDIR /app

# Copy Node dependency definitions
COPY package.json package-lock.json ./

# Install Node dependencies
RUN npm ci

# Copy Python dependency definitions
COPY pyproject.toml uv.lock ./

# Install Python dependencies using uv
RUN uv sync

# Copy the rest of the application code
COPY . .

# IMPORTANT: To use the MCP server properly, you will need to mount the authentication files
# and cache directory at runtime. For example:
# docker run -i -v $(pwd)/data:/app/data connect-mcp

# The MCP server uses stdio for communication.
ENTRYPOINT ["node", "src/mcp-server.js"]
