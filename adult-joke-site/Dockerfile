FROM node:24-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund

COPY . .
RUN npm run build-client

ENV PORT=3003
EXPOSE 3003

CMD ["npm","run","start"]
