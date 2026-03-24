import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface User {
  id: string;
  email: string;
  company_name: string;
  phone?: string;
  bio?: string;
  logo?: string;
  subscription_tier: string;
  trial_end?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, company_name: string, phone?: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      const storedToken = await AsyncStorage.getItem('token');
      if (storedToken) {
        setToken(storedToken);
        await fetchUser(storedToken);
      }
    } catch (error) {
      console.error('Error loading auth:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUser = async (authToken: string) => {
    try {
      const response = await axios.get(`${API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      setUser(response.data);
    } catch (error) {
      console.error('Error fetching user:', error);
      await logout();
    }
  };

  const login = async (email: string, password: string) => {
    const response = await axios.post(`${API_URL}/api/auth/login`, { email, password });
    const { token: newToken, user: userData } = response.data;
    await AsyncStorage.setItem('token', newToken);
    setToken(newToken);
    setUser(userData);
  };

  const register = async (email: string, password: string, company_name: string, phone?: string) => {
    const response = await axios.post(`${API_URL}/api/auth/register`, {
      email,
      password,
      company_name,
      phone,
    });
    const { token: newToken, user: userData } = response.data;
    await AsyncStorage.setItem('token', newToken);
    setToken(newToken);
    setUser(userData);
  };

  const logout = async () => {
    await AsyncStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  const updateProfile = async (data: Partial<User>) => {
    if (!token) return;
    const response = await axios.put(`${API_URL}/api/auth/profile`, data, {
      headers: { Authorization: `Bearer ${token}` },
    });
    setUser(response.data);
  };

  const refreshUser = async () => {
    if (token) {
      await fetchUser(token);
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, token, loading, login, register, logout, updateProfile, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
