FROM node:20-alpine

ENV NODE_ENV=production
EXPOSE 5000
ENTRYPOINT ["npm", "start"]

WORKDIR /app
COPY package*.json .
RUN npm ci

COPY . .
