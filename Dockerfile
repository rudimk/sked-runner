FROM node:8.11.2-alpine

MAINTAINER Rudraksh MK

COPY package.json package-lock.json index.js /root/
WORKDIR /root
RUN npm install

ENTRYPOINT ["node", "index.js"]