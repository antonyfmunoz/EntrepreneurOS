FROM node:20-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Vite inlines VITE_* values at build time. A missing Clerk publishable key
# creates an apparently healthy image whose client can never authenticate, so
# fail the image build instead of shipping that state.
ARG VITE_CLERK_PUBLISHABLE_KEY
ARG VITE_POSTHOG_API_KEY
RUN test -n "$VITE_CLERK_PUBLISHABLE_KEY"
ENV VITE_CLERK_PUBLISHABLE_KEY=$VITE_CLERK_PUBLISHABLE_KEY
ENV VITE_POSTHOG_API_KEY=$VITE_POSTHOG_API_KEY
RUN npm run build
RUN npm prune --omit=dev --omit=optional && npm cache clean --force

FROM node:20-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=5000

COPY package.json package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/migrations ./migrations
COPY --from=build /app/scripts/migrations ./scripts/migrations

USER node
EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:5000/api/ready').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["npm", "start"]
