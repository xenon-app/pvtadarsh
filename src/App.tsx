/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import Login from './pages/Login';
import CustomerTable from './pages/CustomerTable';
import KitchenDashboard from './pages/KitchenDashboard';
import BillingDashboard from './pages/BillingDashboard';
import AdminDashboard from './pages/AdminDashboard';

const ProtectedRoute = ({ children, allowedRoles }: { children: React.ReactNode, allowedRoles: string[] }) => {
  const { token, role } = useAuth();
  if (!token) return <Navigate to="/" />;
  if (!allowedRoles.includes(role || '')) return <Navigate to="/" />;
  return <>{children}</>;
};

export default function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/table/:restaurantId/:tableId" element={<CustomerTable />} />
          
          <Route path="/admin" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminDashboard />
            </ProtectedRoute>
          } />
          
          <Route path="/kitchen" element={
            <ProtectedRoute allowedRoles={['kitchen', 'admin']}>
              <KitchenDashboard />
            </ProtectedRoute>
          } />
          
          <Route path="/billing" element={
            <ProtectedRoute allowedRoles={['billing', 'admin']}>
              <BillingDashboard />
            </ProtectedRoute>
          } />
        </Routes>
      </SocketProvider>
    </AuthProvider>
  );
}
