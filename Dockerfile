FROM golang:1.15.3
RUN apt-get update
RUN apt-get install -y git python jq curl vim

RUN curl -sL https://deb.nodesource.com/setup_15.x | bash -
RUN apt-get update && apt-get install -y nodejs
RUN npm install gulp -g \
    && npm install yarn -g \
    && npm install -g yo generator-code \
    && npm install -g vsce

WORKDIR /src

COPY . .
