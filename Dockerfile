FROM node:22.14.0-slim@sha256:6bba748696297138f802735367bc78fea5cfe3b85019c74d2a930bc6c6b2fac4 AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN npm install -g pnpm@10.4.1
WORKDIR /app
COPY . /app


FROM base AS prod-deps
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --frozen-lockfile

FROM base AS build
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm run build

FROM build AS test
RUN pnpm run lint
RUN pnpm run test:cov

FROM base
COPY --from=prod-deps /app/node_modules /app/node_modules
COPY --from=build /app/dist /app/dist
COPY --chown=node:node --from=base /app/package.json /app/package.json
COPY --from=base /app/LICENSE /app/LICENSE
COPY --from=base /app/nest-cli.json /app/nest-cli.json

USER node
EXPOSE 3000
CMD [ "pnpm", "run", "start:prod" ]
