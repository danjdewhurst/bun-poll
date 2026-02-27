FROM oven/bun:latest

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

COPY . .

ENV DB_PATH=/data/bun-poll.sqlite
EXPOSE 3000

CMD ["bun", "index.ts"]
