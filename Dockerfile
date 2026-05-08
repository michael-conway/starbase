# syntax=docker/dockerfile:1

FROM ubuntu:24.04 AS build

ARG DEBIAN_FRONTEND=noninteractive
ARG NODE_MAJOR=24
ARG VITE_API_BASE_URL=
ARG VITE_STARBASE_CONFIG_PATH=

ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_STARBASE_CONFIG_PATH=${VITE_STARBASE_CONFIG_PATH}

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl gnupg \
    && install -d -m 0755 /etc/apt/keyrings \
    && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
      | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg \
    && echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_${NODE_MAJOR}.x nodistro main" \
      > /etc/apt/sources.list.d/nodesource.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM ubuntu:24.04 AS runtime

ARG DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates nginx \
    && rm -rf /var/lib/apt/lists/* \
    && rm -f /etc/nginx/sites-enabled/default /etc/nginx/sites-available/default \
    && mkdir -p /run/nginx /var/www/starbase

COPY docker/nginx.conf /etc/nginx/sites-available/starbase.conf
RUN ln -s /etc/nginx/sites-available/starbase.conf /etc/nginx/sites-enabled/starbase.conf

COPY --from=build /app/dist/ /var/www/starbase/

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
