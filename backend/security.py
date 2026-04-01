import os
from datetime import datetime, timedelta, timezone
from typing import Optional, List
from passlib.context import CryptContext
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

import models, schemas, crud
from database import get_db

# --- Configuration ---
# IMPORTANT: Ces valeurs devraient être dans un fichier de configuration ou des variables d'environnement
SECRET_KEY = os.getenv("SECRET_KEY", "a_very_secret_key_that_should_be_changed_for_production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

# --- Hachage de Mot de Passe ---
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

# --- Gestion des Jetons JWT ---
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

# --- Dépendance pour l'Authentification ---
def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Impossible de valider les informations d'identification",
        headers={"WWW-Authenticate": "Bearer"},
    )
    inactive_user_exception = HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Utilisateur inactif",
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None: raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = crud.get_user_by_email(db, email=email)
    if user is None: raise credentials_exception
    if not user.is_active:
        raise inactive_user_exception
    return user

# --- Dépendance pour la gestion des Rôles (RBAC) ---
def require_role(required_roles: List[models.UserRole]):
    """
    Crée une dépendance qui vérifie si l'utilisateur actuel a l'un des rôles requis.
    """
    def role_checker(current_user: models.User = Depends(get_current_user)):
        if current_user.role not in required_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Action non autorisée. Rôle insuffisant."
            )
        return current_user
    return role_checker