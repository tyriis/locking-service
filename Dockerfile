FROM node:24.22.1-alpine@sha256:06d7adf3e0ef61a13f1d28682726366f97a15aa1888c934d3ecec86c33918b53 AS build

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN PNPM_VERSION=$(node -p 'require("./package.json").packageManager.split("@")[1]') \
  && npm install -g "pnpm@${PNPM_VERSION}"
# --ignore-scripts is deliberate: the "prepare" script runs "lefthook install",
# which needs a git repository, and .git is not part of the build context.
RUN pnpm install --frozen-lockfile --ignore-scripts

COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN pnpm build

FROM node:24.22.1-alpine@sha256:06d7adf3e0ef61a13f1d28682726366f97a15aa1888c934d3ecec86c33918b53

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN PNPM_VERSION=$(node -p 'require("./package.json").packageManager.split("@")[1]') \
  && npm install -g "pnpm@${PNPM_VERSION}"
# --ignore-scripts as well: "prepare" runs lefthook, a dev dependency that is
# not installed here, and no runtime dependency needs a lifecycle script.
RUN pnpm install --prod --frozen-lockfile --ignore-scripts && pnpm store prune

COPY --from=build /app/dist ./dist
COPY LICENSE ./LICENSE

LABEL org.opencontainers.image.source="https://github.com/tyriis/locking-service" \
      org.opencontainers.image.description="Locking service with a lock API backed by Redis" \
      org.opencontainers.image.licenses="MIT"

USER node

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "dist/index.js"]
