# Use a Node.js base image
FROM node:14-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy the package.json and package-lock.json files to the container
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy the server.js file to the container
COPY server.js .

# Expose the port your Express server is listening on
EXPOSE 8080

# Start the server
CMD ["node", "server.js"]
