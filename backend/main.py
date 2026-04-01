from fastapi import FastAPI, Depends, HTTPException, status, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session, joinedload
from fastapi.responses import StreamingResponse
from typing import List, Optional, AsyncGenerator
from datetime import datetime, timedelta
import shutil
import os
import pandas as pd
import io
from contextlib import asynccontextmanager

from database import engine, Base, get_db, SessionLocal
import models, schemas, crud, security

def init_db():
    """
    Fonction d'initialisation pour créer un Admin par défaut si la base est vide.
    """
    db = SessionLocal()
    try:
        admin_email = os.getenv("ADMIN_EMAIL", "admin@acp.tg")
        admin_password = os.getenv("ADMIN_PASSWORD", "admin123")

        # Vérifier si l'admin existe déjà
        existing_admin = db.query(models.User).filter(models.User.email == admin_email).first()
        
        if not existing_admin:
            print(f"--- INITIALISATION : Création de l'admin par défaut ({admin_email}) ---")
            hashed_password = security.get_password_hash(admin_password)
            admin_user = models.User(
                email=admin_email,
                hashed_password=hashed_password,
                full_name="Administrateur Système",
                role=models.UserRole.ADMIN,
                is_active=True
            )
            db.add(admin_user)
            db.commit()
            print("--- INITIALISATION : Admin créé avec succès ---")
        else:
            print("--- INITIALISATION : L'admin existe déjà ---")
    finally:
        db.close()

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator:
    """Gère le cycle de vie de l'application (Démarrage et Arrêt)."""
    # Création des tables
    models.Base.metadata.create_all(bind=engine)
    # Initialisation des données
    init_db()
    yield

app = FastAPI(
    root_path="/api",
    title="Système de Gestion des Investisseurs ACP",
    description="API pour le suivi stratégique des investissements",
    version="1.0.0",
    lifespan=lifespan
)

# --- CONFIGURATION CORS ---
# Configuration permissive pour le développement local.

allowed_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

# Ajouter l'URL de production si définie
frontend_url = os.getenv("FRONTEND_URL")
if frontend_url:
    allowed_origins.append(frontend_url if frontend_url.startswith("http") else f"https://{frontend_url}")

# Autoriser dynamiquement les domaines Vercel (preview et production)
vercel_url = os.getenv("VERCEL_URL")
if vercel_url:
    allowed_origins.append(f"https://{vercel_url}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"https?://.*\.vercel\.app", # Autorise tous les sous-domaines Vercel
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- CONFIGURATION FICHIERS STATIQUES ---
# Créer le dossier s'il n'existe pas pour éviter une erreur au démarrage
os.makedirs("uploaded_files", exist_ok=True)
# Monter le dossier pour rendre les fichiers accessibles via l'URL /files/
app.mount("/files", StaticFiles(directory="uploaded_files"), name="files")

@app.get("/")
def read_root():
    return {"message": "Système ACP Invest opérationnel. Tables créées."}

@app.get("/health")
def health_check():
    return {"status": "ok"}

# --- ROUTES AUTHENTIFICATION & UTILISATEURS ---

@app.post("/token", response_model=schemas.Token, tags=["Authentification"])
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = crud.get_user_by_email(db, email=form_data.username)
    if not user or not security.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou mot de passe incorrect",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=security.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = security.create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/users/", response_model=schemas.UserResponse, tags=["Utilisateurs"])
def create_user(user: schemas.UserCreate, db: Session = Depends(get_db), admin_user: models.User = Depends(security.require_role([models.UserRole.ADMIN]))):
    db_user = crud.get_user_by_email(db, email=user.email)
    if db_user:
        raise HTTPException(status_code=400, detail="Cet email est déjà enregistré")
    return crud.create_user(db=db, user=user)

@app.get("/users/", response_model=List[schemas.UserResponse], tags=["Utilisateurs"])
def read_users(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), admin_user: models.User = Depends(security.require_role([models.UserRole.ADMIN]))):
    users = db.query(models.User).offset(skip).limit(limit).all()
    return users

@app.patch("/users/{user_id}", response_model=schemas.UserResponse, tags=["Utilisateurs"])
def update_user_endpoint(user_id: int, user_update: schemas.UserUpdate, db: Session = Depends(get_db), admin_user: models.User = Depends(security.require_role([models.UserRole.ADMIN]))):
    updated_user = crud.update_user(db, user_id, user_update)
    if not updated_user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
    return updated_user

