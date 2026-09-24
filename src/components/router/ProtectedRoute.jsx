import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

/**
 * ProtectedRoute component
 *
 * Props:
 * - children: React node to render when access is allowed
 * - requiredRoles?: string[] | string – optional list or single role that is allowed to view the route
 *   If omitted, only authentication is required.
 */
export const ProtectedRoute = ({ children, requiredRoles }) => {
  const { isAuthenticated, currentRole } = useAuth();
  const location = useLocation();

  // Admin routes always go through the dedicated admin login flow
  const isAdminRoute = Array.isArray(requiredRoles)
    ? requiredRoles.includes('admin')
    : requiredRoles === 'admin';

  // Not logged in → redirect to the matching login page, preserve intended destination
  if (!isAuthenticated) {
    const loginPath = isAdminRoute ? '/admin/login' : '/login';
    const redirectTo = `${loginPath}?next=${encodeURIComponent(location.pathname)}`;
    return <Navigate to={redirectTo} replace />;
  }

  // Role check when requiredRoles is provided
  if (requiredRoles) {
    const allowed = Array.isArray(requiredRoles)
      ? requiredRoles.includes(currentRole)
      : requiredRoles === currentRole;
    if (!allowed) {
      // A normal customer/seller must not enter the admin area
      if (isAdminRoute) {
        return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
      }
      // If user is authenticated but wrong role, send to home or role‑specific page
      const fallback = currentRole === 'seller' ? '/seller' : currentRole === 'admin' ? '/admin' : '/';
      return <Navigate to={fallback} replace />;
    }
  }

  // All checks passed → render children
  return <>{children}</>;
};
