from pydantic import BaseModel, EmailStr
from typing import List, Optional, Dict
from datetime import datetime
from models import UserRole, ProjectStatus, RequestStatus

# --- SCHEMAS AUTHENTIFICATION ---
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None

# --- SCHEMAS UTILISATEURS ---
class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None
    role: UserRole = UserRole.AUDITEUR
    is_active: bool = True

class UserCreate(UserBase):
    password: str

class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None

class UserResponse(UserBase):
    id: int
    
    class Config:
        from_attributes = True # Permet de convertir les modèles SQLAlchemy en Pydantic

# --- SCHEMAS INVESTISSEURS ---
class InvestorBase(BaseModel):
    name: str
    type: Optional[str] = None
    country: Optional[str] = None
    sector: Optional[str] = None
    contact_info: Optional[str] = None

class InvestorCreate(InvestorBase):
    pass

class InvestorResponse(InvestorBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

# --- SCHEMAS DASHBOARD ---
class DashboardStats(BaseModel):
    total_projects: int
    total_investors: int
    total_investment_projected: float
    total_investment_realized: float
    total_jobs_created: int
    total_jobs_effective: int
    total_jobs_forecast: int
    total_land_area: float
    projects_by_status: Dict[str, int]
    # Nouvelles stats pour les courriers
    total_requests: int
    pending_requests: int
    avg_processing_days: float
    # Séries temporelles pour les graphiques
    monthly_trends: List[Dict] # [{month: "Jan", investment: 100, jobs: 50, sales: 200}, ...]
    employment_gender_split: Dict[str, int] # {men: 100, women: 80}
    employment_origin_split: Dict[str, int] # {national: 150, expat: 30}

# --- SCHEMAS COURRIERS ---
class RequestBase(BaseModel):
    subject: str
    description: Optional[str] = None
    status: RequestStatus = RequestStatus.A_TRAITER

class RequestCreate(RequestBase):
    project_id: int

class RequestResponse(RequestBase):
    id: int
    project_id: int
    received_at: datetime
    processed_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# --- SCHEMAS DOCUMENTS ---
class DocumentResponse(BaseModel):
    id: int
    project_id: int
    name: str
    file_path: str
    upload_date: datetime

    class Config:
        from_attributes = True

# --- SCHEMAS EMPLOI (KPI) ---
class EmploymentBase(BaseModel):
    jobs_created_total: int = 0
    jobs_effective: int = 0
    jobs_forecast: int = 0
    jobs_national: int = 0
    jobs_expat: int = 0
    jobs_men: int = 0
    jobs_women: int = 0
    gender_ratio_female: float = 0.0

class EmploymentCreate(EmploymentBase):
    pass

class EmploymentResponse(EmploymentBase):
    id: int
    project_id: int
    
    class Config:
        from_attributes = True

# --- SCHEMAS PROJETS ---
class ProjectBase(BaseModel):
    name: Optional[str] = ""
    description: Optional[str] = None
    status: ProjectStatus = ProjectStatus.EN_ATTENTE
    investment_projected: float = 0.0
    investment_realized: float = 0.0
    land_area: float = 0.0

class ProjectCreate(ProjectBase):
    investor_id: int

class ProjectResponse(ProjectBase):
    id: int
    investor_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    # On pourra inclure l'objet Investor complet ici plus tard si besoin
    investor: Optional[InvestorResponse] = None
    employment: Optional[EmploymentResponse] = None

    class Config:
        from_attributes = True

# --- SCHEMAS MISE A JOUR PROJET (Pipeline) ---
class ProjectUpdate(BaseModel):
    status: Optional[ProjectStatus] = None
    description: Optional[str] = None
    investment_projected: Optional[float] = None
    investment_realized: Optional[float] = None
    land_area: Optional[float] = None

# --- SCHEMAS INTERACTIONS (CRM) ---
class InteractionBase(BaseModel):
    type: str # Ex: "Appel", "Email", "Réunion"
    notes: Optional[str] = None

class InteractionCreate(InteractionBase):
    project_id: int

class InteractionResponse(InteractionBase):
    id: int
    user_id: int
    date: datetime
    
    class Config:
        from_attributes = True

# --- SCHEMAS AUDIT LOG ---
class AuditLogResponse(BaseModel):
    id: int
    action: str
    details: Optional[str] = None
    timestamp: datetime
    user: UserResponse

    class Config:
        from_attributes = True