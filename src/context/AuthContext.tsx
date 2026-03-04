import React, { createContext, useContext, useState, useEffect } from 'react';

interface AuthContextType {
  token: string | null;
  role: 'admin' | 'kitchen' | 'billing' | null;
  restaurantId: number | null;
  login: (token: string, role: any, restaurantId: number) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  token: null,
  role: null,
  restaurantId: null,
  login: () => {},
  logout: () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [role, setRole] = useState<any>(localStorage.getItem('role'));
  const [restaurantId, setRestaurantId] = useState<number | null>(
    localStorage.getItem('restaurantId') ? Number(localStorage.getItem('restaurantId')) : null
  );

  const login = (newToken: string, newRole: any, newRestaurantId: number) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('role', newRole);
    localStorage.setItem('restaurantId', String(newRestaurantId));
    setToken(newToken);
    setRole(newRole);
    setRestaurantId(newRestaurantId);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('restaurantId');
    setToken(null);
    setRole(null);
    setRestaurantId(null);
  };

  return (
    <AuthContext.Provider value={{ token, role, restaurantId, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
