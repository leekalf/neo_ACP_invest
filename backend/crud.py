from sqlalchemy.orm import Session
from sqlalchemy import func, extract, desc
from typing import Optional
from datetime import datetime, timedelta
import models, schemas, security

# --- CRUD Utilisateurs ---
def get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(models.User.email == email).first()

def get_user(db: Session, user_id: int):
    return db.query(models.User).filter(models.User.id == user_id).first()

def create_user(db: Session, user: schemas.UserCreate):
    hashed_password = security.get_password_hash(user.password)
    db_user = models.User(email=user.email, hashed_password=hashed_password, full_name=user.full_name, role=user.role)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def update_user(db: Session, user_id: int, user_update: schemas.UserUpdate):
    db_user = get_user(db, user_id)
    if not db_user:
        return None
    
    update_data = user_update.dict(exclude_unset=True)
    if 'password' in update_data and update_data['password']:
        update_data['hashed_password'] = security.get_password_hash(update_data['password'])
        del update_data['password']
    
    for key, value in update_data.items():
        setattr(db_user, key, value)
    
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

# --- CRUD Investisseurs ---
def get_investor_by_name(db: Session, name: str):
    return db.query(models.Investor).filter(models.Investor.name == name).first()

def create_investor(db: Session, investor: schemas.InvestorCreate):
    db_investor = models.Investor(**investor.dict())
    db.add(db_investor)
    db.commit()
    db.refresh(db_investor)
    return db_investor

def get_investors(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Investor).order_by(models.Investor.id.asc()).offset(skip).limit(limit).all()

# --- CRUD Projets ---
def create_project(db: Session, project: schemas.ProjectCreate):
    db_project = models.Project(**project.dict())
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    return db_project

def get_projects(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Project).order_by(models.Project.id.asc()).offset(skip).limit(limit).all()

def get_project(db: Session, project_id: int):
    return db.query(models.Project).filter(models.Project.id == project_id).first()

# --- CRUD Mise à jour Projet ---
def update_project(db: Session, project_id: int, project_update: schemas.ProjectUpdate):
    db_project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not db_project:
        return None
    
    # On met à jour uniquement les champs fournis (exclude_unset=True)
    update_data = project_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_project, key, value)
    
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    return db_project

def delete_project(db: Session, project_id: int):
    db_project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if db_project:
        db.delete(db_project)
        db.commit()
        return True
    return False

# --- CRUD Interactions ---
def create_interaction(db: Session, interaction: schemas.InteractionCreate, user_id: int):
    db_interaction = models.Interaction(**interaction.dict(), user_id=user_id)
    db.add(db_interaction)
    db.commit()
    db.refresh(db_interaction)
    return db_interaction

def get_interactions(db: Session, project_id: int):
    return db.query(models.Interaction).filter(models.Interaction.project_id == project_id).all()

# --- CRUD Emploi ---
def create_or_update_employment(db: Session, employment: schemas.EmploymentCreate, project_id: int):
    db_employment = db.query(models.Employment).filter(models.Employment.project_id == project_id).first()
    if db_employment:
        # Mise à jour si existe déjà
        for key, value in employment.dict().items():
            setattr(db_employment, key, value)
    else:
        # Création sinon
        db_employment = models.Employment(**employment.dict(), project_id=project_id)
        db.add(db_employment)
    
    db.commit()
    db.refresh(db_employment)
    return db_employment

def get_employment(db: Session, project_id: int):
    return db.query(models.Employment).filter(models.Employment.project_id == project_id).first()

# --- CRUD Audit Logs ---
def create_audit_log(db: Session, user_id: int, action: str, details: str):
    db_log = models.AuditLog(user_id=user_id, action=action, details=details)
    db.add(db_log)
    db.commit()
    db.refresh(db_log)
    return db_log

# --- CRUD Historique Mensuel ---
def create_monthly_record(db: Session, record: dict):
    db_record = models.MonthlyRecord(**record)
    db.add(db_record)
    db.commit()
    db.refresh(db_record)
    return db_record

# --- CRUD Courriers (Requests) ---
def create_request(db: Session, request: schemas.RequestCreate):
    db_request = models.Request(**request.dict())
    db.add(db_request)
    db.commit()
    db.refresh(db_request)
    return db_request

def update_request_status(db: Session, request_id: int, status: models.RequestStatus):
    db_request = db.query(models.Request).filter(models.Request.id == request_id).first()
    if db_request:
        db_request.status = status
        if status == models.RequestStatus.TRAITE:
            db_request.processed_at = func.now()
        db.commit()
        db.refresh(db_request)
    return db_request

def get_request(db: Session, request_id: int):
    return db.query(models.Request).filter(models.Request.id == request_id).first()

def get_requests(db: Session, skip: int = 0, limit: int = 100, status: Optional[str] = None, project_id: Optional[int] = None):
    query = db.query(models.Request)
    if status:
        if status == "waiting":
            query = query.filter(models.Request.status.in_([models.RequestStatus.A_TRAITER, models.RequestStatus.EN_COURS]))
        else:
            query = query.filter(models.Request.status == status)
    if project_id:
        query = query.filter(models.Request.project_id == project_id)
    # Charger la relation 'project' pour éviter les requêtes N+1 lors de l'affichage
    return query.order_by(models.Request.id.asc()).offset(skip).limit(limit).all()


def get_audit_logs(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.AuditLog).order_by(models.AuditLog.id.asc()).offset(skip).limit(limit).all()

