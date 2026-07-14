import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';
import { pointageGuard } from './core/guards/pointage.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  {
    path: 'auth',
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
    ],
  },
  // ── Pages plein écran (sans sidebar principale) ──────────────────────────
  {
    path: 'clients/:id',
    canActivate: [authGuard, pointageGuard],
    loadComponent: () => import('./features/clients/client-detail/client-detail.component').then((m) => m.ClientDetailComponent),
  },
  {
    path: 'rh',
    canActivate: [authGuard, pointageGuard],
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
    ],
  },
  
  // ── Layout principal (avec sidebar) ──────────────────────────────────────
  {
    path: '',
    canActivate: [authGuard, pointageGuard],
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
