FROM node:22-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Vite inlines VITE_* values at build time. A missing Clerk publishable key
# creates an apparently healthy image whose client can never authenticate, so
# fail the image build instead of shipping that state.
ARG CLERK_PUBLISHABLE_BUILD_VALUE
ARG POSTHOG_PUBLIC_BUILD_VALUE
RUN test -n "$CLERK_PUBLISHABLE_BUILD_VALUE"
RUN VITE_CLERK_PUBLISHABLE_KEY="$CLERK_PUBLISHABLE_BUILD_VALUE" VITE_POSTHOG_API_KEY="$POSTHOG_PUBLIC_BUILD_VALUE" npm run build
RUN npm prune --omit=dev --omit=optional && npm cache clean --force

FROM node:22-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=5000

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates clamav clamav-daemon clamav-freshclam gosu \
  && rm -rf /var/lib/apt/lists/*

COPY docker/clamd.conf /etc/clamav/clamd.conf
COPY docker/freshclam.conf /etc/clamav/freshclam.conf
COPY docker/eos-entrypoint.sh /usr/local/bin/eos-entrypoint
RUN chmod 0755 /usr/local/bin/eos-entrypoint \
  && mkdir -p /run/clamav /var/lib/clamav \
  && chown -R clamav:clamav /run/clamav /var/lib/clamav \
  && freshclam --config-file=/etc/clamav/freshclam.conf

COPY package.json package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/migrations ./migrations
COPY --from=build /app/scripts/migrations ./scripts/migrations

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:5000/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

ENTRYPOINT ["/usr/local/bin/eos-entrypoint"]
