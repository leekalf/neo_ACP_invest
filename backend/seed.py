# -*- coding: utf-8 -*-
import os
# SOLUTION WINDOWS : On force la librairie PostgreSQL (libpq) à utiliser l'UTF-8 
# AVANT même d'importer la base de données. Cela corrige l'erreur "codec can't decode byte 0xe9".
os.environ["PGCLIENTENCODING"] = "utf8"
import random

import logging
from sqlalchemy.orm import Session
from sqlalchemy import text, func
from datetime import datetime, timedelta
from database import SessionLocal, engine
import crud, models, schemas
from models import ProjectStatus

# Configuration du logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def get_status_enum(status_text: str):
    s = status_text.lower().strip()
    if s == "en activités":
        return ProjectStatus.EN_ACTIVITE
    elif s == "en cours":
        return ProjectStatus.EN_COURS
    elif s == "suspendus":
        return ProjectStatus.SUSPENDU
    elif s == "en attentes":
        return ProjectStatus.EN_ATTENTE
    # Fallback pour d'anciennes données qui pourraient juste avoir "activité"
    elif "activité" in s:
        return ProjectStatus.EN_ACTIVITE
    return ProjectStatus.EN_ATTENTE

def clear_data(db: Session):
    """Supprime toutes les données des tables Projet et Investisseur."""
    logger.info("--- REINITIALISATION COMPLETE DU SCHEMA ---")
    # Pour corriger l'erreur de colonne manquante, on supprime et recrée tout.
    # En développement, c'est le plus simple pour synchroniser le modèle et la DB.
    try:
        models.Base.metadata.drop_all(bind=engine)
        models.Base.metadata.create_all(bind=engine)
    except Exception as e:
        logger.error(f"Erreur lors de la réinitialisation : {e}")

    logger.info("--- DONNEES SUPPRIMEES ---")

