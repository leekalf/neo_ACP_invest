import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { AppBar, Toolbar, Typography, Container, Box, Paper, Button, Grid, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Alert, MenuItem, Select, InputLabel, FormControl, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, IconButton, List, ListItem, ListItemText, Divider, InputAdornment, Badge, LinearProgress, Stepper, Step, StepLabel, Menu } from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import AddIcon from '@mui/icons-material/Add';
import GroupIcon from '@mui/icons-material/Group';
import WorkIcon from '@mui/icons-material/Work';
import EuroIcon from '@mui/icons-material/Euro';
import LandscapeIcon from '@mui/icons-material/Landscape';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import EmailIcon from '@mui/icons-material/Email';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import PauseCircleIcon from '@mui/icons-material/PauseCircle';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import DownloadIcon from '@mui/icons-material/Download';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, BarChart, Bar } from 'recharts';
import HistoryIcon from '@mui/icons-material/History';
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts';
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SearchIcon from '@mui/icons-material/Search';
import ListAltIcon from '@mui/icons-material/ListAlt'; // Nouvelle icône pour les courriers
import { Routes, Route, Link, useParams, useNavigate, useSearchParams } from 'react-router-dom';

// Configuration de l'URL de l'API (Locale par défaut, ou URL Render)
const CURRENT_YEAR = new Date().getFullYear();
const START_YEAR = 2024; // L'année de lancement du système
const AVAILABLE_YEARS = Array.from({ length: CURRENT_YEAR - START_YEAR + 1 }, (_, i) => START_YEAR + i);

// Un composant réutilisable pour afficher une carte de statistique
function StatCard({ title, value, icon, linkTo, progress }) {
  const cardContent = (
    <Paper 
      elevation={3} 
      sx={{ 
        p: 3, 
        display: 'flex', 
        alignItems: 'center', 
        height: '100%',
        transition: 'transform 0.2s, box-shadow 0.2s',
        '&:hover': linkTo ? {
          transform: 'scale(1.03)',
          boxShadow: 6,
          cursor: 'pointer',
        } : {}
      }}
    >
      {icon}
      <Box sx={{ ml: 2, flexGrow: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Typography variant="h5" component="div" fontWeight="bold">
            {value}
          </Typography>
          {progress !== undefined && (
            <Typography variant="caption" sx={{ fontWeight: 'bold', color: progress > 80 ? 'success.main' : 'warning.main' }}>{Math.round(progress)}%</Typography>
          )}
        </Box>
        <Typography color="text.secondary" variant="body2">{title}</Typography>
        {progress !== undefined && (
          <LinearProgress variant="determinate" value={Math.min(progress, 100)} sx={{ mt: 1, height: 6, borderRadius: 3, bgcolor: 'grey.200' }} color={progress > 70 ? "success" : "primary"} />
        )}
      </Box>
    </Paper>
  );

  if (linkTo) {
    return (
      <Link to={linkTo} style={{ textDecoration: 'none' }}>
        {cardContent}
      </Link>
    );
  }
  return cardContent;
}

// Composant de dialogue pour la connexion
function LoginDialog({ open, onClose, onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setError('');
    try {
      // Le backend attend un format form-urlencoded pour OAuth2
      const formData = new URLSearchParams();
      formData.append('username', email); // OAuth2 utilise 'username' même pour un email
      formData.append('password', password);

      const response = await axios.post(`${API_URL}/token`, formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      
      onLogin(response.data.access_token);
      onClose();
    } catch (err) {
      console.error(err);
      if (err.response && err.response.status === 401) {
        setError('Mot de passe incorrect. (Défaut : admin@acp.tg / admin123)');
      } else if (err.code === "ERR_NETWORK" || !err.response) {
        setError('Serveur inaccessible ou bloqué (CORS). Vérifiez la console du Backend et l\'adresse (localhost vs 127.0.0.1).');
      } else {
        setError(`Erreur technique : ${err.message || 'Inconnue'}`);
      }
    }
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Connexion Administrateur</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2, mt: 1 }}>{error}</Alert>}
        <TextField autoFocus margin="dense" label="Email" type="email" fullWidth variant="outlined" value={email} onChange={(e) => setEmail(e.target.value)} />
        <TextField margin="dense" label="Mot de passe" type="password" fullWidth variant="outlined" value={password} onChange={(e) => setPassword(e.target.value)} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Annuler</Button>
        <Button onClick={handleSubmit} variant="contained">Se connecter</Button>
      </DialogActions>
    </Dialog>
  );
}

