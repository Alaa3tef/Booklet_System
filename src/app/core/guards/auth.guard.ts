import { inject } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  Router,
  RouterStateSnapshot
} from '@angular/router';
import { AuthService } from '../services/auth.service';
import { catchError, map, of, timeout } from 'rxjs';

const normalizeRole = (role: string | null | undefined): string =>
  (role ?? '').trim().toLowerCase().replace(/[\s_-]+/g, ' ');

const dashboardRoles = new Set([
  'superadmin', 'it',
  'مسؤول النظام it', 'مدير النظام it',
  'top', 'top management', 'topmanagment'
]);

const workflowRouteByRole: Record<string, string> = {
  // planning: '/workflow/planning',
  // plan: '/workflow/planning',
  // projectmgmt: '/workflow/planning',
  // 'project mgmt': '/workflow/planning',
  // 'project management': '/workflow/planning',
  // projectmanagement: '/workflow/planning',
  projectmanagment: '/workflow/planning',
  printing: '/workflow/printing',
  // print: '/workflow/printing',
  quality: '/workflow/quality',
  packing: '/workflow/packing',
  // packaging: '/workflow/packing',
  archive: '/workflow/archiving',
  // archiving: '/workflow/archiving',
  storage: '/workflow/archiving',
  warehouse: '/warehouses',
  'pre quality': '/workflow/printing-approved',

  // warehouses: '/warehouses',
  // 'warehouse management': '/warehouses'
};

function roleFromProfileResponse(response: any): string {
  const profile = response?.data?.data ?? response?.data ?? response;
  console.log('roleFromProfileResponse:', profile);
  return profile?.roleName
    ?? profile?.role
    ?? profile?.user?.roleName
    ?? profile?.user?.role
    ?? '';

}

function roleHomeUrl(role: string, router: Router) {
  const normalizedRole = normalizeRole(role);
  if (dashboardRoles.has(normalizedRole)) return router.parseUrl('/dashboard');

  const workflowRoute = workflowRouteByRole[normalizedRole];
  return workflowRoute ? router.parseUrl(workflowRoute) : router.parseUrl('/login');
}

function resolveCurrentRole(authService: AuthService, router: Router) {
  const existingRole = authService.profileRole() || authService.currentUser()?.role;
  if (existingRole) return of(existingRole);

  return authService.profile().pipe(
    timeout({ first: 10000 }),
    map(roleFromProfileResponse),
    catchError(() => of(''))
  );
}

function redirectToRoleHome(authService: AuthService, router: Router) {
  return resolveCurrentRole(authService, router).pipe(
    map(role => roleHomeUrl(role, router))
  );
}

/**
 * Protects authenticated routes.
 * Redirects to /login if user is not signed in.
 */
export const authGuard: CanActivateFn = (
  _route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/login'], {
    queryParams: { returnUrl: state.url }
  });
};

export const roleHomeGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);
  return redirectToRoleHome(authService, router);
};

export const dashboardRoleGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return resolveCurrentRole(authService, router).pipe(
    map(role => normalizeRole(role)),
    map(role => dashboardRoles.has(role) ? true : roleHomeUrl(role, router))
  );
};
/**
 * Protects guest routes (e.g. /login, /forgot-password, /reset-password).
 * Redirects to /dashboard if user is already signed in.
 */
export const guestGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    const role = authService.profileRole() ;
    return role ? roleHomeUrl(role, router) : true;
  }

  return true;
};
