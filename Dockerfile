FROM node:8.11.2-alpine

MAINTAINER Rudraksh MK

#WORKDIR /usr/src/app
#COPY sked-api*.tgz /usr/src/app/
#RUN npm i -g sked-api*.tgz --prefix /usr/src/app/
#WORKDIR /usr/src/app/lib/node_modules/sked-api

COPY index.js knexfile.js package-lock.json package.json /root/
WORKDIR /root
RUN npm install

ENTRYPOINT ["node", "index.js"]