// Composant de formulaire pour ajouter ou modifier un projet
function ProjectFormDialog({ open, onClose, onSuccess, token, initialData }) {
  const [formData, setFormData] = useState({
    // 1. Identité Investisseur
    investor_name: '', // Investisseurs
    responsible_name: '', // Nom du responsable
    investor_origin: '', // Origine
    contact_name: '', // Contact
    email: '', // Email
    contact_secondary: '', // Contact secondaire
    phone: '', // Téléphone

    // 2. Investissement & Ventes
    investment_projected: '', // Investissement Prévisionnel
    investment_realized: '', // Investissement Réalisé
    total_sales: '', // Vente Totale
    local_sales: '', // Vente Locale
    external_sales: '', // Vente Extérieure

    // 3. Caractéristiques Projet
    land_area: '', // Superficie du terrain
    social_object: '', // Objet social
    investor_sector: '', // Secteur d’activité
    raw_materials: '', // Matières premières
    production_capacity: '', // Capacité de production
    product_types: '', // Types de produits

    // 4. Statut & Calendrier
    status: 'en attentes', // État actuel
    agreement_request: '', // Demande d’agrément
    agreement_date: '', // Date d’agrément
    agreement_type: '', // Type d’agrément
    installation_start: '', // Démarrage installation
    activity_launch: '', // Lancement activité
    export_share: '', // Export
    local_sales_share: '', // Vente locale (Part)
    position: '', // Position
    creation_date: '', // Date de création
    activity_start: '', // Début d’activité

    // 5. Emploi
    jobs_forecast: '', // Emplois prévisionnels
    jobs_created: '', // Emplois créés
    jobs_effective: '', // Emplois effectifs
    jobs_expat: '', // Expatriés
    jobs_national: '', // Nationaux
    jobs_men: '', // Hommes
    jobs_women: '', // Femmes

    // 6. Divers
    remarks: '' // Remarques
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Remplir le formulaire si on est en mode édition
  useEffect(() => {
    if (initialData) {
      setFormData({
        ...formData, // Start with a clean slate
        social_object: initialData.name || '',
        status: initialData.status || 'en attentes',
        investment_projected: initialData.investment_projected || '',
        investment_realized: initialData.investment_realized || '',
        investor_name: initialData.investor?.name || '',
        investor_origin: initialData.investor?.country || '',
        investor_sector: initialData.investor?.sector || '',
        jobs_created: initialData.employment?.jobs_created_total || '',
        jobs_national: initialData.employment?.jobs_national || '',
        jobs_expat: initialData.employment?.jobs_expat || '',
        land_area: initialData.land_area || '', // Ajout
        jobs_forecast: initialData.employment?.jobs_forecast || '', // Ajout
        remarks: initialData.description || ''
      });
    } else {
      // Reset pour nouveau dossier
      setFormData({
        investor_name: '', responsible_name: '', investor_origin: '', contact_name: '', email: '', contact_secondary: '', phone: '',
        investment_projected: '', investment_realized: '', total_sales: '', local_sales: '', external_sales: '',
        land_area: '', social_object: '', investor_sector: '', raw_materials: '', production_capacity: '', product_types: '',
        status: 'en attentes', agreement_request: '', agreement_date: '', agreement_type: '', installation_start: '', activity_launch: '', export_share: '', local_sales_share: '', position: '', creation_date: '', activity_start: '',
        jobs_forecast: '', jobs_created: '', jobs_effective: '', jobs_expat: '', jobs_national: '', jobs_men: '', jobs_women: '',
        remarks: ''
      });
    }
  }, [initialData, open]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } }; // Token

      const fullDescription = `
Responsable: ${formData.responsible_name}
Contact: ${formData.contact_name} | Email: ${formData.email} | Tél: ${formData.phone}
Contact Secondaire: ${formData.contact_secondary}
Superficie: ${formData.land_area}
Matières premières: ${formData.raw_materials}
Capacité: ${formData.production_capacity}
Types produits: ${formData.product_types}
Ventes (Tot/Loc/Ext): ${formData.total_sales} / ${formData.local_sales} / ${formData.external_sales}
Export/Vente Locale (Parts): ${formData.export_share} / ${formData.local_sales_share}
Agrément: ${formData.agreement_type} (Demande: ${formData.agreement_request}, Date: ${formData.agreement_date})
Calendrier: Install: ${formData.installation_start}, Lancement: ${formData.activity_launch}, Création: ${formData.creation_date}, Début: ${formData.activity_start}
Position: ${formData.position}
Emplois (Prév/Eff): ${formData.jobs_forecast} / ${formData.jobs_effective}
Genre (H/F): ${formData.jobs_men} / ${formData.jobs_women}
Remarques: ${formData.remarks}
      `.trim();

      if (initialData) {
        // --- MODE MODIFICATION ---
        await axios.patch(`${API_URL}/projects/${initialData.id}`, {
          status: formData.status,
          description: fullDescription,
          investment_projected: parseFloat(formData.investment_projected) || 0,
          investment_realized: parseFloat(formData.investment_realized) || 0,
          land_area: parseFloat(formData.land_area) || 0,
        }, config);

        await axios.post(`${API_URL}/projects/${initialData.id}/employment/`, {
          jobs_created_total: parseInt(formData.jobs_created) || 0,
          jobs_expat: parseInt(formData.jobs_expat) || 0,
          jobs_national: parseInt(formData.jobs_national) || 0,
          jobs_effective: parseInt(formData.jobs_effective) || 0,
          jobs_forecast: parseInt(formData.jobs_forecast) || 0,
        }, config);

      } else {
        // --- MODE CRÉATION ---
        const invRes = await axios.post(`${API_URL}/investors/`, {
          name: formData.investor_name,
          country: formData.investor_origin,
          sector: formData.investor_sector
        }, config);
        const investorId = invRes.data.id;

        const projRes = await axios.post(`${API_URL}/projects/`, {
          name: formData.social_object,
          investor_id: investorId,
          investment_projected: parseFloat(formData.investment_projected) || 0,
          investment_realized: parseFloat(formData.investment_realized) || 0,
          status: formData.status,
          description: fullDescription,
          land_area: parseFloat(formData.land_area) || 0
        }, config);
        const projectId = projRes.data.id;

        await axios.post(`${API_URL}/projects/${projectId}/employment/`, {
          jobs_created_total: parseInt(formData.jobs_created) || 0,
          jobs_expat: parseInt(formData.jobs_expat) || 0,
          jobs_national: parseInt(formData.jobs_national) || 0,
          jobs_effective: parseInt(formData.jobs_effective) || 0,
          jobs_forecast: parseInt(formData.jobs_forecast) || 0
        }, config);
      }

      onSuccess();
      onClose();
    } catch (err) {
      console.error("Erreur lors de la soumission:", err.response || err);
      let errorMessage = "Erreur inconnue";
      if (err.response?.data?.detail) {
        const detail = err.response.data.detail;
        if (Array.isArray(detail)) {
          // Erreur de validation de FastAPI/Pydantic
          errorMessage = detail.map(e => `Champ '${e.loc[e.loc.length - 1]}': ${e.msg}`).join('; ');
        } else if (typeof detail === 'object') {
            // Autre type d'erreur objet
            errorMessage = JSON.stringify(detail);
        } else {
          // Erreur simple (chaîne de caractères)
          errorMessage = detail;
        }
      } else if (err.message) {
        errorMessage = err.message;
      }
      setError(`Erreur : ${errorMessage}. Vérifiez les champs ou votre connexion.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>{initialData ? "Modifier le Dossier" : "Nouveau Dossier (Fiche Détaillée)"}</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        
        {/* SECTION 1: IDENTITÉ */}
        <Typography variant="subtitle1" sx={{ mt: 2, mb: 1, fontWeight: 'bold', color: 'primary.main', borderBottom: 1, borderColor: 'divider' }}>1. Identité & Contacts</Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}><TextField label="Investisseurs" name="investor_name" fullWidth required value={formData.investor_name} onChange={handleChange} disabled={!!initialData} helperText={initialData ? "Non modifiable ici" : ""} /></Grid>
          <Grid item xs={12} md={4}><TextField label="Nom du responsable" name="responsible_name" fullWidth value={formData.responsible_name} onChange={handleChange} /></Grid>
          <Grid item xs={12} md={4}><TextField label="Origine" name="investor_origin" fullWidth value={formData.investor_origin} onChange={handleChange} /></Grid>
          
          <Grid item xs={12} md={3}><TextField label="Contact" name="contact_name" fullWidth value={formData.contact_name} onChange={handleChange} /></Grid>
          <Grid item xs={12} md={3}><TextField label="Email" name="email" fullWidth value={formData.email} onChange={handleChange} /></Grid>
          <Grid item xs={12} md={3}><TextField label="Contact secondaire" name="contact_secondary" fullWidth value={formData.contact_secondary} onChange={handleChange} /></Grid>
          <Grid item xs={12} md={3}><TextField label="Téléphone" name="phone" fullWidth value={formData.phone} onChange={handleChange} /></Grid>
        </Grid>

        {/* SECTION 2: PROJET & ACTIVITÉ */}
        <Typography variant="subtitle1" sx={{ mt: 3, mb: 1, fontWeight: 'bold', color: 'primary.main', borderBottom: 1, borderColor: 'divider' }}>2. Caractéristiques du Projet</Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}><TextField label="Objet social (Nom du Projet)" name="social_object" fullWidth value={formData.social_object} onChange={handleChange} disabled={!!initialData} /></Grid>
          <Grid item xs={12} md={3}><TextField label="Secteur d'Activité" name="investor_sector" fullWidth value={formData.investor_sector} onChange={handleChange} /></Grid>
          <Grid item xs={12} md={3}><TextField label="Superficie du terrain" name="land_area" fullWidth value={formData.land_area} onChange={handleChange} /></Grid>
          <Grid item xs={12} md={4}><TextField label="Matières premières" name="raw_materials" fullWidth value={formData.raw_materials} onChange={handleChange} /></Grid>
          <Grid item xs={12} md={4}><TextField label="Capacité de production" name="production_capacity" fullWidth value={formData.production_capacity} onChange={handleChange} /></Grid>
          <Grid item xs={12} md={4}><TextField label="Types de produits" name="product_types" fullWidth value={formData.product_types} onChange={handleChange} /></Grid>
        </Grid>

        {/* SECTION 3: INVESTISSEMENT & STATUT */}
        <Typography variant="subtitle1" sx={{ mt: 3, mb: 1, fontWeight: 'bold', color: 'primary.main', borderBottom: 1, borderColor: 'divider' }}>3. Investissement & Ventes</Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}><TextField label="Investissement Prévisionnel" name="investment_projected" type="number" fullWidth value={formData.investment_projected} onChange={handleChange} /></Grid>
          <Grid item xs={12} md={4}><TextField label="Investissement Réalisé" name="investment_realized" type="number" fullWidth value={formData.investment_realized} onChange={handleChange} /></Grid>
          <Grid item xs={12} md={4}><TextField label="Vente Totale" name="total_sales" fullWidth value={formData.total_sales} onChange={handleChange} /></Grid>
          <Grid item xs={12} md={6}><TextField label="Vente Locale" name="local_sales" fullWidth value={formData.local_sales} onChange={handleChange} /></Grid>
          <Grid item xs={12} md={6}><TextField label="Vente Extérieure" name="external_sales" fullWidth value={formData.external_sales} onChange={handleChange} /></Grid>
        </Grid>

        {/* SECTION 4: CALENDRIER & AGRÉMENT */}
        <Typography variant="subtitle1" sx={{ mt: 3, mb: 1, fontWeight: 'bold', color: 'primary.main', borderBottom: 1, borderColor: 'divider' }}>4. Statut, Agrément & Calendrier</Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <FormControl fullWidth>
              <InputLabel>État Actuel</InputLabel>
              <Select name="status" value={formData.status} label="État Actuel" onChange={handleChange}>
                <MenuItem value="en attentes">En attente</MenuItem>
                <MenuItem value="en cours">En cours</MenuItem>
                <MenuItem value="en activités">En activité</MenuItem>
                <MenuItem value="suspendus">Suspendu</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={4}><TextField label="Demande d’agrément" name="agreement_request" fullWidth value={formData.agreement_request} onChange={handleChange} /></Grid>
          <Grid item xs={12} md={4}><TextField label="Date d’agrément" name="agreement_date" placeholder="JJ/MM/AAAA" fullWidth value={formData.agreement_date} onChange={handleChange} /></Grid>
          <Grid item xs={12} md={4}><TextField label="Type d’agrément" name="agreement_type" fullWidth value={formData.agreement_type} onChange={handleChange} /></Grid>
          
          <Grid item xs={12} md={4}><TextField label="Démarrage installation" name="installation_start" placeholder="JJ/MM/AAAA" fullWidth value={formData.installation_start} onChange={handleChange} /></Grid>
          <Grid item xs={12} md={4}><TextField label="Lancement activité" name="activity_launch" placeholder="JJ/MM/AAAA" fullWidth value={formData.activity_launch} onChange={handleChange} /></Grid>
          <Grid item xs={12} md={4}><TextField label="Date de création" name="creation_date" placeholder="JJ/MM/AAAA" fullWidth value={formData.creation_date} onChange={handleChange} /></Grid>
          <Grid item xs={12} md={4}><TextField label="Début d’activité" name="activity_start" placeholder="JJ/MM/AAAA" fullWidth value={formData.activity_start} onChange={handleChange} /></Grid>
          
          <Grid item xs={12} md={4}><TextField label="Export" name="export_share" fullWidth value={formData.export_share} onChange={handleChange} /></Grid>
          <Grid item xs={12} md={4}><TextField label="Vente locale (Part)" name="local_sales_share" fullWidth value={formData.local_sales_share} onChange={handleChange} /></Grid>
          <Grid item xs={12} md={4}><TextField label="Position" name="position" fullWidth value={formData.position} onChange={handleChange} /></Grid>
        </Grid>

        {/* SECTION 5: RH & DIVERS */}
        <Typography variant="subtitle1" sx={{ mt: 3, mb: 1, fontWeight: 'bold', color: 'primary.main', borderBottom: 1, borderColor: 'divider' }}>5. Emplois & Divers</Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={3}><TextField label="Emplois prévisionnels" name="jobs_forecast" type="number" fullWidth value={formData.jobs_forecast} onChange={handleChange} /></Grid>
          <Grid item xs={12} md={3}><TextField label="Emplois créés" name="jobs_created" type="number" fullWidth value={formData.jobs_created} onChange={handleChange} /></Grid>
          <Grid item xs={12} md={3}><TextField label="Emplois effectifs" name="jobs_effective" type="number" fullWidth value={formData.jobs_effective} onChange={handleChange} /></Grid>
          <Grid item xs={12} md={3}><TextField label="Expatriés" name="jobs_expat" type="number" fullWidth value={formData.jobs_expat} onChange={handleChange} /></Grid>
          <Grid item xs={12} md={3}><TextField label="Nationaux" name="jobs_national" type="number" fullWidth value={formData.jobs_national} onChange={handleChange} /></Grid>
          <Grid item xs={12} md={3}><TextField label="Hommes" name="jobs_men" type="number" fullWidth value={formData.jobs_men} onChange={handleChange} /></Grid>
          <Grid item xs={12} md={3}><TextField label="Femmes" name="jobs_women" type="number" fullWidth value={formData.jobs_women} onChange={handleChange} /></Grid>
          
          <Grid item xs={12} md={12}><TextField label="Remarques" name="remarks" fullWidth multiline rows={2} value={formData.remarks} onChange={handleChange} /></Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Annuler</Button>
        <Button onClick={handleSubmit} variant="contained" disabled={loading}>
          {loading ? 'Enregistrement...' : (initialData ? 'Mettre à jour' : 'Enregistrer')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function DashboardPage({ stats, loading, error, projects, projectsLoading, projectsError, handleEditProject, handleDeleteProject, currentUser, onYearChange, selectedYear }) {
  const navigate = useNavigate();
  const formatNumber = (num) => new Intl.NumberFormat('fr-FR').format(num);
  const formatCurrency = (num) => `${formatNumber(num)} FCFA`;

  const [searchTerm, setSearchTerm] = useState('');
  const filteredProjects = projects.filter(project => 
    (project.name && project.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (project.investor?.name && project.investor.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const pieData = stats ? Object.entries(stats.projects_by_status).map(([key, value]) => ({
    name: key,
    value: value,
  })) : [];

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

  const genderData = stats ? Object.entries(stats.employment_gender_split).map(([name, value]) => ({ name, value })) : [];
  const originData = stats ? Object.entries(stats.employment_origin_split).map(([name, value]) => ({ name, value })) : [];

  // Calcul du taux de réalisation de l'investissement
  const realizationRate = stats && stats.total_investment_projected > 0 
    ? (stats.total_investment_realized / stats.total_investment_projected) * 100 : 0;

  return (
    <>
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
            <CircularProgress size={60} />
            <Typography variant="h6" sx={{ ml: 2 }}>Chargement des données...</Typography>
          </Box>
        )}

        {error && (
          <Paper sx={{ p: 3, mt: 2, backgroundColor: 'error.light', color: 'error.contrastText' }}>
            <Typography variant="h6">Erreur</Typography>
            <Typography>{error}</Typography>
          </Paper>
        )}

        {stats && (
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold' }}>
                Vue d'Ensemble Stratégique
              </Typography>
              <FormControl sx={{ minWidth: 150 }}>
                <InputLabel>Année d'Analyse</InputLabel>
                <Select value={selectedYear} label="Année d'Analyse" onChange={(e) => onYearChange(e.target.value)}>
                  <MenuItem value="">Toutes les années</MenuItem>
                  {AVAILABLE_YEARS.map(year => (
                    <MenuItem key={year} value={year}>Année {year}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            <Grid container spacing={2} sx={{ mt: 2 }}>
              {/* Ligne Statuts */}
              <Grid item xs={12} sm={6} md={3} lg={2}><StatCard title="Total Dossiers" value={formatNumber(stats.total_projects)} icon={<FactCheckIcon color="primary" sx={{ fontSize: 40 }} />} linkTo="/list/status/all" /></Grid>
              <Grid item xs={12} sm={6} md={3} lg={2}><StatCard title="En Activité" value={formatNumber(stats.projects_by_status['en activités'] || 0)} icon={<WorkIcon sx={{ fontSize: 40, color: '#388e3c' }} />} linkTo="/list/status/en activités" /></Grid>
              <Grid item xs={12} sm={6} md={2} lg={2}><StatCard title="En Cours" value={formatNumber(stats.projects_by_status['en cours'] || 0)} icon={<ShowChartIcon sx={{ fontSize: 40, color: '#0277bd' }} />} linkTo="/list/status/en cours" /></Grid>
              <Grid item xs={12} sm={6} md={2} lg={2}><StatCard title="En Attente" value={formatNumber(stats.projects_by_status['en attentes'] || 0)} icon={<HourglassEmptyIcon sx={{ fontSize: 40, color: '#f57c00' }} />} linkTo="/list/status/en attentes" /></Grid>
              <Grid item xs={12} sm={12} md={2} lg={2}><StatCard title="Suspendus" value={formatNumber(stats.projects_by_status['suspendus'] || 0)} icon={<PauseCircleIcon sx={{ fontSize: 40, color: '#d32f2f' }} />} linkTo="/list/status/suspendus" /></Grid>
              <Grid item xs={12} sm={12} md={12} lg={2}><StatCard title="Superficie (m²)" value={formatNumber(stats.total_land_area)} icon={<LandscapeIcon sx={{ fontSize: 40, color: '#6d4c41' }} />} linkTo="/list/superficie" /></Grid>

              {/* Ligne Emplois */}
              <Grid item xs={12} sm={4}><StatCard title="Emplois Prévisionnels" value={formatNumber(stats.total_jobs_forecast)} icon={<AssignmentTurnedInIcon sx={{ fontSize: 50, color: '#0277bd' }} />} linkTo="/list/emplois" /></Grid>
              <Grid item xs={12} sm={4}><StatCard title="Emplois Créés" value={formatNumber(stats.total_jobs_created)} icon={<GroupIcon color="secondary" sx={{ fontSize: 50 }} />} linkTo="/list/emplois" /></Grid>
              <Grid item xs={12} sm={4}><StatCard title="Emplois Effectifs" value={formatNumber(stats.total_jobs_effective)} icon={<WorkIcon sx={{ fontSize: 50, color: '#388e3c' }} />} linkTo="/list/emplois" /></Grid>

              {/* Ligne Courriers & Délais */}
              <Grid item xs={12} md={4}><StatCard title="Courriers en attente" value={stats.pending_requests} icon={<EmailIcon sx={{ fontSize: 40, color: '#d32f2f' }} />} linkTo="/requests?filter=waiting" /></Grid>
              <Grid item xs={12} md={4}><StatCard title="Délai moyen traitement" value={`${stats.avg_processing_days} jours`} icon={<HistoryIcon sx={{ fontSize: 40, color: '#1976d2' }} />} linkTo="/requests" /></Grid>
              <Grid item xs={12} md={4}><StatCard title="Total Courriers" value={stats.total_requests} icon={<EmailIcon sx={{ fontSize: 40, color: '#455a64' }} />} linkTo="/requests" /></Grid>

              <Grid item xs={12} md={6}>
                <StatCard title="Investissements Projetés" value={formatCurrency(stats.total_investment_projected)} icon={<EuroIcon sx={{ fontSize: 50, color: '#f57c00' }} />} linkTo="/list/investissements" progress={100} />
              </Grid>
              <Grid item xs={12} md={6}>
                <StatCard title="Investissements Réalisés" value={formatCurrency(stats.total_investment_realized)} icon={<EuroIcon sx={{ fontSize: 50, color: '#2e7d32' }} />} linkTo="/list/investissements" progress={realizationRate} />
              </Grid>
            </Grid>

            {/* Section Graphiques */}
            <Grid container spacing={3} sx={{ mt: 2 }}>
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 3, height: 450 }}>
                  <Typography variant="h6" gutterBottom>Évolution des Investissements & Ventes (M FCFA)</Typography>
                  <ResponsiveContainer width="100%" height="90%">
                    <LineChart data={stats.monthly_trends}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis tickFormatter={(value) => `${value / 1000000}M`} />
                      <Tooltip formatter={(value) => `${formatNumber(value)} FCFA`} />
                      <Legend />
                      <Line type="monotone" dataKey="investment" name="Invest. Réalisé" stroke="#388e3c" strokeWidth={3} />
                      <Line type="monotone" dataKey="sales" name="Chiffre d'Affaires" stroke="#1976d2" strokeWidth={3} />
                    </LineChart>
                  </ResponsiveContainer>
                </Paper>
              </Grid>

              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 3, height: 450 }}>
                  <Typography variant="h6" gutterBottom>Évolution de l'Emploi (Effectifs mensuels)</Typography>
                  <ResponsiveContainer width="100%" height="90%">
                    <LineChart data={stats.monthly_trends}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="men" name="Hommes" stroke="#0277bd" strokeWidth={2} />
                      <Line type="monotone" dataKey="women" name="Femmes" stroke="#f06292" strokeWidth={2} />
                      <Line type="monotone" dataKey="national" name="Nationaux" stroke="#ff9800" strokeWidth={2} strokeDasharray="5 5" />
                    </LineChart>
                  </ResponsiveContainer>
                </Paper>
              </Grid>

              <Grid item xs={12} md={4}>
                <Paper sx={{ p: 3, height: 350 }}>
                  <Typography variant="h6" gutterBottom>Répartition par Genre & Origine</Typography>
                  <ResponsiveContainer width="100%" height="90%">
                    <BarChart data={[
                      { category: 'Genre', ...stats.employment_gender_split },
                      { category: 'Origine', ...stats.employment_origin_split }
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="category" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="Hommes" fill="#0277bd" stackId="a" />
                      <Bar dataKey="Femmes" fill="#f06292" stackId="a" />
                      <Bar dataKey="Nationaux" fill="#ff9800" stackId="b" />
                      <Bar dataKey="Expatriés" fill="#9e9e9e" stackId="b" />
                    </BarChart>
                  </ResponsiveContainer>
                </Paper>
              </Grid>

              <Grid item xs={12} md={4}>
                <Paper sx={{ p: 3, height: 350 }}>
                  <Typography variant="h6" gutterBottom>Projets par Statut</Typography>
                  {/* Fix: Ajout d'une hauteur fixe au conteneur pour forcer l'affichage du graphique */}
                  <Box sx={{ width: '100%', height: 280 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" labelLine={false} label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`} outerRadius={100} fill="#8884d8" dataKey="value" >
                          {pieData.map((entry, index) => ( <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} /> ))}
                        </Pie>
                        <Tooltip />
                        <Legend verticalAlign="bottom" height={36}/>
                      </PieChart>
                    </ResponsiveContainer>
                  </Box>
                </Paper>
              </Grid>

              <Grid item xs={12} md={4}>
                <Paper 
                  sx={{ 
                    p: 3, 
                    height: 350, 
                    display: 'flex', 
                    flexDirection: 'column', 
                    bgcolor: 'primary.dark', 
                    color: 'white',
                    borderRadius: 2,
                    boxShadow: 4
                  }}
                >
                  <Typography variant="h6" gutterBottom sx={{ opacity: 0.9 }}>Résumé Analytique</Typography>
                  <Box sx={{ mt: 2, textAlign: 'center' }}>
                    <Typography variant="h2" fontWeight="bold">{Math.round(realizationRate)}%</Typography>
                    <Typography variant="subtitle1" sx={{ opacity: 0.8 }}>Taux de réalisation financier</Typography>
                  </Box>
                  <Divider sx={{ my: 3, bgcolor: 'rgba(255,255,255,0.1)' }} />
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="body2" sx={{ mb: 1 }}>• Portefeuille total : <strong>{stats.total_projects} projets</strong></Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>• Capacité d'emploi : <strong>{formatNumber(stats.total_jobs_effective)} agents</strong></Typography>
                    <Typography variant="body2">• Courriers traités : <strong>{stats.total_requests - stats.pending_requests} / {stats.total_requests}</strong></Typography>
                  </Box>
                  <Button component={Link} to="/list/status/all" variant="contained" color="secondary" sx={{ mt: 2 }}>
                    Détails du portefeuille
                  </Button>
                </Paper>
              </Grid>
            </Grid>
          </Box>
        )}
      </Container>
      
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h5" component="h2"> Liste des Projets (Gestion) </Typography>
          <TextField
            variant="outlined"
            size="small"
            placeholder="Rechercher un projet ou investisseur..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start"><SearchIcon /></InputAdornment>
              ),
            }}
            sx={{ width: 300, bgcolor: 'white' }}
          />
        </Box>
        {projectsLoading && ( <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '20vh' }}> <CircularProgress size={40} /> <Typography variant="body1" sx={{ ml: 2 }}>Chargement des projets...</Typography> </Box> )}
        {projectsError && ( <Alert severity="error" sx={{ mb: 2 }}>{projectsError}</Alert> )}
        {projects && projects.length > 0 ? (
          <TableContainer component={Paper}>
            <Table sx={{ minWidth: 650 }} size="small" aria-label="tableau des projets">
              <TableHead sx={{ bgcolor: '#f5f5f5' }}>
                <TableRow>
                  <TableCell><strong>Investisseur</strong></TableCell>
                  <TableCell><strong>Projet (Objet Social)</strong></TableCell>
                  <TableCell><strong>Secteur</strong></TableCell>
                  <TableCell><strong>Statut</strong></TableCell>
                  <TableCell align="right"><strong>Inv. Projeté</strong></TableCell>
                  <TableCell align="right"><strong>Emplois</strong></TableCell>
                  <TableCell align="center"><strong>Actions</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredProjects.map((project) => (
                  <TableRow key={project.id} onClick={() => navigate(`/project/${project.id}`)} sx={{ '&:last-child td, &:last-child th': { border: 0 }, '&:hover': { bgcolor: '#f9f9f9', cursor: 'pointer' } }} >
                    <TableCell>{project.investor?.name || '-'}</TableCell>
                    <TableCell component="th" scope="row"> {project.name} </TableCell>
                    <TableCell>{project.investor?.sector || '-'}</TableCell>
                    <TableCell> <Box sx={{ display: 'inline-block', px: 1, py: 0.5, borderRadius: 1, fontSize: '0.75rem', bgcolor: project.status === 'en activités' ? '#e8f5e9' : (project.status === 'suspendus' ? '#ffebee' : '#e3f2fd'), color: project.status === 'en activités' ? '#2e7d32' : (project.status === 'suspendus' ? '#c62828' : '#1565c0') }}> {project.status} </Box> </TableCell>
                    <TableCell align="right">{formatNumber(project.investment_projected)} FCFA</TableCell>
                    <TableCell align="right">{project.employment?.jobs_created_total || 0}</TableCell>
                    <TableCell align="center">
                      {['ADMIN', 'MANAGER'].includes(currentUser?.role) && (
                        <Box onClick={(e) => e.stopPropagation()}>
                          <IconButton size="small" color="primary" onClick={() => handleEditProject(project)} title="Modifier"><EditIcon /></IconButton>
                          <IconButton size="small" color="error" onClick={() => handleDeleteProject(project.id)} title="Supprimer"><DeleteIcon /></IconButton>
                        </Box>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : ( !projectsLoading && ( <Paper sx={{ p: 2, textAlign: 'center' }}> <Typography variant="body1">Aucun projet trouvé.</Typography> </Paper> ) )}
      </Container>
    </>
  );
}

function DetailPage() {
    const { dataType, subType } = useParams();
    const navigate = useNavigate();
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const token = localStorage.getItem('token');

    useEffect(() => {
        const fetchProjects = async () => {
            if (!token) {
                setError("Vous n'êtes pas connecté.");
                setLoading(false);
                return;
            }
            try {
            const config = { headers: { Authorization: `Bearer ${token}` } };
            const response = await axios.get(`${API_URL}/projects/`, config);
                setProjects(response.data);
            } catch (err) {
                setError('Impossible de charger les données.');
            } finally {
                setLoading(false);
            }
        };
        fetchProjects();
    }, [token]);

    const formatNumber = (num) => new Intl.NumberFormat('fr-FR').format(num || 0);

    let pageTitle = "Détails";
    let tableHeaders = [];
    let tableData = [];

    if (!loading && projects.length > 0) {
        if (dataType === 'superficie') {
            pageTitle = "Détail des Superficies par Projet";
            tableHeaders = ["Investisseur", "Projet", "Superficie (m²)"];
            tableData = projects
                .filter(p => p.land_area > 0)
                .map(p => [p.investor?.name || "N/A", p.name || "N/A", formatNumber(p.land_area)]);
        } else if (dataType === 'emplois') {
            pageTitle = "Détail des Emplois par Projet";
            tableHeaders = ["Investisseur", "Projet", "Prévisionnels", "Créés", "Effectifs"];
            tableData = projects
                .map(p => [ p.investor?.name || "N/A", p.name || "N/A", formatNumber(p.employment?.jobs_forecast), formatNumber(p.employment?.jobs_created_total), formatNumber(p.employment?.jobs_effective) ]);
        } else if (dataType === 'investissements') {
            pageTitle = "Détail des Investissements par Projet";
            tableHeaders = ["Investisseur", "Projet", "Inv. Projeté (FCFA)", "Inv. Réalisé (FCFA)"];
            tableData = projects
                .map(p => [ p.investor?.name || "N/A", p.name || "N/A", formatNumber(p.investment_projected), formatNumber(p.investment_realized) ]);
        } else if (dataType === 'status') {
            const statusKey = subType;
            pageTitle = statusKey === 'all' ? 'Liste de tous les projets enregistrés' : `Liste des projets : ${statusKey}`;
            tableHeaders = ["Investisseur", "Projet", "Secteur", "Statut", "Inv. Projeté (FCFA)"];
            const filteredProjects = statusKey === 'all' ? projects : projects.filter(p => p.status === statusKey);
            tableData = filteredProjects.map(p => [ p.investor?.name || "N/A", p.name || "N/A", p.investor?.sector || "N/A", p.status, formatNumber(p.investment_projected) ]);
        } else {
            pageTitle = "Catégorie non reconnue";
        }
    }

    return (
        <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
            <Button variant="outlined" onClick={() => navigate('/')} sx={{ mb: 3 }}>
                &larr; Retour au Tableau de Bord
            </Button>
            <Typography variant="h4" component="h1" gutterBottom>{pageTitle}</Typography>
            {loading && <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>}
            {error && <Alert severity="error">{error}</Alert>}
            {!loading && !error && (
                 <TableContainer component={Paper}>
                    <Table>
                        <TableHead sx={{ bgcolor: '#f5f5f5' }}>
                            <TableRow>
                                {tableHeaders.map(header => <TableCell key={header}><strong>{header}</strong></TableCell>)}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {tableData.length > 0 ? tableData.map((row, index) => (
                                <TableRow key={index} sx={{ '&:hover': { bgcolor: '#f9f9f9' } }}>
                                    {row.map((cell, cellIndex) => <TableCell key={cellIndex}>{cell}</TableCell>)}
                                </TableRow>
                            )) : (
                                <TableRow><TableCell colSpan={tableHeaders.length} align="center">Aucune donnée à afficher pour cette catégorie.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}
        </Container>
    );
}

function AuditLogPage() {
    const navigate = useNavigate();
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const token = localStorage.getItem('token');

    useEffect(() => {
        const fetchLogs = async () => {
            if (!token) {
                setError("Accès non autorisé. Veuillez vous connecter.");
                setLoading(false);
                return;
            }
            try {
                const config = { headers: { Authorization: `Bearer ${token}` } };
                const response = await axios.get(`${API_URL}/audit-logs/`, config);
                setLogs(response.data);
            } catch (err) {
                setError('Impossible de charger les journaux d\'audit. Seuls les administrateurs y ont accès.');
            } finally {
                setLoading(false);
            }
        };
        fetchLogs();
    }, [token]);

    return (
        <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
            <Button variant="outlined" onClick={() => navigate('/')} sx={{ mb: 3 }}>
                &larr; Retour au Tableau de Bord
            </Button>
            <Typography variant="h4" component="h1" gutterBottom>Journal d'Audit (Traçabilité)</Typography>
            {loading && <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>}
            {error && <Alert severity="error">{error}</Alert>}
            {!loading && !error && (
                 <TableContainer component={Paper}>
                    <Table size="small">
                        <TableHead sx={{ bgcolor: '#f5f5f5' }}>
                            <TableRow>
                                <TableCell><strong>Date & Heure</strong></TableCell>
                                <TableCell><strong>Action</strong></TableCell>
                                <TableCell><strong>Détails</strong></TableCell>
                                <TableCell><strong>Utilisateur</strong></TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {logs.map((log) => (
                                <TableRow key={log.id}>
                                    <TableCell>{new Date(log.timestamp).toLocaleString('fr-FR')}</TableCell>
                                    <TableCell>{log.action}</TableCell>
                                    <TableCell>{log.details}</TableCell>
                                    <TableCell>{log.user.full_name}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}
        </Container>
    );
}

function UserManagementPage() {
    const navigate = useNavigate();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [openUserForm, setOpenUserForm] = useState(false);
    const [userToEdit, setUserToEdit] = useState(null);
    const token = localStorage.getItem('token');

    const fetchUsers = async () => {
        if (!token) {
            setError("Accès non autorisé.");
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const config = { headers: { Authorization: `Bearer ${token}` } };
            const response = await axios.get(`${API_URL}/users/`, config);
            setUsers(response.data);
        } catch (err) {
            setError('Impossible de charger la liste des utilisateurs. Seuls les administrateurs y ont accès.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, [token]);

    const handleCreateUser = () => {
        setUserToEdit(null);
        setOpenUserForm(true);
    };

    const handleEditUser = (user) => {
        setUserToEdit(user);
        setOpenUserForm(true);
    };

    const handleToggleActive = async (user) => {
        if (!window.confirm(`Voulez-vous vraiment ${user.is_active ? 'désactiver' : 'réactiver'} cet utilisateur ?`)) return;
        try {
            const config = { headers: { Authorization: `Bearer ${token}` } };
            await axios.patch(`${API_URL}/users/${user.id}`, { is_active: !user.is_active }, config);
            fetchUsers();
        } catch (err) {
            alert("Erreur lors de la mise à jour du statut.");
        }
    };

    const handleSuccess = () => {
        setOpenUserForm(false);
        setUserToEdit(null);
        fetchUsers();
    };

    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
            <Button variant="outlined" onClick={() => navigate('/')} sx={{ mb: 3 }}>
                &larr; Retour au Tableau de Bord
            </Button>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h4" component="h1">Gestion des Utilisateurs</Typography>
                <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreateUser}>
                    Créer un utilisateur
                </Button>
            </Box>
            
            {loading && <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>}
            {error && <Alert severity="error">{error}</Alert>}
            {!loading && !error && (
                 <TableContainer component={Paper}>
                    <Table>
                        <TableHead sx={{ bgcolor: '#f5f5f5' }}>
                            <TableRow>
                                <TableCell><strong>Nom Complet</strong></TableCell>
                                <TableCell><strong>Email</strong></TableCell>
                                <TableCell><strong>Rôle</strong></TableCell>
                                <TableCell><strong>Statut</strong></TableCell>
                                <TableCell align="center"><strong>Actions</strong></TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {users.map((user) => (
                                <TableRow key={user.id}>
                                    <TableCell>{user.full_name}</TableCell>
                                    <TableCell>{user.email}</TableCell>
                                    <TableCell>{user.role}</TableCell>
                                    <TableCell>
                                        <Box sx={{ color: user.is_active ? 'success.main' : 'error.main', display: 'flex', alignItems: 'center' }}>
                                            {user.is_active ? <CheckCircleIcon fontSize="small" sx={{ mr: 0.5 }} /> : <BlockIcon fontSize="small" sx={{ mr: 0.5 }} />}
                                            {user.is_active ? 'Actif' : 'Inactif'}
                                        </Box>
                                    </TableCell>
                                    <TableCell align="center">
                                        <IconButton size="small" color="primary" onClick={() => handleEditUser(user)} title="Modifier">
                                            <EditIcon />
                                        </IconButton>
                                        <IconButton size="small" color={user.is_active ? "error" : "success"} onClick={() => handleToggleActive(user)} title={user.is_active ? "Désactiver" : "Réactiver"}>
                                            {user.is_active ? <BlockIcon /> : <CheckCircleIcon />}
                                        </IconButton>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}
            <UserFormDialog open={openUserForm} onClose={() => setOpenUserForm(false)} onSuccess={handleSuccess} token={token} initialData={userToEdit} />
        </Container>
    );
}

function UserFormDialog({ open, onClose, onSuccess, token, initialData }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [role, setRole] = useState('AUDITEUR');
    const [error, setError] = useState('');

    useEffect(() => {
        if (initialData) {
            setFullName(initialData.full_name || '');
            setEmail(initialData.email || '');
            setRole(initialData.role || 'AUDITEUR');
            setPassword(''); // On ne remplit pas le mot de passe pour la sécurité
        } else {
            setFullName('');
            setEmail('');
            setRole('AUDITEUR');
            setPassword('');
        }
    }, [initialData, open]);

    const handleSubmit = async () => {
        setError('');
        try {
            const config = { headers: { Authorization: `Bearer ${token}` } };
            const payload = { email, full_name: fullName, role };
            if (password) payload.password = password;

            if (initialData) {
                await axios.patch(`${API_URL}/users/${initialData.id}`, payload, config);
            } else {
                if (!password) { setError("Le mot de passe est requis pour la création."); return; }
                await axios.post(`${API_URL}/users/`, { ...payload, password }, config);
            }
            onSuccess();
        } catch (err) {
            setError(err.response?.data?.detail || 'Une erreur est survenue.');
        }
    };

    return (
        <Dialog open={open} onClose={onClose}>
            <DialogTitle>{initialData ? "Modifier l'utilisateur" : "Créer un nouvel utilisateur"}</DialogTitle>
            <DialogContent>
                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                <TextField autoFocus margin="dense" label="Nom complet" fullWidth value={fullName} onChange={e => setFullName(e.target.value)} />
                <TextField margin="dense" label="Email" type="email" fullWidth value={email} onChange={e => setEmail(e.target.value)} disabled={!!initialData} helperText={initialData ? "L'email ne peut pas être modifié ici." : ""} />
                <TextField margin="dense" label={initialData ? "Nouveau mot de passe (laisser vide pour conserver)" : "Mot de passe"} type="password" fullWidth value={password} onChange={e => setPassword(e.target.value)} />
                <FormControl fullWidth margin="dense">
                    <InputLabel>Rôle</InputLabel>
                    <Select value={role} label="Rôle" onChange={e => setRole(e.target.value)}>
                        <MenuItem value="ADMIN">Administrateur</MenuItem>
                        <MenuItem value="MANAGER">Manager</MenuItem>
                        <MenuItem value="AUDITEUR">Auditeur</MenuItem>
                    </Select>
                </FormControl>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Annuler</Button>
                <Button onClick={handleSubmit}>{initialData ? "Mettre à jour" : "Créer"}</Button>
            </DialogActions>
        </Dialog>
    );
}

function ProjectDetailPage() {
    const { projectId } = useParams();
    const navigate = useNavigate();
    const [project, setProject] = useState(null);
    const [trends, setTrends] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR);
    const token = localStorage.getItem('token');

    const fetchData = async () => {
            if (!token) {
                setError("Vous n'êtes pas connecté.");
                setLoading(false);
                return;
            }
            try {
                const config = { headers: { Authorization: `Bearer ${token}` } };
                const [projRes, trendRes] = await Promise.all([
                    axios.get(`${API_URL}/projects/${projectId}`, config),
                    axios.get(`${API_URL}/projects/${projectId}/stats?year=${selectedYear}`, config)
                ]);
                setProject(projRes.data);
                setTrends(trendRes.data);
            } catch (err) {
                setError('Impossible de charger les détails du projet.');
            } finally {
                setLoading(false);
            }
    };

    useEffect(() => {
        fetchData();
    }, [projectId, token, selectedYear]);

    const formatNumber = (num) => new Intl.NumberFormat('fr-FR').format(num || 0);
    const formatCurrency = (num) => `${formatNumber(num || 0)} FCFA`;

    const statusSteps = ['en attentes', 'en cours', 'en activités'];
    const activeStep = project ? statusSteps.indexOf(project.status) : -1;

    const renderDescriptionDetails = (description) => {
        if (!description) return <ListItem><ListItemText primary="Aucune information complémentaire." /></ListItem>;
        
        const details = description.split('\n').map((line, index) => {
            const parts = line.split(/:(.*)/s); // Sépare sur le premier ':'
            if (parts.length > 1 && parts[0].trim()) {
                return (
                    <ListItem key={index} divider>
                        <ListItemText primary={parts[1].trim()} secondary={parts[0].trim()} />
                    </ListItem>
                );
            }
            return null;
        }).filter(Boolean);

        return details;
    };

    if (loading) return <Container sx={{mt: 4}}><Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box></Container>;
    if (error) return <Container sx={{mt: 4}}><Alert severity="error">{error}</Alert></Container>;
    if (!project) return <Container sx={{mt: 4}}><Alert severity="warning">Projet non trouvé.</Alert></Container>;

    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
            <Button variant="outlined" onClick={() => navigate('/')} sx={{ mb: 3 }}>
                &larr; Retour au Tableau de Bord
            </Button>
            <Paper sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box>
                        <Typography variant="h4" gutterBottom>{project.name || "Projet sans nom"}</Typography>
                        <Typography variant="h6" color="text.secondary" gutterBottom>Investisseur : {project.investor?.name}</Typography>
                    </Box>
                    <FormControl sx={{ minWidth: 150 }}>
                        <Select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} size="small">
                            {AVAILABLE_YEARS.map(year => (
                                <MenuItem key={year} value={year}>Année {year}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Box>
                <Divider sx={{ my: 2 }} />

                <Grid container spacing={3}>
                    <Grid item xs={12}>
                        <Paper variant="outlined" sx={{ p: 3, mb: 1, textAlign: 'center' }}>
                            <Typography variant="subtitle2" gutterBottom color="text.secondary">Progression du Projet</Typography>
                            <Stepper activeStep={activeStep} alternativeLabel>
                                {statusSteps.map((label) => (
                                    <Step key={label}>
                                        <StepLabel sx={{ textTransform: 'capitalize' }}>{label}</StepLabel>
                                    </Step>
                                ))}
                            </Stepper>
                        </Paper>
                    </Grid>

                    <Grid item xs={12} md={6}>
                        <Paper variant="outlined" sx={{ p: 2 }}>
                            <Typography variant="subtitle1" gutterBottom fontWeight="bold">Évolution mensuelle de l'Investissement & CA</Typography>
                            <ResponsiveContainer width="100%" height={250}>
                                <LineChart data={trends}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="month" />
                                    <YAxis hide />
                                    <Tooltip />
                                    <Line type="monotone" dataKey="inv" name="Invest. Réalisé" stroke="#388e3c" />
                                    <Line type="monotone" dataKey="sales" name="Ventes" stroke="#1976d2" />
                                </LineChart>
                            </ResponsiveContainer>
                        </Paper>
                    </Grid>
                    <Grid item xs={12} md={6}>
                        <Paper variant="outlined" sx={{ p: 2 }}>
                            <Typography variant="subtitle1" gutterBottom fontWeight="bold">Évolution mensuelle des Emplois</Typography>
                            <ResponsiveContainer width="100%" height={250}>
                                <BarChart data={trends}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="month" />
                                    <YAxis />
                                    <Tooltip />
                                    <Legend />
                                    <Bar dataKey="men" name="Hommes" fill="#0277bd" />
                                    <Bar dataKey="women" name="Femmes" fill="#f06292" />
                                </BarChart>
                            </ResponsiveContainer>
                        </Paper>
                    </Grid>
                    <Grid item xs={12} md={6}>
                        <Typography variant="h6" gutterBottom>Informations Clés</Typography>
                        <List dense>
                            <ListItem><ListItemText primary={project.status} secondary="Statut" /></ListItem>
                            <ListItem><ListItemText primary={project.investor?.sector || 'N/A'} secondary="Secteur d'activité" /></ListItem>
                            <ListItem><ListItemText primary={formatCurrency(project.investment_projected)} secondary="Investissement Prévisionnel" /></ListItem>
                            <ListItem><ListItemText primary={formatCurrency(project.investment_realized)} secondary="Investissement Réalisé" /></ListItem>
                            <ListItem><ListItemText primary={`${formatNumber(project.land_area)} m²`} secondary="Superficie du terrain" /></ListItem>
                        </List>
                    </Grid>
                    <Grid item xs={12} md={6}>
                        <Typography variant="h6" gutterBottom>Données sur l'Emploi</Typography>
                        <List dense>
                            <ListItem><ListItemText primary={formatNumber(project.employment?.jobs_forecast)} secondary="Emplois Prévisionnels" /></ListItem>
                            <ListItem><ListItemText primary={formatNumber(project.employment?.jobs_created_total)} secondary="Emplois Créés" /></ListItem>
                            <ListItem><ListItemText primary={formatNumber(project.employment?.jobs_effective)} secondary="Emplois Effectifs" /></ListItem>
                            <ListItem><ListItemText primary={formatNumber(project.employment?.jobs_national)} secondary="Nationaux" /></ListItem>
                            <ListItem><ListItemText primary={formatNumber(project.employment?.jobs_expat)} secondary="Expatriés" /></ListItem>
                        </List>
                    </Grid>
                    <Grid item xs={12}>
                        <Divider sx={{ my: 2 }} />
                        <Typography variant="h6" gutterBottom>Fiche de Renseignements Complémentaires</Typography>
                        <List dense component={Paper} variant="outlined">
                            {renderDescriptionDetails(project.description)}
                        </List>
                    </Grid>
                </Grid>
            </Paper>
        </Container>
    );
}

// Nouveau composant pour le formulaire de création de courrier
function RequestFormDialog({ open, onClose, onSuccess, token, projects }) {
    const [formData, setFormData] = useState({
        project_id: '',
        subject: '',
        description: '',
        status: 'à traiter', // Correction de l'erreur Enum (doit correspondre au Backend)
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Réinitialiser le formulaire à l'ouverture
    useEffect(() => {
        if (open) {
            setFormData({
                project_id: '',
                subject: '',
                description: '',
                status: 'à traiter',
            });
            setError(null);
        }
    }, [open]);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async () => {
        setLoading(true);
        setError(null);
        try {
            const config = { headers: { Authorization: `Bearer ${token}` } };
            await axios.post(`${API_URL}/requests/`, formData, config);
            onSuccess();
            onClose();
        } catch (err) {
            console.error("Erreur lors de la création de la demande:", err.response || err);
            let errorMessage = "Erreur inconnue";
            if (err.response?.data?.detail) {
                if (Array.isArray(err.response.data.detail)) {
                    errorMessage = err.response.data.detail.map(e => `Champ '${e.loc[e.loc.length - 1]}': ${e.msg}`).join('; ');
                } else {
                    errorMessage = err.response.data.detail;
                }
            } else if (err.message) {
                errorMessage = err.message;
            }
            setError(`Erreur : ${errorMessage}.`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>Créer une Nouvelle Demande (Courrier)</DialogTitle>
            <DialogContent>
                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                <FormControl fullWidth margin="dense" required>
                    <InputLabel>Projet Associé</InputLabel>
                    <Select name="project_id" value={formData.project_id} label="Projet Associé" onChange={handleChange}>
                        <MenuItem value=""><em>Sélectionner un projet</em></MenuItem>
                        {projects.map((project) => (
                            <MenuItem key={project.id} value={project.id}>{project.investor?.name} - {project.name}</MenuItem>
                        ))}
                    </Select>
                </FormControl>
                <FormControl fullWidth margin="dense">
                    <InputLabel>Statut Initial</InputLabel>
                    <Select name="status" value={formData.status} label="Statut Initial" onChange={handleChange}>
                        <MenuItem value="à traiter">À Traiter</MenuItem>
                        <MenuItem value="en cours">En Cours</MenuItem>
                        <MenuItem value="traité">Traité</MenuItem>
                        <MenuItem value="rejeté">Rejeté</MenuItem>
                    </Select>
                </FormControl>
                <TextField autoFocus margin="dense" label="Sujet du Courrier" name="subject" fullWidth required value={formData.subject} onChange={handleChange} />
                <TextField margin="dense" label="Description / Détails" name="description" fullWidth multiline rows={4} value={formData.description} onChange={handleChange} />
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Annuler</Button>
                <Button onClick={handleSubmit} variant="contained" disabled={loading || !formData.project_id || !formData.subject}>
                    {loading ? 'Création...' : 'Créer la Demande'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}

// Nouveau composant pour la gestion des courriers
function RequestManagementPage({ currentUser }) {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const initialFilter = searchParams.get('filter') || 'all';
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filterStatus, setFilterStatus] = useState(initialFilter); 
    const [filterProjectId, setFilterProjectId] = useState('');
    const [projects, setProjects] = useState([]); // Pour peupler le filtre de projets
    const [openRequestForm, setOpenRequestForm] = useState(false); // État pour ouvrir le formulaire de courrier
    const token = localStorage.getItem('token');

    const fetchRequests = async () => {
        if (!token) {
            setError("Vous n'êtes pas connecté.");
            setLoading(false);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const config = { headers: { Authorization: `Bearer ${token}` } };
            let url = `${API_URL}/requests/`;
            const params = new URLSearchParams();
            if (filterStatus !== 'all') {
                params.append('status', filterStatus);
            }
            if (filterProjectId) {
                params.append('project_id', filterProjectId);
            }
            if (params.toString()) {
                url += `?${params.toString()}`;
            }
            const response = await axios.get(url, config);
            setRequests(response.data);
        } catch (err) {
            setError('Impossible de charger les demandes. Vérifiez vos droits ou la connexion.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const fetchProjectsForFilter = async () => {
        if (!token) return;
        try {
            const config = { headers: { Authorization: `Bearer ${token}` } };
            const response = await axios.get(`${API_URL}/projects/`, config);
            setProjects(response.data);
        } catch (err) {
            console.error("Erreur lors du chargement des projets pour le filtre:", err);
        }
    };

    useEffect(() => {
        fetchProjectsForFilter();
    }, [token]);

    useEffect(() => {
        fetchRequests();
    }, [token, filterStatus, filterProjectId]); // Re-fetch lorsque les filtres changent

    const handleStatusChange = async (requestId, newStatus) => {
        if (!window.confirm(`Voulez-vous vraiment changer le statut de cette demande à "${newStatus.replace('_', ' ')}" ?`)) return;
        try {
            const config = { headers: { Authorization: `Bearer ${token}` } };
            await axios.patch(`${API_URL}/requests/${requestId}/status`, null, {
                params: { new_status: newStatus },
                ...config
            });
            fetchRequests(); // Rafraîchir la liste
        } catch (err) {
            alert("Erreur lors de la mise à jour du statut de la demande.");
            console.error(err);
        }
    };

    const getStatusChipColor = (status) => {
        switch (status) {
            case 'à traiter': return { bgcolor: '#ffe0b2', color: '#e65100' }; // Orange
            case 'en cours': return { bgcolor: '#bbdefb', color: '#1565c0' }; // Bleu
            case 'traité': return { bgcolor: '#c8e6c9', color: '#2e7d32' }; // Vert
            case 'rejeté': return { bgcolor: '#ffcdd2', color: '#c62828' }; // Rouge
            default: return { bgcolor: '#e0e0e0', color: '#424242' }; // Gris
        }
    };

    const calculateDelay = (receivedAt, processedAt) => {
        if (!processedAt) return "N/A";
        const receivedDate = new Date(receivedAt);
        const processedDate = new Date(processedAt);
        const diffTime = Math.abs(processedDate - receivedDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return `${diffDays} jours`;
    };

    return (
        <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
            <Button variant="outlined" onClick={() => navigate('/')} sx={{ mb: 3 }}>
                &larr; Retour au Tableau de Bord
            </Button>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h4" component="h1">Gestion des Courriers (Demandes Investisseurs)</Typography>
                {['ADMIN', 'MANAGER'].includes(currentUser?.role) && (
                    <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpenRequestForm(true)}>
                        Ajouter un Courrier
                    </Button>
                )}
            </Box>
            
            <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={6} md={4}>
                    <FormControl fullWidth>
                        <InputLabel>Filtrer par Statut</InputLabel>
                        <Select value={filterStatus} label="Filtrer par Statut" onChange={(e) => setFilterStatus(e.target.value)}>
                            <MenuItem value="all">Tous les statuts</MenuItem>
                            <MenuItem value="waiting">En attente (À traiter + En cours)</MenuItem>
                            <MenuItem value="à traiter">À Traiter</MenuItem>
                            <MenuItem value="en cours">En Cours</MenuItem>
                            <MenuItem value="traité">Traité</MenuItem>
                            <MenuItem value="rejeté">Rejeté</MenuItem>
                        </Select>
                    </FormControl>
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                    <FormControl fullWidth>
                        <InputLabel>Filtrer par Projet</InputLabel>
                        <Select value={filterProjectId} label="Filtrer par Projet" onChange={(e) => setFilterProjectId(e.target.value)}>
                            <MenuItem value="">Tous les projets</MenuItem>
                            {projects.map((project) => (
                                <MenuItem key={project.id} value={project.id}>{project.investor?.name} - {project.name}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Grid>
            </Grid>

            {loading && <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>}
            {error && <Alert severity="error">{error}</Alert>}
            {!loading && !error && (
                <TableContainer component={Paper}>
                    <Table sx={{ minWidth: 700 }} size="small">
                        <TableHead sx={{ bgcolor: '#f5f5f5' }}>
                            <TableRow>
                                <TableCell><strong>Investisseur</strong></TableCell>
                                <TableCell><strong>Projet</strong></TableCell>
                                <TableCell><strong>Sujet</strong></TableCell>
                                <TableCell><strong>Description</strong></TableCell>
                                <TableCell><strong>Statut</strong></TableCell>
                                <TableCell><strong>Reçue le</strong></TableCell>
                                <TableCell><strong>Traitée le</strong></TableCell>
                                <TableCell><strong>Délai Traitement</strong></TableCell>
                                <TableCell align="center"><strong>Actions</strong></TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {requests.length > 0 ? requests.map((req) => (
                                <TableRow key={req.id}>
                                    <TableCell><strong>{projects.find(p => p.id === req.project_id)?.investor?.name || 'N/A'}</strong></TableCell>
                                    <TableCell>
                                        {projects.find(p => p.id === req.project_id)?.name || 'N/A'}
                                    </TableCell>
                                    <TableCell>{req.subject}</TableCell>
                                    <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{req.description}</TableCell>
                                    <TableCell>
                                        <Box sx={{ display: 'inline-block', px: 1, py: 0.5, borderRadius: 1, fontSize: '0.75rem', ...getStatusChipColor(req.status) }}>
                                            {req.status.replace('_', ' ')}
                                        </Box>
                                    </TableCell>
                                    <TableCell>{new Date(req.received_at).toLocaleDateString('fr-FR')}</TableCell>
                                    <TableCell>{req.processed_at ? new Date(req.processed_at).toLocaleDateString('fr-FR') : 'N/A'}</TableCell>
                                    <TableCell>{calculateDelay(req.received_at, req.processed_at)}</TableCell>
                                    <TableCell align="center">
                                        {['ADMIN', 'MANAGER'].includes(currentUser?.role) && req.status !== 'traité' && req.status !== 'rejeté' && (
                                            <FormControl size="small" sx={{ minWidth: 120 }}>
                                                <Select
                                                    value={req.status}
                                                    onChange={(e) => handleStatusChange(req.id, e.target.value)}
                                                    displayEmpty
                                                    inputProps={{ 'aria-label': 'changer statut' }}
                                                >
                                                    <MenuItem value="à traiter">À Traiter</MenuItem>
                                                    <MenuItem value="en cours">En Cours</MenuItem>
                                                    <MenuItem value="traité">Traité</MenuItem>
                                                    <MenuItem value="rejeté">Rejeté</MenuItem>
                                                </Select>
                                            </FormControl>
                                        )}
                                    </TableCell>
                                </TableRow>
                            )) : (
                                <TableRow><TableCell colSpan={8} align="center">Aucune demande trouvée.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}
            <RequestFormDialog
                open={openRequestForm}
                onClose={() => setOpenRequestForm(false)}
                onSuccess={fetchRequests} // Rafraîchir la liste après création
                token={token}
                projects={projects} // Passer la liste des projets pour le sélecteur
            />
        </Container>
    );
}

function App() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openLogin, setOpenLogin] = useState(false);
  const [openProjectForm, setOpenProjectForm] = useState(false);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [projects, setProjects] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectsError, setProjectsError] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [projectToEdit, setProjectToEdit] = useState(null);
  const [anchorElExport, setAnchorElExport] = useState(null); // Pour le menu déroulant d'export
  const openExportMenu = Boolean(anchorElExport);
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR);

  const fetchStats = async (year) => {
    try {
      const url = year ? `${API_URL}/dashboard/stats?year=${year}` : `${API_URL}/dashboard/stats`;
      const response = await axios.get(url);
      setStats(response.data);
    } catch (err) {
      setError('Impossible de charger les statistiques.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchProjects = async () => {
    setProjectsLoading(true);
    setProjectsError(null);
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const response = await axios.get(`${API_URL}/projects/`, config);
      setProjects(response.data);
    } catch (err) {
      setProjectsError('Impossible de charger la liste des projets. (Token expiré ?)');
      console.error(err);
      if (err.response && err.response.status === 401) {
        handleLogout(); // Déconnexion automatique si token invalide
      }
    } finally {
      setProjectsLoading(false);
    }
  };

  const fetchCurrentUser = async (currentToken) => {
    if (!currentToken) return;
    try {
      const config = { headers: { Authorization: `Bearer ${currentToken}` } };
      const response = await axios.get(`${API_URL}/users/me/`, config);
      setCurrentUser(response.data);
    } catch (error) {
      console.error("Impossible de récupérer l'utilisateur actuel", error);
      handleLogout();
    }
  };

  useEffect(() => {
    fetchStats(selectedYear);
    if (token) {
      fetchProjects();
      fetchCurrentUser(token);
    }
  }, [token, selectedYear]);

  const handleLogin = (newToken) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setProjects([]);
    setCurrentUser(null);
  };

  const handleEditProject = (project) => {
    setProjectToEdit(project);
    setOpenProjectForm(true);
  };

  const handleExportMenuClick = (event) => {
    setAnchorElExport(event.currentTarget);
  };

  const handleExportMenuClose = () => {
    setAnchorElExport(null);
  };

  const handleExportProjectsExcel = async () => {
    handleExportMenuClose();
    try {
      const response = await axios.get(`${API_URL}/export/projects/excel`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob', // Important pour recevoir un fichier
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const filename = `export_projets_acp_${new Date().toISOString().slice(0,10)}.xlsx`;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);

    } catch (error) {
      console.error("Erreur lors de l'export Excel des projets:", error);
      alert("Une erreur est survenue lors de la génération du fichier Excel des projets.");
    }
  };

  const handleExportDashboardStatsExcel = async () => {
    handleExportMenuClose();
    try {
      const response = await axios.get(`${API_URL}/export/stats/dashboard/excel?year=${selectedYear}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const filename = `export_dashboard_stats_${selectedYear || 'global'}_${new Date().toISOString().slice(0,10)}.xlsx`;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Erreur lors de l'export Excel des stats du tableau de bord:", error);
      alert("Une erreur est survenue lors de la génération du fichier Excel des statistiques du tableau de bord.");
    }
  };

  const handleDeleteProject = async (projectId) => {
    if (!window.confirm("Voulez-vous vraiment supprimer ce projet ? Cette action est irréversible.")) return;

    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      await axios.delete(`${API_URL}/projects/${projectId}`, config);
      fetchProjects(); // Rafraîchir la liste
      fetchStats(selectedYear); // Rafraîchir les stats
    } catch (err) {
      console.error("Erreur lors de la suppression:", err);
      alert("Impossible de supprimer le projet. Vérifiez vos droits.");
    }
  };

  const handleExportRequestsExcel = async () => {
    handleExportMenuClose();
    // Implémentation similaire à handleExportProjectsExcel, appelant le nouvel endpoint /export/requests/excel
    try {
      const response = await axios.get(`${API_URL}/export/courriers/excel`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const filename = `export_courriers_acp_${new Date().toISOString().slice(0,10)}.xlsx`;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Erreur lors de l'export Excel des courriers:", error);
      alert("Une erreur est survenue lors de la génération du fichier Excel des courriers.");
    }
  };

  const handleFormSuccess = () => {
    fetchStats(selectedYear);
    fetchProjects();
  };

  const handleCloseForm = () => {
    setOpenProjectForm(false);
    setProjectToEdit(null);
  };

  return (
    <Box sx={{ flexGrow: 1, backgroundColor: '#f4f6f8', minHeight: '100vh' }}>
      <AppBar position="static" elevation={1}>
        <Toolbar>
          <DashboardIcon sx={{ mr: 2 }} />
          <Typography variant="h6" component={Link} to="/" sx={{ flexGrow: 1, color: 'white', textDecoration: 'none' }}>
            ACP Invest System - Tableau de Bord
          </Typography>
          {token && (
            <>
              {['ADMIN', 'MANAGER'].includes(currentUser?.role) && (
                <Button color="inherit" variant="outlined" startIcon={<AddIcon />} onClick={() => setOpenProjectForm(true)} sx={{ mr: 2, borderColor: 'rgba(255,255,255,0.5)' }} > Nouveau Dossier </Button>
              )}
              {/* Bouton d'export avec menu déroulant */}
              <Button
                id="export-button"
                aria-controls={openExportMenu ? 'export-menu' : undefined}
                aria-haspopup="true"
                aria-expanded={openExportMenu ? 'true' : undefined}
                onClick={handleExportMenuClick}
                color="inherit" variant="outlined" startIcon={<DownloadIcon />} sx={{ mr: 2, borderColor: 'rgba(255,255,255,0.5)' }}
              >
                Exporter (Excel)
              </Button>
              <Menu id="export-menu" anchorEl={anchorElExport} open={openExportMenu} onClose={handleExportMenuClose} MenuListProps={{ 'aria-labelledby': 'export-button' }}>
                <MenuItem onClick={handleExportProjectsExcel}>Projets Détaillés</MenuItem>
                <MenuItem onClick={handleExportDashboardStatsExcel}>Statistiques du Tableau de Bord</MenuItem>
                <MenuItem onClick={handleExportRequestsExcel}>Courriers Détaillés</MenuItem>
              </Menu>
              {['ADMIN', 'MANAGER'].includes(currentUser?.role) && (
                <Button component={Link} to="/audit-logs" color="inherit" variant="outlined" startIcon={<HistoryIcon />} sx={{ mr: 2, borderColor: 'rgba(255,255,255,0.5)' }}> Journal d'Audit </Button>
              )}
              {currentUser?.role === 'ADMIN' && (
                  <Button component={Link} to="/users" color="inherit" variant="outlined" startIcon={<ManageAccountsIcon />} sx={{ mr: 2, borderColor: 'rgba(255,255,255,0.5)' }}> Utilisateurs </Button>
              )}
              {['ADMIN', 'MANAGER'].includes(currentUser?.role) && (
                <Button component={Link} to="/requests" color="inherit" variant="outlined" 
                    startIcon={<Badge badgeContent={stats?.pending_requests} color="error" overlap="circular"><ListAltIcon /></Badge>} 
                    sx={{ mr: 2, borderColor: 'rgba(255,255,255,0.5)' }}> 
                    Courriers 
                </Button>
              )}
            </>
          )}
          <Button color="inherit" onClick={token ? handleLogout : () => setOpenLogin(true)}> {token ? "Déconnexion" : "Connexion"} </Button>
        </Toolbar>
      </AppBar>

      <Routes>
        <Route path="/" element={<DashboardPage stats={stats} loading={loading} error={error} projects={projects} projectsLoading={projectsLoading} projectsError={projectsError} handleEditProject={handleEditProject} handleDeleteProject={handleDeleteProject} currentUser={currentUser} onYearChange={setSelectedYear} selectedYear={selectedYear} />} />
        <Route path="/list/:dataType" element={<DetailPage />} />
        <Route path="/list/:dataType/:subType" element={<DetailPage />} />
        <Route path="/audit-logs" element={<AuditLogPage />} />
        <Route path="/users" element={<UserManagementPage />} />
        <Route path="/requests" element={<RequestManagementPage currentUser={currentUser} />} />
        <Route path="/project/:projectId" element={<ProjectDetailPage />} />
      </Routes>

      <LoginDialog open={openLogin} onClose={() => setOpenLogin(false)} onLogin={handleLogin} />
      <ProjectFormDialog 
        open={openProjectForm} 
        onClose={handleCloseForm} 
        onSuccess={handleFormSuccess} 
        token={token} 
        initialData={projectToEdit}
      />
    </Box>
  );
}

export default App;