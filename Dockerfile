# Base image
FROM node:18

# Create app directory
WORKDIR /usr/src/app

RUN corepack enable

COPY package.json yarn.lock ./
COPY .yarn ./.yarn

# Install app dependencies
RUN yarn install --immutable

# Bundle app source
COPY . .

# Creates a "dist" folder with the production build
RUN yarn build

# Start the server using the production build
CMD [ "yarn", "start:prod" ]