def seed_data():
    db = SessionLocal()
    try:
        # Vider la base de données avant de la peupler
        # Commentez la ligne suivante si vous ne voulez pas vider la base à chaque fois
        clear_data(db)

        # Créer l'administrateur par défaut pour ne pas perdre l'accès après le reset
        admin_email = "admin@acp.tg"
        if not crud.get_user_by_email(db, admin_email):
            logger.info(f"Création de l'admin par défaut: {admin_email}")
            crud.create_user(db, schemas.UserCreate(
                email=admin_email,
                password="admin123",
                full_name="Administrateur Système",
                role=models.UserRole.ADMIN
            ))

        logger.info("--- DEBUT DU PEUPLEMENT DE LA BASE DE DONNEES ---")

        # Liste de 10 entreprises avec des données variées pour les tests
        projects_data = [
            {
                "investor": {"name": "Beauté d'Afrique", "country": "Nigérian", "sector": "Cosmétique"},
                "project": {
                    "name": "Production de produits de beauté bio",
                    "investment_projected": 1500000000,
                    "investment_realized": 500000000,
                    "status": "en cours",
                    "land_area": 5000,
                    "description": "Responsable: Mme Adaeze Okoro\nContact: contact@beauteafrique.ng\nCapacité: 10,000 unités/mois\nTypes produits: Savons, lotions, huiles corporelles\nAgrément: Code des investissements\nCalendrier: Démarrage installation 01/03/2024\nRemarques: En attente de la livraison des équipements."
                },
                "employment": {"jobs_forecast": 150, "jobs_created": 45, "jobs_national": 40, "jobs_expat": 5, "jobs_men": 15, "jobs_women": 30}
            },
            {
                "investor": {"name": "LogiTogo Express", "country": "Togolais", "sector": "Logistique"},
                "project": {
                    "name": "Plateforme de logistique et d'entreposage",
                    "investment_projected": 2500000000,
                    "investment_realized": 0,
                    "status": "en attentes",
                    "land_area": 20000,
                    "description": "Responsable: M. Kodjo Agbessi\nContact: info@logitogo.tg\nRemarques: Dossier de demande d'agrément déposé. En attente de validation."
                },
                "employment": {"jobs_forecast": 200, "jobs_created": 0, "jobs_national": 0, "jobs_expat": 0}
            },
            {
                "investor": {"name": "Safari Dreams", "country": "Sud-Africain", "sector": "Tourisme"},
                "project": {
                    "name": "Construction d'un complexe hôtelier écologique",
                    "investment_projected": 7000000000,
                    "investment_realized": 1200000000,
                    "status": "suspendus",
                    "land_area": 50000,
                    "description": "Responsable: Mr. Van der Merwe\nContact: projects@safaridreams.za\nRemarques: Projet suspendu suite à une réévaluation de la stratégie du groupe. Les fondations ont été coulées."
                },
                "employment": {"jobs_forecast": 350, "jobs_created": 25, "jobs_national": 25, "jobs_expat": 0}
            },
            {
                "investor": {"name": "Sonne Energie GmbH", "country": "Allemand", "sector": "Énergie Solaire"},
                "project": {
                    "name": "Centrale solaire de 10MW",
                    "investment_projected": 15000000000,
                    "investment_realized": 9500000000,
                    "status": "en activités",
                    "land_area": 150000,
                    "description": "Responsable: Dr. Klaus Richter\nContact: togo-project@sonne.de\nCapacité: 10 MW\nTypes produits: Électricité\nAgrément: Droit commun\nCalendrier: Début 01/06/2023\nRemarques: Opérationnelle depuis juin 2023. Phase 2 en étude."
                },
                "employment": {"jobs_forecast": 80, "jobs_created": 110, "jobs_national": 100, "jobs_expat": 10, "jobs_men": 85, "jobs_women": 25}
            },
            {
                "investor": {"name": "Fintech Innovators Inc.", "country": "Américain", "sector": "Fintech"},
                "project": {
                    "name": "Développement d'une application de paiement mobile",
                    "investment_projected": 5000000000,
                    "investment_realized": 1000000000,
                    "status": "en cours",
                    "land_area": 500,
                    "description": "Responsable: Jane Doe\nContact: j.doe@fintechinno.com\nTypes produits: Application mobile, services financiers digitaux\nAgrément: N/A\nCalendrier: Lancement prévu Q4 2024\nPosition: Hub digital de Lomé\nRemarques: L'équipe de développement est en place. La phase de test beta est prévue pour bientôt. Le projet vise à digitaliser les paiements pour les petits commerçants en Afrique de l'Ouest, en commençant par le Togo. La solution intégrera des fonctionnalités de micro-crédit et d'épargne."
                },
                "employment": {"jobs_forecast": 120, "jobs_created": 30, "jobs_national": 25, "jobs_expat": 5, "jobs_men": 20, "jobs_women": 10}
            },
            {
                "investor": {"name": "Educa+", "country": "Canadien", "sector": "Éducation"},
                "project": {
                    "name": "Plateforme d'e-learning",
                    "investment_projected": 800000000,
                    "investment_realized": 0,
                    "status": "en attentes",
                    "land_area": 0,
                    "description": "Responsable: M. Tremblay"
                },
                "employment": {"jobs_forecast": 50}
            },
            {
                "investor": {"name": "Recycle Pro", "country": "Belge", "sector": "Recyclage"},
                "project": {
                    "name": "Unité de recyclage de déchets plastiques",
                    "investment_projected": 4500000000,
                    "investment_realized": 4800000000,
                    "status": "en activités",
                    "land_area": 15000,
                    "description": "Responsable: Mme. Dubois\nContact: info@recyclepro.be\nCapacité: 20 tonnes/jour\nTypes produits: Granulés de plastique recyclé\nAgrément: Zone franche\nCalendrier: Début 01/01/2024\nRemarques: Forte demande pour les granulés."
                },
                "employment": {"jobs_forecast": 250, "jobs_created": 310, "jobs_national": 300, "jobs_expat": 10, "jobs_men": 200, "jobs_women": 110}
            },
            {
                "investor": {"name": "Ghana Fish Co.", "country": "Ghanéen", "sector": "Pêche"},
                "project": {
                    "name": "Installation d'une chaîne de froid pour produits de la mer",
                    "investment_projected": 2000000000,
                    "investment_realized": 0,
                    "status": "suspendus",
                    "land_area": 0,
                    "description": "Responsable: Mr. Osei\nRemarques: Projet suspendu en raison de difficultés d'approvisionnement."
                },
                "employment": {"jobs_forecast": 100}
            },
            {
                "investor": {"name": "Bati-Togo SARL", "country": "Turc", "sector": "Construction"},
                "project": {
                    "name": "Production de matériaux de construction préfabriqués",
                    "investment_projected": 3000000000,
                    "investment_realized": 3500000000,
                    "status": "en activités",
                    "land_area": 12000,
                    "description": "Responsable: M. Yilmaz\nContact: contact@batitogo.com\nTypes produits: Panneaux de béton, poutres\nAgrément: Code des investissements\nCalendrier: Début 2022\nRemarques: Dépassement du budget initial dû à l'extension de la ligne de production."
                },
                "employment": {"jobs_forecast": 180, "jobs_created": 220, "jobs_national": 210, "jobs_expat": 10, "jobs_men": 190, "jobs_women": 30}
            },
            {
                "investor": {"name": "Les Fermes du Zio", "country": "Togolais", "sector": "Agro-industrie"},
                "project": {
                    "name": "Unité de transformation de manioc en Gari et Tapioca",
                    "investment_projected": 950000000,
                    "investment_realized": 300000000,
                    "status": "en cours",
                    "land_area": 8000,
                    "description": "Responsable: Mme Amouzou\nContact: fermesduzio@local.tg\nMatières premières: Manioc\nCapacité: 5 tonnes/jour\nTypes produits: Gari, Tapioca\nAgrément: Droit commun\nCalendrier: Installation en cours\nRemarques: Partenariat avec des coopératives de producteurs locaux."
                },
                "employment": {"jobs_forecast": 80, "jobs_created": 15, "jobs_national": 15, "jobs_expat": 0, "jobs_men": 5, "jobs_women": 10}
            }
        ]

        for item in projects_data:
            # 1. Investisseur
            inv_data = item["investor"]
            investor = crud.get_investor_by_name(db, inv_data["name"])
            if not investor:
                logger.info(f"Création investisseur: {inv_data['name']}")
                investor = crud.create_investor(db, schemas.InvestorCreate(**inv_data))
            
            # 2. Projet
            proj_data = item["project"]
            existing_project = db.query(models.Project).filter(
                models.Project.name == proj_data["name"],
                models.Project.investor_id == investor.id
            ).first()
            
            if not existing_project:
                logger.info(f"Création projet: {proj_data['name']}")
                project_schema = schemas.ProjectCreate(
                    name=proj_data["name"],
                    investor_id=investor.id,
                    investment_projected=proj_data.get("investment_projected", 0),
                    investment_realized=proj_data.get("investment_realized", 0),
                    status=get_status_enum(proj_data["status"]),
                    description=proj_data.get("description", ""),
                    land_area=proj_data.get("land_area", 0)
                )
                project = crud.create_project(db, project_schema)
                
                # 3. Emploi
                emp_data = item.get("employment", {}) # Use .get for safety
                if emp_data:
                    employment_schema = schemas.EmploymentCreate(
                        jobs_created_total=emp_data.get("jobs_created", 0),
                        jobs_expat=emp_data.get("jobs_expat", 0),
                        jobs_national=emp_data.get("jobs_national", 0),
                        jobs_forecast=emp_data.get("jobs_forecast", 0),
                        jobs_men=emp_data.get("jobs_men", 0),
                        jobs_women=emp_data.get("jobs_women", 0),
                        jobs_effective=emp_data.get("jobs_created", 0)
                    )
                    crud.create_or_update_employment(db, employment_schema, project.id)

                # 4. Génération d'Historique Mensuel (sur 2024 et 2025)
                if proj_data["status"] == "en activités":
                    # Générer 18 mois de données se terminant à la date actuelle (ex: 2026)
                    now = datetime.now()
                    for i in range(18, -1, -1):
                        date_point = now - timedelta(days=i*30)
                        
                        # Progression de base (0 à 100%)
                        progress = (20 - i) / 20 
                        
                        # --- RÉALISME ACCRU ---
                        # Chiffre d'affaires : Très volatile + creux saisonnier aléatoire
                        seasonal_factor = 1.0 + (0.5 * random.uniform(-1, 1))
                        sales_volatility = random.uniform(0.5, 1.5) * seasonal_factor
                        
                        # Emplois : Fluctuations modérées (simule recrutements et départs)
                        jobs_volatility = random.uniform(0.9, 1.1)
                        # Investissement : Reste cumulatif mais avec des paliers irréguliers
                        inv_volatility = random.uniform(0.95, 1.05)

                        crud.create_monthly_record(db, {
                            "project_id": project.id,
                            "record_date": date_point,
                            "investment_realized": min(project.investment_realized, project.investment_realized * progress * inv_volatility),
                            "total_sales": (project.investment_realized * 0.05) * sales_volatility, 
                            "jobs_effective": int(employment_schema.jobs_effective * progress * jobs_volatility),
                            "jobs_national": int(employment_schema.jobs_national * progress * jobs_volatility),
                            "jobs_expat": employment_schema.jobs_expat,
                            "jobs_men": int(employment_schema.jobs_men * progress * jobs_volatility),
                            "jobs_women": int(employment_schema.jobs_women * progress * jobs_volatility)
                        })

            else:
                logger.info(f"Projet déjà existant: {proj_data['name']}")

        logger.info("--- PEUPLEMENT TERMINE ---")

    except Exception as e:
        logger.error(f"Erreur lors du peuplement: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_data()