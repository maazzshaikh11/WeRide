# WeRide Node backend (routing/ETA API + socket.io fan-out).
FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

# Secure by default: production requires a Firebase Admin verifier (see docs/security/server.md);
# the server refuses to start without one. For local dev override with
# NODE_ENV=development ALLOW_INSECURE_DEV_AUTH=1.
ENV NODE_ENV=production
USER node

EXPOSE 3000

CMD ["node", "index.js"]
