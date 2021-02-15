FROM node:15

RUN npm install -g yo generator-code

WORKDIR /src

COPY . .

# CMD [ "node", "src/server.js" ]