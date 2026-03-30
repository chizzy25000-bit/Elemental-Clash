import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth, loginWithGoogle, logout as firebaseLogout } from '../firebase';
import { initCrazyGames, crazyGamesLogin, addAuthListener, removeAuthListener, showAuthPrompt, showAccountLinkPrompt } from '../lib/crazygames';
import { toast } from 'sonner';

interface AuthContextType {
  user: any | null;
  loading: boolean;
  login: () => Promise<any>;
  logout: () => Promise<void>;
  isCrazyGames: boolean;
  linkCrazyGames: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCrazyGames, setIsCrazyGames] = useState(false);

  const handleCrazyGamesUser = useCallback(async (cgUser: any) => {
    if (cgUser && typeof cgUser.userId === 'string' && cgUser.userId.length > 0) {
      // Normalize CrazyGames user
      setUser({
        ...cgUser,
        uid: cgUser.userId,
        displayName: cgUser.username || 'Player',
        photoURL: cgUser.profilePicture
      });
      return true;
    }
    return false;
  }, []);

  useEffect(() => {
    const init = async () => {
      const sdk = await initCrazyGames();
      if (sdk) {
        setIsCrazyGames(true);
        
        // 1. Try automatic login
        const cgUser = await crazyGamesLogin();
        const loggedIn = await handleCrazyGamesUser(cgUser);
        
        if (!loggedIn) {
          // 2. Allow playing as Guest (default scenario)
          console.log('Starting as Guest');
          setUser(null); // Guest mode
        }

        // 3. Add Auth Listener for user changes
        const authCallback = async (newUser: any) => {
          console.log('CrazyGames Auth Change:', newUser);
          await handleCrazyGamesUser(newUser);
        };
        addAuthListener(authCallback);
        
        setLoading(false);
        return () => removeAuthListener(authCallback);
      }

      // Fallback to Firebase if not on CrazyGames
      const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
        if (!isCrazyGames) {
          setUser(firebaseUser);
        }
        setLoading(false);
      });
      return unsubscribe;
    };

    init();
  }, [isCrazyGames, handleCrazyGamesUser]);

  const login = async () => {
    try {
      if (isCrazyGames) {
        const result = await showAuthPrompt();
        if (result) {
          await handleCrazyGamesUser(result);
          toast.success('Logged in with CrazyGames!');
        }
        return result;
      } else {
        return await loginWithGoogle();
      }
    } catch (error) {
      console.error('Login Error:', error);
      toast.error('Login failed');
      throw error;
    }
  };

  const logout = async () => {
    if (isCrazyGames) {
      setUser(null); // Back to guest
      toast.info('Logged out (Guest mode)');
    } else {
      await firebaseLogout();
    }
  };

  const linkCrazyGames = async () => {
    if (!isCrazyGames) return;
    try {
      const result = await showAccountLinkPrompt();
      if (result) {
        await handleCrazyGamesUser(result);
        toast.success('Account linked successfully!');
      }
    } catch (error) {
      console.error('Link Error:', error);
      toast.error('Failed to link account');
    }
  };

  const value = {
    user,
    loading,
    login,
    logout,
    isCrazyGames,
    linkCrazyGames
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
