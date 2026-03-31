# Utiliser une image Python officielle comme image de base
FROM python:3.11-slim

# Définir le répertoire de travail dans le conteneur
WORKDIR /app

# Copier le fichier des dépendances (requirements.txt) dans le conteneur
# Assurez-vous que ce fichier existe dans votre dossier 'backend'
COPY requirements.txt ./

# Installer les dépendances Python
# On augmente le timeout pour les réseaux lents
RUN pip install --default-timeout=100 --no-cache-dir -r requirements.txt

# Copier tout le contenu du répertoire 'backend' local dans le répertoire de travail du conteneur
COPY . .

# Commande pour démarrer votre application.
# Cet exemple utilise uvicorn, commun pour FastAPI. Adaptez-le si vous utilisez gunicorn (pour Django/Flask) ou autre chose.
# Assurez-vous que le fichier principal et l'instance de l'application (ici 'main:app') sont corrects.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]