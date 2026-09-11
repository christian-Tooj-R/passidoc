import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';
import { pointageGuard } from './core/guards/pointage.guard';
import { setupGuard, alreadySetupGuard } from './core/guards/setup.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'setup', pathMatch: 'full' },
  {
    path: 'setup',
    canActivate: [alreadySetupGuard],
    loadComponent: () => import('./features/setup/setup-wizard.component').then(m => m.SetupWizardComponent),
  },
  {
    path: 'auth',
    canActivate: [setupGuard],
    children: [
      {
        path: 'login',
        loadComponent: () => import('./features/auth/login/login.component').then((m) => m.LoginComponent),
      },
      {
        path: 'verify-2fa',
        loadComponent: () => import('./features/auth/verify-2fa/verify-2fa.component').then((m) => m.Verify2faComponent),
      },
      {
        path: 'setup-2fa',
        canActivate: [authGuard],
        loadComponent: () => import('./features/auth/setup-2fa/setup-2fa.component').then((m) => m.Setup2faComponent),
      },
      {
        path: 'forgot-password',
        loadComponent: () => import('./features/auth/forgot-password/forgot-password.component').then((m) => m.ForgotPasswordComponent),
      },
    ],
  },
  // ── Pages plein écran (sans sidebar principale) ──────────────────────────
  {
    path: 'clients/:id',
    canActivate: [setupGuard, authGuard, pointageGuard],
    loadComponent: () => import('./features/clients/client-detail/client-detail.component').then((m) => m.ClientDetailComponent),
  },
  {
    path: 'clients/:id/ai',
    canActivate: [setupGuard, authGuard, pointageGuard],
    loadComponent: () => import('./features/clients/ai-chat-fullscreen/ai-chat-fullscreen.component').then((m) => m.AiChatFullscreenComponent),
  },
  {
    path: 'travail',
    canActivate: [setupGuard, authGuard, pointageGuard],
    loadComponent: () => import('./features/travail/travail.component').then(m => m.TravailComponent),
    children: [
      { path: '', redirectTo: 'taches', pathMatch: 'full' },
      {
        path: 'taches',
        loadComponent: () => import('./features/travail/pages/taches/travail-taches.component').then(m => m.TravailTachesComponent),
      },
      {
        path: 'saisie',
        loadComponent: () => import('./features/travail/pages/saisie-ligne/travail-saisie-ligne.component').then(m => m.TravailSaisieLigneComponent),
      },
      {
        path: 'temps/jour',
        loadComponent: () => import('./features/travail/pages/temps-jour/travail-temps-jour.component').then(m => m.TravailTempsJourComponent),
      },
      {
        path: 'temps/semaine',
        loadComponent: () => import('./features/travail/pages/temps-semaine/travail-temps-semaine.component').then(m => m.TravailTempsSemaineComponent),
      },
      {
        path: 'temps/mois',
        loadComponent: () => import('./features/travail/pages/temps-mois/travail-temps-mois.component').then(m => m.TravailTempsMoisComponent),
      },
      {
        path: 'temps/detail',
        loadComponent: () => import('./features/travail/pages/temps-detail/travail-temps-detail.component').then(m => m.TravailTempsDetailComponent),
      },
      {
        path: 'recurrentes',
        loadComponent: () => import('./features/travail/pages/recurrentes/travail-recurrentes.component').then(m => m.TravailRecurrentesComponent),
      },
      {
        path: 'agenda',
        loadComponent: () => import('./features/travail/pages/agenda/travail-agenda.component').then(m => m.TravailAgendaComponent),
      },
      {
        path: 'planning',
        loadComponent: () => import('./features/travail/pages/planning/travail-planning.component').then(m => m.TravailPlanningComponent),
      },
      {
        path: 'feuille-temps',
        loadComponent: () => import('./features/travail/pages/feuille-temps/travail-feuille-temps.component').then(m => m.TravailFeuilleTempsComponent),
      },
      {
        path: 'budgets',
        loadComponent: () => import('./features/travail/pages/budgets/travail-budgets.component').then(m => m.TravailBudgetsComponent),
      },
      {
        path: 'rapports/productivite',
        loadComponent: () => import('./features/travail/pages/rapports/travail-rapports-productivite.component').then(m => m.TravailRapportsProductiviteComponent),
      },
      {
        path: 'rapports/clients',
        loadComponent: () => import('./features/travail/pages/rapports/travail-rapports-clients.component').then(m => m.TravailRapportsClientsComponent),
      },
      {
        path: 'rapports/alertes',
        loadComponent: () => import('./features/travail/pages/rapports/travail-rapports-alertes.component').then(m => m.TravailRapportsAlertesComponent),
      },
      {
        path: 'kanban',
        loadComponent: () => import('./features/travail/pages/kanban/travail-kanban.component').then(m => m.TravailKanbanComponent),
      },
    ],
  },
  {
    path: 'rh',
    canActivate: [setupGuard, authGuard, pointageGuard],
    loadComponent: () => import('./features/rh/rh.component').then((m) => m.RhComponent),
    children: [
      { path: '', redirectTo: 'salaries', pathMatch: 'full' },
      {
        path: 'salaries',
        loadComponent: () => import('./features/salaries/salaries.component').then((m) => m.SalariesComponent),
      },
      {
        path: 'salaries/:id',
        loadComponent: () => import('./features/salaries/salaries-detail.component').then((m) => m.SalariesDetailComponent),
      },
      {
        path: 'conges',
        loadComponent: () => import('./features/conges-absences/conges-absences.component').then((m) => m.CongesAbsencesComponent),
      },
      {
        path: 'calendrier',
        loadComponent: () => import('./features/conges-absences/conges-calendrier.component').then((m) => m.CongesCalendrierComponent),
      },
      {
        path: 'periode',
        loadComponent: () => import('./features/paie-rh/periode-rh.component').then((m) => m.PeriodeRhComponent),
      },
      {
        path: 'activite',
        loadComponent: () => import('./features/paie-rh/activite-rh.component').then((m) => m.ActiviteRhComponent),
      },
      {
        path: 'paie',
        loadComponent: () => import('./features/paie-rh/paie-rh-hub.component').then((m) => m.PaieRhHubComponent),
      },
      {
        path: 'mes-bulletins',
        loadComponent: () => import('./features/paie-rh/mes-bulletins.component').then((m) => m.MesBulletinsComponent),
      },
    ],
  },
  
  // ── Layout principal (avec sidebar) ──────────────────────────────────────
  {
    path: '',
    canActivate: [setupGuard, authGuard, pointageGuard],
    loadComponent: () => import('./layout/main-layout/main-layout.component').then((m) => m.MainLayoutComponent),
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'clients',
        loadComponent: () => import('./features/clients/client-list/client-list.component').then((m) => m.ClientListComponent),
      },
      {
        path: 'tasks',
        loadComponent: () => import('./features/tasks/tasks-global.component').then((m) => m.TasksGlobalComponent),
      },
      {
        path: 'documents',
        loadComponent: () => import('./features/documents/documents.component').then((m) => m.DocumentsComponent),
      },
      {
        path: 'notes',
        loadComponent: () => import('./features/notes/notes.component').then((m) => m.NotesComponent),
      },
      {
        path: 'equipes',
        loadComponent: () => import('./features/admin/equipes.component').then((m) => m.EquipesComponent),
      },
      {
        path: 'permissions-roles',
        canActivate: [roleGuard],
        data: { roles: ['ADMIN'] },
        loadComponent: () => import('./features/admin/role-permissions.component').then((m) => m.RolePermissionsComponent),
      },
      {
        path: 'portefeuilles',
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'EXPERT_COMPTABLE', 'COLLABORATEUR'] },
        loadComponent: () => import('./features/admin/portefeuilles.component').then((m) => m.PortefeuillesComponent),
      },
      {
        path: 'pointage',
        loadComponent: () => import('./features/pointage/pointage.component').then((m) => m.PointageComponent),
      },
      {
        path: 'admin',
        canActivate: [roleGuard],
        data: { roles: ['ADMIN'] },
        loadComponent: () => import('./features/admin/admin.component').then((m) => m.AdminComponent),
      },
      {
        path: 'admin/secteurs',
        canActivate: [roleGuard],
        data: { roles: ['ADMIN'] },
        loadComponent: () => import('./features/admin/secteurs-admin.component').then((m) => m.SecteursAdminComponent),
      },
      {
        path: 'admin/pointage-config',
        canActivate: [roleGuard],
        data: { roles: ['ADMIN'] },
        loadComponent: () => import('./features/admin/pointage-config.component').then((m) => m.PointageConfigComponent),
      },
      {
        path: 'personnalisation',
        loadComponent: () => import('./features/admin/personnalisation.component').then((m) => m.PersonnalisationComponent),
      },
      { path: 'salaries',     redirectTo: '/rh/salaries',  pathMatch: 'full' },
      { path: 'salaries/:id', redirectTo: '/rh/salaries/:id' },
      { path: 'conges',       redirectTo: '/rh/conges',    pathMatch: 'full' },
    ],
  },
  {
    path: '**',
    loadComponent: () => import('./features/not-found/not-found.component').then((m) => m.NotFoundComponent),
  },
];