# --- CRUD Dashboard ---
def get_dashboard_stats(db: Session, year: Optional[int] = None):
    # Compteurs simples
    total_projects = db.query(models.Project).count()
    total_investors = db.query(models.Investor).count()
    
    # Si une année est spécifiée, on base les totaux sur les records de cette année
    # Sinon on prend l'état actuel
    inv_stats = db.query(
        func.sum(models.Project.investment_projected),
        func.sum(models.Project.investment_realized)
    ).first()
    
    # Agrégation des emplois
    jobs_stats = db.query(func.sum(models.Employment.jobs_created_total), 
                          func.sum(models.Employment.jobs_effective)).first()
    jobs_forecast_stats = db.query(func.sum(models.Employment.jobs_forecast)).first()

    # Agrégation de la superficie
    land_area_stats = db.query(func.sum(models.Project.land_area)).first()
    
    # Répartition par statut (Group By)
    status_counts = db.query(
        models.Project.status, func.count(models.Project.status)
    ).group_by(models.Project.status).all()
    
    # Stats Courriers
    total_req = db.query(models.Request).count()
    pending_req = db.query(models.Request).filter(models.Request.status.in_([models.RequestStatus.A_TRAITER, models.RequestStatus.EN_COURS])).count()
    
    # Calcul délai moyen de traitement (en jours)
    avg_delay = db.query(
        func.avg(
            extract('day', models.Request.processed_at - models.Request.received_at)
        )
    ).filter(models.Request.status == models.RequestStatus.TRAITE).scalar() or 0.0

    # Agrégation réelle des emplois
    emp_totals = db.query(
        func.sum(models.Employment.jobs_men),
        func.sum(models.Employment.jobs_women),
        func.sum(models.Employment.jobs_national),
        func.sum(models.Employment.jobs_expat)
    ).first()

    # Récupération des tendances filtrées par année
    trend_query = db.query(
        func.to_char(models.MonthlyRecord.record_date, 'Mon').label('month'),
        func.sum(models.MonthlyRecord.investment_realized).label('inv'),
        func.sum(models.MonthlyRecord.total_sales).label('sales'),
        func.sum(models.MonthlyRecord.jobs_effective).label('jobs'),
        func.sum(models.MonthlyRecord.jobs_men).label('men'),
        func.sum(models.MonthlyRecord.jobs_women).label('women'),
        func.sum(models.MonthlyRecord.jobs_national).label('nat'),
        func.sum(models.MonthlyRecord.jobs_expat).label('exp')
    )
    
    if year:
        trend_query = trend_query.filter(extract('year', models.MonthlyRecord.record_date) == year)
    
    monthly_data = trend_query.group_by('month').order_by(func.min(models.MonthlyRecord.record_date)).all()

    trends = [{
        "month": r.month, 
        "investment": r.inv, 
        "sales": r.sales, 
        "jobs": r.jobs,
        "men": r.men,
        "women": r.women,
        "national": r.nat,
        "expat": r.exp
    } for r in monthly_data]
    
    # Si pas encore de données historiques, on garde un fallback vide pour éviter le crash
    if not trends:
        trends = [{"month": datetime.now().strftime("%b"), "investment": 0, "sales": 0, "jobs": 0}]

    return {
        "total_projects": total_projects,
        "total_investors": total_investors,
        "total_investment_projected": inv_stats[0] or 0.0,
        "total_investment_realized": inv_stats[1] or 0.0,
        "total_jobs_created": jobs_stats[0] or 0,
        "total_jobs_effective": jobs_stats[1] or 0,
        "total_jobs_forecast": jobs_forecast_stats[0] or 0,
        "total_land_area": land_area_stats[0] or 0.0,
        "projects_by_status": {s.value: c for s, c in status_counts},
        "total_requests": total_req,
        "pending_requests": pending_req,
        "avg_processing_days": round(float(avg_delay), 1),
        "monthly_trends": trends,
        "employment_gender_split": {"Hommes": emp_totals[0] or 0, "Femmes": emp_totals[1] or 0},
        "employment_origin_split": {"Nationaux": emp_totals[2] or 0, "Expatriés": emp_totals[3] or 0}
    }

def get_project_stats(db: Session, project_id: int, year: Optional[int] = None):
    query = db.query(
        func.to_char(models.MonthlyRecord.record_date, 'Mon').label('month'),
        models.MonthlyRecord.investment_realized.label('inv'),
        models.MonthlyRecord.total_sales.label('sales'),
        models.MonthlyRecord.jobs_effective.label('jobs'),
        models.MonthlyRecord.jobs_men.label('men'),
        models.MonthlyRecord.jobs_women.label('women'),
        models.MonthlyRecord.jobs_national.label('national'),
        models.MonthlyRecord.jobs_expat.label('expat')
    ).filter(models.MonthlyRecord.project_id == project_id)
    
    if year:
        query = query.filter(extract('year', models.MonthlyRecord.record_date) == year)
    
    data = query.order_by(models.MonthlyRecord.record_date).all()
    return [dict(r._mapping) for r in data]

# --- CRUD Documents ---
def create_document(db: Session, document: dict):
    db_document = models.Document(**document)
    db.add(db_document)
    db.commit()
    db.refresh(db_document)
    return db_document

def get_project_documents(db: Session, project_id: int):
    return db.query(models.Document).filter(models.Document.project_id == project_id).all()