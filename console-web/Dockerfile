FROM node:20-bookworm-slim

# Prisma engines require OpenSSL available in the container
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy only manifests first (layer caching)
COPY package.json package-lock.json* ./

# Install deps (installs prisma@5.19.1 locally)
RUN npm install

# Copy the rest of the app
COPY . .

# Generate Prisma client using the local Prisma binary (avoid auto-fetching Prisma 7)
RUN ./node_modules/.bin/prisma generate

EXPOSE 3001

# Use local Prisma binary at runtime (avoid npm exec/npx installing prisma@latest)
CMD ["sh", "-c", "./node_modules/.bin/prisma db push && npm run dev -- -p 3001"]
