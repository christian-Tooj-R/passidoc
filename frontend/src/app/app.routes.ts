import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';

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
  {
    path: '',
    canActivate: [authGuard],
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
        path: 'clients/:id',
        loadComponent: () => import('./features/clients/client-detail/client-detail.component').then((m) => m.ClientDetailComponent),
      },
      {
        path: 'admin',
        canActivate: [roleGuard],
        data: { roles: ['ADMIN'] },
        loadComponent: () => import('./features/admin/admin.component').then((m) => m.AdminComponent),
      },
    ],
  },
  {
    path: '**',
    loadComponent: () => import('./features/not-found/not-found.component').then((m) => m.NotFoundComponent),
  },
];
