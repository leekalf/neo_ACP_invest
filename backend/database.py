import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# URL de connexion construite à partir des variables d'environnement ou par défaut pour Docker
# Par défaut, on pointe sur localhost pour faciliter les scripts locaux (seed.py).
# Docker écrase cette valeur via la variable d'environnement définie dans docker-compose.yml
DATABASE_URL = os.getenv("DATABASE_URL")
if DATABASE_URL and DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
if not DATABASE_URL:
    DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:5433/acp-invest"

# Utilisation de connect_args pour passer les options au driver (psycopg2).
# L'option "-c client_encoding=utf8" force le serveur à envoyer de l'UTF-8.
engine = create_engine(
    DATABASE_URL,
    connect_args={"options": "-c client_encoding=utf8"}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()