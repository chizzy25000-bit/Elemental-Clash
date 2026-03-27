import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth, loginWithGoogle, logout } from '../firebase';
import { initCrazyGames, crazyGamesLogin, addCrazyGamesAuthListener, removeCrazyGamesAuthListener } from '../lib/crazygames';

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
    let firebaseUnsubscribe: (() => void) | null = null;

    const handleCrazyGamesUser = (cgUser: any) => {
      if (cgUser && typeof cgUser.userId === 'string' && cgUser.userId.length > 0) {
        setUser({
          ...cgUser,
          uid: cgUser.userId,
          displayName: cgUser.username || 'Player'
        });
        setIsCrazyGames(true);
        setLoading(false);
      } else {
        // If CrazyGames login fails or user logs out, fallback to Firebase
        setIsCrazyGames(false);
        if (!firebaseUnsubscribe) {
          setupFirebaseListener();
        }
      }
    };

    const setupFirebaseListener = () => {
      firebaseUnsubscribe = onAuthStateChanged(auth, (user) => {
        setUser(user);
        setLoading(false);
      });
    };

    const init = async () => {
      const sdk = await initCrazyGames();
      if (sdk) {
        setIsCrazyGames(true);
        addCrazyGamesAuthListener(handleCrazyGamesUser);
        
        // Initial check
        const cgUser = await crazyGamesLogin();
        if (cgUser) {
          handleCrazyGamesUser(cgUser);
        } else {
          // If no user yet, we still wait for the listener but also setup Firebase just in case
          setupFirebaseListener();
        }
      } else {
        setupFirebaseListener();
      }
    };

    init();

    return () => {
      if (firebaseUnsubscribe) firebaseUnsubscribe();
      removeCrazyGamesAuthListener(handleCrazyGamesUser);
    };
  }, []);

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
