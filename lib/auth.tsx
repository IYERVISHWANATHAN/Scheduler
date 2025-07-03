import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiRequest } from './queryClient';
import { useToast } from '@/hooks/use-toast';

interface User {
  id: number;
  email: string;
  name: string;
  role: string;
}

interface Permissions {
  canView: boolean;
  canSchedule: boolean;
  canEdit: boolean;
  categories: string[];
}

interface AuthContextType {
  user: User | null;
  permissions: Permissions | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<Permissions | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // Set authorization header for all API requests
  const setAuthToken = (token: string | null) => {
    if (token) {
      localStorage.setItem('auth_token', token);
    } else {
      localStorage.removeItem('auth_token');
    }
  };

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const data = await apiRequest('POST', '/api/auth/login', { email, password });
      
      setUser(data.user);
      // Set permissions based on user role
      const rolePermissions: { [key: string]: Permissions } = {
        admin: { canView: true, canSchedule: true, canEdit: true, categories: ["liquor", "tobacco", "pnc", "confectionary", "fashion", "destination"] },
        liquor_tobacco: { canView: true, canSchedule: true, canEdit: true, categories: ["liquor", "tobacco"] },
        pnc_confectionary_fashion: { canView: true, canSchedule: true, canEdit: true, categories: ["pnc", "confectionary", "fashion"] },
        guest: { canView: true, canSchedule: false, canEdit: false, categories: [] },
        vendor: { canView: false, canSchedule: true, canEdit: false, categories: ["liquor", "tobacco", "pnc", "confectionary", "fashion"] }
      };
      setPermissions(rolePermissions[data.user.role] || rolePermissions.guest);
      setAuthToken(data.token);
      
      // Mark first login as completed for new users
      try {
        await apiRequest('PATCH', '/api/user/onboarding', { firstLoginCompleted: true });
      } catch (onboardingError) {
        // Onboarding update error is not critical for login
        console.warn('Failed to update onboarding status:', onboardingError);
      }
      
      const loginToast = toast({
        title: "Success",
        description: `Welcome back, ${data.user.name}!`
      });
      
      // Auto-dismiss login notification after 1 second
      setTimeout(() => {
        loginToast.dismiss();
      }, 1000);
      
      return true;
    } catch (error: any) {
      toast({
        title: "Login Failed",
        description: error.message || "Invalid credentials",
        variant: "destructive"
      });
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    setPermissions(null);
    setAuthToken(null);
    toast({
      title: "Logged Out",
      description: "You have been successfully logged out"
    });
  };

  // Check for existing session on app load
  useEffect(() => {
    const checkExistingSession = async () => {
      try {
        // Try to get current user from server-side session
        const data = await apiRequest('GET', '/api/auth/user');
        setUser(data);
        
        // Set permissions based on user role
        const rolePermissions: { [key: string]: Permissions } = {
          admin: {
            canView: true,
            canSchedule: true,
            canEdit: true,
            categories: ['liquor', 'tobacco', 'pnc', 'confectionary', 'fashion', 'destination']
          },
          liquor_tobacco: {
            canView: true,
            canSchedule: true,
            canEdit: true,
            categories: ['liquor', 'tobacco']
          },
          pnc_confectionary_fashion: {
            canView: true,
            canSchedule: true,
            canEdit: true,
            categories: ['pnc', 'confectionary', 'fashion']
          },
          guest: {
            canView: true,
            canSchedule: false,
            canEdit: false,
            categories: []
          }
        };
        
        setPermissions(rolePermissions[data.role] || rolePermissions.guest);
      } catch (error) {
        // No valid session, user will need to login
        setUser(null);
        setPermissions(null);
      }
      setIsLoading(false);
    };

    checkExistingSession();
  }, []);

  return (
    <AuthContext.Provider value={{ user, permissions, login, logout, isLoading }}>
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