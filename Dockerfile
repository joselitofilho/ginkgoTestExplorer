FROM golang:1.15.3
RUN apt-get update
RUN apt-get install -y git python jq curl vim
# && libnss3 libatk1.0-0 libatk-bridge2.0-0 libx11-xcb1 librust-gdk-pixbuf-sys-dev libgtk-3-0 libdrm2 libgbm1 libasound2 - TODO npm run test

RUN curl -sL https://deb.nodesource.com/setup_15.x | bash -
RUN apt-get update && apt-get install -y nodejs
RUN npm install gulp -g \
    && npm install yarn -g \
    && npm install -g yo generator-code

WORKDIR /src

# RUN chmod g+rwx /root /root/.config /root/.config/insight-nodejs

COPY . .
