from sqlalchemy import Column, Integer, String, ForeignKey, Float, DateTime, Enum, Text, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from database import Base

# --- ENUMS (Listes de choix fixes) ---

class UserRole(str, enum.Enum):
    ADMIN = "ADMIN"
    MANAGER = "MANAGER"
    AUDITEUR = "AUDITEUR"

class RequestStatus(str, enum.Enum):
    A_TRAITER = "à traiter"
    EN_COURS = "en cours"
    TRAITE = "traité"
    REJETE = "rejeté"

# Les statuts ont été mis à jour pour correspondre à la demande
class ProjectStatus(str, enum.Enum):
    EN_ACTIVITE = "en activités"
    EN_COURS = "en cours"
    EN_ATTENTE = "en attentes"
    SUSPENDU = "suspendus"

# --- ENTITÉS ---

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String)
    role = Column(Enum(UserRole), default=UserRole.AUDITEUR)
    is_active = Column(Boolean, default=True)
    
    # Relations
    audit_logs = relationship("AuditLog", back_populates="user")
    interactions = relationship("Interaction", back_populates="user")

class Investor(Base):
    __tablename__ = "investors"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False) # Nom de l'entreprise ou de l'investisseur
    type = Column(String) # Ex: Privé, Public, PPP
    country = Column(String)
    sector = Column(String)
    contact_info = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    projects = relationship("Project", back_populates="investor")

class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    investor_id = Column(Integer, ForeignKey("investors.id"))
    name = Column(String, index=True)
    description = Column(Text)
    status = Column(Enum(ProjectStatus), default=ProjectStatus.EN_ATTENTE)
    
    # KPI Investissement
    investment_projected = Column(Float, default=0.0)
    investment_realized = Column(Float, default=0.0)
    # Ajout de la superficie
    land_area = Column(Float, default=0.0)
    
    # KPI Chiffre d'Affaires
    total_sales = Column(Float, default=0.0)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    investor = relationship("Investor", back_populates="projects")
    employment = relationship("Employment", uselist=False, back_populates="project", cascade="all, delete-orphan")
    interactions = relationship("Interaction", back_populates="project")
    documents = relationship("Document", back_populates="project")
    requests = relationship("Request", back_populates="project")
    monthly_records = relationship("MonthlyRecord", back_populates="project", cascade="all, delete-orphan")

class Employment(Base):
    __tablename__ = "employments"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), unique=True)
    
    # KPI Emploi
    jobs_forecast = Column(Integer, default=0)
    jobs_created_total = Column(Integer, default=0)
    jobs_effective = Column(Integer, default=0)
    jobs_national = Column(Integer, default=0)
    jobs_expat = Column(Integer, default=0)
    jobs_men = Column(Integer, default=0)
    jobs_women = Column(Integer, default=0)
    gender_ratio_female = Column(Float, default=0.0)

    project = relationship("Project", back_populates="employment")

class MonthlyRecord(Base):
    __tablename__ = "monthly_records"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    record_date = Column(DateTime(timezone=True), server_default=func.now()) # Le mois concerné
    
    # Variables suivies
    investment_realized = Column(Float, default=0.0)
    total_sales = Column(Float, default=0.0)
    jobs_effective = Column(Integer, default=0)
    jobs_national = Column(Integer, default=0)
    jobs_expat = Column(Integer, default=0)
    jobs_men = Column(Integer, default=0)
    jobs_women = Column(Integer, default=0)

    project = relationship("Project", back_populates="monthly_records")

class Interaction(Base):
    __tablename__ = "interactions"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    type = Column(String) # Ex: Appel, Email, Réunion
    notes = Column(Text)
    date = Column(DateTime(timezone=True), server_default=func.now())

    project = relationship("Project", back_populates="interactions")
    user = relationship("User", back_populates="interactions")

class Request(Base):
    __tablename__ = "requests"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    subject = Column(String, nullable=False)
    description = Column(Text)
    status = Column(Enum(RequestStatus), default=RequestStatus.A_TRAITER)
    received_at = Column(DateTime(timezone=True), server_default=func.now())
    processed_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relation
    project = relationship("Project", back_populates="requests")

class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    name = Column(String)
    file_path = Column(String)
    upload_date = Column(DateTime(timezone=True), server_default=func.now())

    project = relationship("Project", back_populates="documents")

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    action = Column(String) # Ex: "CREATE_PROJECT", "UPDATE_STATUS"
    details = Column(Text)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="audit_logs")