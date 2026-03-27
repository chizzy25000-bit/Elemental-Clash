import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth, loginWithGoogle, logout } from '../firebase';
import { initCrazyGames, crazyGamesLogin } from '../lib/crazygames';

interface AuthContextType {
  user: User | any | null;
  loading: boolean;
  login: () => Promise<any>;
  logout: () => Promise<void>;
  isCrazyGames: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | any | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCrazyGames, setIsCrazyGames] = useState(false);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const init = async () => {
      try {
        const sdk = await initCrazyGames();
        if (sdk) {
          setIsCrazyGames(true);
          const cgUser = await crazyGamesLogin();
          if (cgUser) {
            // Normalize CrazyGames user to have a 'uid' for Firestore sync
            setUser({
              ...cgUser,
              uid: cgUser.userId,
              displayName: cgUser.username || 'Player'
            });
            setLoading(false);
            return;
          }
        }

        unsubscribe = onAuthStateChanged(auth, (user) => {
          if (!isCrazyGames) {
            setUser(user);
          }
          setLoading(false);
        });
      } catch (error) {
        console.error('Auth Initialization Error:', error);
        setLoading(false);
        // Re-throw so ErrorBoundary can catch it if it's a critical failure
        throw error instanceof Error ? error : new Error(JSON.stringify(error));
      }
    };

    init();
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [isCrazyGames]);

  const value = {
    user,
    loading,
    login: async () => {
      try {
        if (isCrazyGames) {
          const { getCrazyGamesSDK } = await import('../lib/crazygames');
          const sdk = getCrazyGamesSDK();
          if (sdk) return await sdk.user.showAuthPrompt();
        } else {
          return await loginWithGoogle();
        }
      } catch (error) {
        console.error('Login Error:', error);
        throw error instanceof Error ? error : new Error(String(error));
      }
    },
    logout: isCrazyGames ? async () => { setUser(null); } : logout,
    isCrazyGames
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
