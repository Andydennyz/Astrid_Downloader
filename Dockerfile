FROM node:22-bookworm-slim AS frontend-build

WORKDIR /app
RUN chown node:node /app
COPY --chown=node:node package.json package-lock.json ./
USER node
RUN npm ci
COPY --chown=node:node . .

ARG VITE_API_BASE_URL=/api/v1
ARG VITE_SUPABASE_URL=
ARG VITE_SUPABASE_PUBLISHABLE_KEY=
ARG VITE_SUPABASE_ANON_KEY=
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY \
    VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

RUN npm run build

FROM nginx:alpine
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=frontend-build /app/dist/client/ /usr/share/nginx/html/

EXPOSE 80
