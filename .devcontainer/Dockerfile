FROM mcr.microsoft.com/devcontainers/javascript-node:24-bookworm

# Install pnpm globally
RUN npm install -g pnpm@latest

# Create developer user if not exists (features should handle this)
# Additional setup can be added here if needed

# Set working directory
WORKDIR /workspace

# Ensure proper permissions for the workspace
RUN chown -R developer:developer /workspace || true