@app.get("/users/me/", response_model=schemas.UserResponse, tags=["Utilisateurs"])
def read_users_me(current_user: models.User = Depends(security.get_current_user)):
    return current_user

# --- ROUTES INVESTISSEURS ---

@app.post("/investors/", response_model=schemas.InvestorResponse, tags=["Investisseurs"])
def create_investor(investor: schemas.InvestorCreate, db: Session = Depends(get_db), current_user: models.User = Depends(security.require_role([models.UserRole.ADMIN, models.UserRole.MANAGER]))):
    db_investor = crud.create_investor(db=db, investor=investor)
    crud.create_audit_log(db, user_id=current_user.id, action="CREATE_INVESTOR", details=f"Création de l'investisseur: {db_investor.name} (ID: {db_investor.id})")
    return db_investor

@app.get("/investors/", response_model=List[schemas.InvestorResponse], tags=["Investisseurs"])
def read_investors(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: models.User = Depends(security.get_current_user)):
    return crud.get_investors(db, skip=skip, limit=limit)

# --- ROUTES PROJETS ---

@app.post("/projects/", response_model=schemas.ProjectResponse, tags=["Projets"])
def create_project(project: schemas.ProjectCreate, db: Session = Depends(get_db), current_user: models.User = Depends(security.require_role([models.UserRole.ADMIN, models.UserRole.MANAGER]))):
    # Vérifier d'abord si l'investisseur existe
    investor = db.query(models.Investor).filter(models.Investor.id == project.investor_id).first()
    if not investor:
        raise HTTPException(status_code=404, detail="Investisseur non trouvé")
    
    db_project = crud.create_project(db=db, project=project)
    crud.create_audit_log(db, user_id=current_user.id, action="CREATE_PROJECT", details=f"Création du projet: {db_project.name} (ID: {db_project.id}) pour l'investisseur {investor.name}")
    return db_project

@app.get("/projects/", response_model=List[schemas.ProjectResponse], tags=["Projets"])
def read_projects(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: models.User = Depends(security.get_current_user)):
    return crud.get_projects(db, skip=skip, limit=limit)

@app.get("/projects/{project_id}", response_model=schemas.ProjectResponse, tags=["Projets"])
def read_project(project_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(security.get_current_user)):
    db_project = crud.get_project(db, project_id=project_id)
    if db_project is None:
        raise HTTPException(status_code=404, detail="Projet non trouvé")
    return db_project

@app.patch("/projects/{project_id}", response_model=schemas.ProjectResponse, tags=["Projets"])
def update_project_status(project_id: int, project_update: schemas.ProjectUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(security.require_role([models.UserRole.ADMIN, models.UserRole.MANAGER]))):
    # Récupérer l'état actuel avant modification pour la traçabilité
    old_project = crud.get_project(db, project_id=project_id)
    if not old_project:
        raise HTTPException(status_code=404, detail="Projet non trouvé")
    
    # Préparation du message de traçabilité en français
    update_details = []
    if project_update.status and project_update.status != old_project.status:
        update_details.append(f"Statut : '{old_project.status.value}' → '{project_update.status.value}'")
    
    if project_update.investment_projected is not None and project_update.investment_projected != old_project.investment_projected:
        update_details.append(f"Inv. projeté : {old_project.investment_projected:,.0f} → {project_update.investment_projected:,.0f} FCFA")

    if project_update.investment_realized is not None and project_update.investment_realized != old_project.investment_realized:
        update_details.append(f"Inv. réalisé : {old_project.investment_realized:,.0f} → {project_update.investment_realized:,.0f} FCFA")

    if project_update.land_area is not None and project_update.land_area != old_project.land_area:
        update_details.append(f"Superficie : {old_project.land_area} → {project_update.land_area} m²")

    details_str = "; ".join(update_details)
    
    # Mise à jour effective
    db_project = crud.update_project(db, project_id=project_id, project_update=project_update)

    # Enregistrement dans l'Audit Log
    crud.create_audit_log(db, user_id=current_user.id, 
                          action="UPDATE_PROJECT", 
                          details=f"L'investisseur '{db_project.investor.name}' a vu son projet '{db_project.name}' modifié : {details_str if details_str else 'Mise à jour des informations générales'}")
    
    return db_project

