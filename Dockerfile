FROM node:20-alpine
RUN apk add --no-cache libc6-compat openssl tzdata
ENV TZ=Asia/Ulaanbaatar
RUN cp /usr/share/zoneinfo/Asia/Ulaanbaatar /etc/localtime && echo "Asia/Ulaanbaatar" > /etc/timezone
WORKDIR /app

COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm install --legacy-peer-deps

COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["npm", "run", "start"]
