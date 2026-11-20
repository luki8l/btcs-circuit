# Circuit as one container: the Next.js server plus the database migrations and admin scripts.
# Build:  docker build -t circuit .
# Run:    docker run -p 3000:3000 --env-file circuit.env circuit            (see docs/HANDOVER.md for the settings)
# Update the database with the same image:  docker run --rm --env-file circuit.env circuit node scripts/migrate.mjs
# All settings are read at runtime: one image runs in any environment.

FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN useradd --system --uid 1001 --home /app circuit
COPY --from=build --chown=circuit:circuit /app/.next/standalone ./
COPY --from=build --chown=circuit:circuit /app/.next/static ./.next/static
COPY --from=build --chown=circuit:circuit /app/public ./public
COPY --from=build --chown=circuit:circuit /app/supabase/migrations ./supabase/migrations
COPY --from=build --chown=circuit:circuit /app/db ./db
COPY --from=build --chown=circuit:circuit /app/scripts/migrate.mjs /app/scripts/add-user.mjs /app/scripts/transfer-data.mjs ./scripts/
USER circuit
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
