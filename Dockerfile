FROM node:20-slim

WORKDIR /app

COPY . .

RUN npm run setup
RUN npm run build:web
RUN npm run build

ENV PORT=8000
ENV HOST=0.0.0.0

EXPOSE 8000

CMD ["npm", "run", "dev"]