@app.delete("/projects/{project_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["Projets"])
def delete_project(project_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(security.require_role([models.UserRole.ADMIN, models.UserRole.MANAGER]))):
    project = crud.get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Projet non trouvé")
    
    crud.delete_project(db, project_id)
    crud.create_audit_log(db, user_id=current_user.id, action="DELETE_PROJECT", details=f"Suppression du projet '{project.name}' (ID: {project_id})")
    return None

# --- ROUTES INTERACTIONS ---

@app.post("/interactions/", response_model=schemas.InteractionResponse, tags=["Interactions"])
def create_interaction(interaction: schemas.InteractionCreate, db: Session = Depends(get_db), current_user: models.User = Depends(security.get_current_user)):
    # Vérifier que le projet existe
    project = db.query(models.Project).filter(models.Project.id == interaction.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Projet non trouvé")
    return crud.create_interaction(db=db, interaction=interaction, user_id=current_user.id)

@app.get("/projects/{project_id}/interactions/", response_model=List[schemas.InteractionResponse], tags=["Interactions"])
def read_project_interactions(project_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(security.get_current_user)):
    return crud.get_interactions(db, project_id=project_id)

# --- ROUTES EMPLOI (KPI) ---

@app.post("/projects/{project_id}/employment/", response_model=schemas.EmploymentResponse, tags=["Emploi & KPI"])
def create_employment_data(project_id: int, employment: schemas.EmploymentCreate, db: Session = Depends(get_db), current_user: models.User = Depends(security.require_role([models.UserRole.ADMIN, models.UserRole.MANAGER]))):
    # Vérifier que le projet existe
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Projet non trouvé")
    
    db_employment = crud.create_or_update_employment(db=db, employment=employment, project_id=project_id)
    crud.create_audit_log(db, user_id=current_user.id, action="UPDATE_EMPLOYMENT", details=f"Mise à jour des données d'emploi pour le projet '{project.name}' (ID: {project_id}).")
    return db_employment

@app.get("/projects/{project_id}/employment/", response_model=schemas.EmploymentResponse, tags=["Emploi & KPI"])
def read_employment_data(project_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(security.get_current_user)):
    employment = crud.get_employment(db, project_id=project_id)
    if not employment:
        raise HTTPException(status_code=404, detail="Données d'emploi non trouvées pour ce projet")
    return employment

# --- ROUTES AUDIT LOGS (Admin Only) ---
@app.get("/audit-logs/", response_model=List[schemas.AuditLogResponse], tags=["Administration"])
def read_audit_logs(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), admin_user: models.User = Depends(security.require_role([models.UserRole.ADMIN, models.UserRole.MANAGER]))):
    return crud.get_audit_logs(db, skip=skip, limit=limit)

# --- ROUTES DASHBOARD ---
@app.get("/dashboard/stats", response_model=schemas.DashboardStats, tags=["Dashboard & Reporting"])
def read_dashboard_stats(year: Optional[int] = None, db: Session = Depends(get_db)):
    return crud.get_dashboard_stats(db, year=year)

@app.get("/projects/{project_id}/stats", tags=["Dashboard & Reporting"])
def read_project_stats(project_id: int, year: Optional[int] = None, db: Session = Depends(get_db), current_user: models.User = Depends(security.get_current_user)):
    return crud.get_project_stats(db, project_id=project_id, year=year)

@app.get("/export/projects/excel", tags=["Dashboard & Reporting"])
def export_projects_to_excel(db: Session = Depends(get_db), current_user: models.User = Depends(security.get_current_user)):
    """
    Exporte la liste complète des projets vers un fichier Excel.
    """
    projects = crud.get_projects(db, limit=2000) # Exporter jusqu'à 2000 projets

    # Préparer les données pour l'export
    data_for_export = []
    for p in projects:
        data_for_export.append({
            "Investisseur": p.investor.name if p.investor else "N/A",
            "ID Projet": p.id,
            "Objet Social (Projet)": p.name,
            "Secteur": p.investor.sector if p.investor else "N/A",
            "Origine": p.investor.country if p.investor else "N/A",
            "Statut": p.status.value if p.status else "N/A",
            "Investissement Projeté (FCFA)": p.investment_projected,
            "Investissement Réalisé (FCFA)": p.investment_realized,
            "Total Emplois": p.employment.jobs_created_total if p.employment else 0,
            "Emplois Nationaux": p.employment.jobs_national if p.employment else 0,
            "Emplois Expatriés": p.employment.jobs_expat if p.employment else 0,
            "Description / Remarques": p.description,
            "Date Création": p.created_at.strftime("%Y-%m-%d %H:%M") if p.created_at else None,
            "Dernière Modification": p.updated_at.strftime("%Y-%m-%d %H:%M") if p.updated_at else None,
        })

    df = pd.DataFrame(data_for_export)

    # Créer un fichier Excel en mémoire
    output = io.BytesIO()
    
    try:
        writer = pd.ExcelWriter(output, engine='xlsxwriter')
    except ValueError:
        # Fallback si xlsxwriter n'est pas trouvé mais openpyxl l'est
        writer = pd.ExcelWriter(output, engine='openpyxl')

    with writer:
        df.to_excel(writer, index=False, sheet_name='Projets Détaillés')
        workbook = writer.book
        worksheet = writer.sheets['Projets Détaillés']

        # Format pour les en-têtes
        header_format = workbook.add_format({'bold': True, 'text_wrap': True, 'valign': 'top', 'fg_color': '#D7E4BC', 'border': 1})
        # Format pour les devises
        currency_format = workbook.add_format({'num_format': '#,##0 "FCFA"'})
        # Format pour les nombres
        number_format = workbook.add_format({'num_format': '#,##0'})

        # Appliquer le format aux en-têtes
        for col_num, value in enumerate(df.columns.values):
            worksheet.write(0, col_num, value, header_format)
            # Ajuster la largeur des colonnes
            max_len = max(len(str(value)), df[value].astype(str).map(len).max())
            worksheet.set_column(col_num, col_num, min(max_len + 2, 50)) # Limiter la largeur max à 50
        
        # Appliquer les formats spécifiques aux colonnes
        for col_num, col_name in enumerate(df.columns.values):
            if "FCFA" in col_name:
                worksheet.set_column(col_num, col_num, None, currency_format)
            elif "Emplois" in col_name:
                worksheet.set_column(col_num, col_num, None, number_format)

    output.seek(0)

    headers = {'Content-Disposition': 'attachment; filename="export_projets_acp.xlsx"'}
    return StreamingResponse(output, headers=headers, media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')

@app.get("/export/stats/dashboard/excel", tags=["Dashboard & Reporting"])
def export_dashboard_stats_to_excel(year: Optional[int] = None, db: Session = Depends(get_db), current_user: models.User = Depends(security.get_current_user)):
    """
    Exporte les statistiques globales du tableau de bord vers un fichier Excel.
    """
    stats = crud.get_dashboard_stats(db, year=year)

    output = io.BytesIO()
    try:
        writer = pd.ExcelWriter(output, engine='xlsxwriter')
    except ValueError:
        writer = pd.ExcelWriter(output, engine='openpyxl')

    with writer:
        workbook = writer.book

        # --- Feuille 1: Statistiques Générales ---
        general_stats_data = {
            "Indicateur": [
                "Total Projets", "Total Investisseurs", "Investissement Projeté (FCFA)",
                "Investissement Réalisé (FCFA)", "Emplois Créés", "Emplois Effectifs",
                "Emplois Prévisionnels", "Superficie Totale (m²)", "Total Courriers",
                "Courriers en Attente", "Délai Moyen Traitement Courriers (jours)"
            ],
            "Valeur": [
                stats["total_projects"], stats["total_investors"], stats["total_investment_projected"],
                stats["total_investment_realized"], stats["total_jobs_created"], stats["total_jobs_effective"],
                stats["total_jobs_forecast"], stats["total_land_area"], stats["total_requests"],
                stats["pending_requests"], round(stats["avg_processing_days"], 2)
            ]
        }
        df_general = pd.DataFrame(general_stats_data)
        # On commence à la ligne 5 (index 5) pour laisser de la place au logo et au titre
        df_general.to_excel(writer, index=False, sheet_name='Statistiques Générales', startrow=5)
        worksheet_general = writer.sheets['Statistiques Générales']
        header_format = workbook.add_format({'bold': True, 'text_wrap': True, 'valign': 'top', 'fg_color': '#D7E4BC', 'border': 1})
        currency_format = workbook.add_format({'num_format': '#,##0 "FCFA"'})
        number_format = workbook.add_format({'num_format': '#,##0'})
        title_format = workbook.add_format({'bold': True, 'size': 16, 'font_color': '#1F4E78'})

        # Insertion du logo si le fichier existe
        logo_path = "static/logo_acp.png"
        if os.path.exists(logo_path):
            # x_scale et y_scale ajustent la taille (0.15 = 15% de la taille originale)
            worksheet_general.insert_image('A1', logo_path, {'x_scale': 0.15, 'y_scale': 0.15, 'x_offset': 10, 'y_offset': 10})

        # Ajout d'un titre de rapport
        worksheet_general.write('B2', "RAPPORT ANALYTIQUE DES INVESTISSEMENTS", title_format)
        worksheet_general.write('B3', f"Période : {year if year else 'Global (Toutes années)'}", workbook.add_format({'italic': True}))
        worksheet_general.write('B4', f"Date d'extraction : {datetime.now().strftime('%d/%m/%Y %H:%M')}")

        worksheet_general.set_column('A:A', 30, header_format) # Indicateur
        worksheet_general.set_column('B:B', 20) # Valeur
        worksheet_general.write(5, 0, "Indicateur", header_format)
        worksheet_general.write(5, 1, "Valeur", header_format)
        worksheet_general.set_column('B:B', None, number_format) # Appliquer format nombre par défaut
        worksheet_general.conditional_format('B7:B' + str(len(df_general)+6), {'type': 'cell', 'criteria': '>=', 'value': 0, 'format': currency_format})

        # --- Feuille 2: Projets par Statut ---
        df_status = pd.DataFrame(list(stats["projects_by_status"].items()), columns=['Statut', 'Nombre de Projets'])
        df_status.to_excel(writer, index=False, sheet_name='Projets par Statut')
        worksheet_status = writer.sheets['Projets par Statut']
        worksheet_status.set_column('A:A', 20, header_format)
        worksheet_status.set_column('B:B', 20, header_format)

        # --- Feuille 3: Tendances Mensuelles ---
        df_trends = pd.DataFrame(stats["monthly_trends"])
        df_trends.to_excel(writer, index=False, sheet_name='Tendances Mensuelles')
        worksheet_trends = writer.sheets['Tendances Mensuelles']
        for col_num, value in enumerate(df_trends.columns.values):
            worksheet_trends.write(0, col_num, value, header_format)
            if "investment" in value or "sales" in value:
                worksheet_trends.set_column(col_num, col_num, None, currency_format)
            elif "jobs" in value:
                worksheet_trends.set_column(col_num, col_num, None, number_format)

    output.seek(0)
    filename = f"export_dashboard_stats_{year if year else 'global'}_{datetime.now().strftime('%Y%m%d')}.xlsx"
    headers = {'Content-Disposition': f'attachment; filename="{filename}"'}
    return StreamingResponse(output, headers=headers, media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')


# --- ROUTES DOCUMENTS ---

@app.post("/projects/{project_id}/documents/", response_model=schemas.DocumentResponse, tags=["Documents"])
def upload_document(project_id: int, file: UploadFile = File(...), db: Session = Depends(get_db), current_user: models.User = Depends(security.get_current_user)):
    # 1. Vérifier que le projet existe
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Projet non trouvé")

    # 2. Sauvegarder le fichier sur le disque
    upload_dir = "uploaded_files"
    os.makedirs(upload_dir, exist_ok=True)
    file_location = f"{upload_dir}/{project_id}_{file.filename}"
    
    with open(file_location, "wb+") as file_object:
        shutil.copyfileobj(file.file, file_object)

    # 3. Enregistrer les infos en base de données
    crud.create_audit_log(db, user_id=current_user.id, action="UPLOAD_DOCUMENT", details=f"Téléversement du document '{file.filename}' pour le projet '{project.name}' (ID: {project_id}).")
    doc_data = {"project_id": project_id, "name": file.filename, "file_path": file_location}
    return crud.create_document(db, doc_data)

@app.get("/projects/{project_id}/documents/", response_model=List[schemas.DocumentResponse], tags=["Documents"])
def read_project_documents(project_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(security.get_current_user)):
    return crud.get_project_documents(db, project_id)

# --- ROUTES COURRIERS (Requests) ---
@app.post("/requests/", response_model=schemas.RequestResponse, tags=["Courriers"])
def create_request_endpoint(request: schemas.RequestCreate, db: Session = Depends(get_db), current_user: models.User = Depends(security.require_role([models.UserRole.ADMIN, models.UserRole.MANAGER]))):
    # Charger le projet et l'investisseur pour le log
    project = db.query(models.Project).options(joinedload(models.Project.investor)).filter(models.Project.id == request.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Projet non trouvé")
    
    db_request = crud.create_request(db=db, request=request)
    investor_name = project.investor.name if project.investor else "Inconnu"
    crud.create_audit_log(db, user_id=current_user.id, action="CREATE_REQUEST", details=f"Nouvelle demande enregistrée pour l'investisseur '{investor_name}' (Projet: {project.name}). Sujet: {request.subject}")
    return db_request

@app.get("/requests/", response_model=List[schemas.RequestResponse], tags=["Courriers"])
def read_requests(
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = None,
    project_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user)
):
    return crud.get_requests(db, skip=skip, limit=limit, status=status, project_id=project_id)

@app.patch("/requests/{request_id}/status", response_model=schemas.RequestResponse, tags=["Courriers"])
def update_request_status_endpoint(request_id: int, new_status: models.RequestStatus, db: Session = Depends(get_db), current_user: models.User = Depends(security.require_role([models.UserRole.ADMIN, models.UserRole.MANAGER]))):
    # Récupérer la demande avec les infos projet/investisseur avant mise à jour
    db_request = db.query(models.Request).options(joinedload(models.Request.project).joinedload(models.Project.investor)).filter(models.Request.id == request_id).first()
    if db_request is None:
        raise HTTPException(status_code=404, detail="Demande non trouvée")
    
    old_status = db_request.status.value
    updated_request = crud.update_request_status(db, request_id, new_status)
    
    investor_name = db_request.project.investor.name if db_request.project and db_request.project.investor else "Inconnu"
    crud.create_audit_log(db, user_id=current_user.id, action="UPDATE_REQUEST_STATUS", details=f"Demande de l'investisseur '{investor_name}' mise à jour : Statut '{old_status}' → '{new_status.value}' (Sujet: {db_request.subject})")
    return updated_request

@app.get("/export/courriers/excel", tags=["Courriers"])
def export_requests_to_excel(db: Session = Depends(get_db), current_user: models.User = Depends(security.get_current_user)):
    """
    Exporte la liste complète des demandes (courriers) vers un fichier Excel.
    """
    requests = db.query(models.Request).options(joinedload(models.Request.project).joinedload(models.Project.investor)).order_by(models.Request.id.asc()).all()

    # Préparer les données pour l'export
    data_for_export = []
    for req in requests:
        investor_name = req.project.investor.name if req.project and req.project.investor else "N/A"
        project_name = req.project.name if req.project else "N/A"

        data_for_export.append({
            "Investisseur": investor_name,
            "ID Courrier": req.id,
            "Projet Associé": project_name,
            "Sujet": req.subject,
            "Description": req.description,
            "Statut": req.status.value,
            "Date Réception": req.received_at.strftime("%Y-%m-%d %H:%M") if req.received_at else None,
            "Date Traitement": req.processed_at.strftime("%Y-%m-%d %H:%M") if req.processed_at else None,
        })

    df = pd.DataFrame(data_for_export)

    # Créer un fichier Excel en mémoire
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='xlsxwriter') as writer:
        df.to_excel(writer, index=False, sheet_name='Courriers Détaillés')
        workbook = writer.book
        worksheet = writer.sheets['Courriers Détaillés']
        header_format = workbook.add_format({'bold': True, 'text_wrap': True, 'valign': 'top', 'fg_color': '#D7E4BC', 'border': 1, 'align': 'center'})
        for col_num, value in enumerate(df.columns.values):
            worksheet.write(0, col_num, value, header_format)
            worksheet.set_column(col_num, col_num, min(max(len(str(value)), df[value].astype(str).map(len).max() if not df[value].empty else 0) + 2, 50))

    output.seek(0)

    headers = {'Content-Disposition': 'attachment; filename="export_courriers_acp.xlsx"'}
    return StreamingResponse(output, headers=headers, media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')