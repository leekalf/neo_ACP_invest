FROM node:18-alpine

WORKDIR /app

# Copier les fichiers de configuration
COPY package.json .

# Installer les dépendances
RUN npm install

# Copier le reste du code source.
# On est plus explicite pour un meilleur usage du cache Docker.
COPY vite.config.js .
COPY index.html .
COPY src ./src

# Exposer le port 3000
EXPOSE 3000

# Lancer l'application en mode développement
CMD ["npm", "run", "dev"]