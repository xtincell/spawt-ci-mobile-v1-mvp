# Build from the repository root: the admin imports shared/supabase-session.ts.
FROM node:22-alpine AS build
WORKDIR /app
COPY spawt-admin/package.json spawt-admin/package-lock.json ./spawt-admin/
RUN npm ci --prefix spawt-admin --no-audit --no-fund
COPY shared ./shared
COPY spawt-admin ./spawt-admin
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
RUN test -n "$VITE_SUPABASE_URL" && test -n "$VITE_SUPABASE_ANON_KEY" && npm run build --prefix spawt-admin

FROM nginx:alpine
COPY spawt-admin/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/spawt-admin/dist /usr/share/nginx/html
EXPOSE 80
