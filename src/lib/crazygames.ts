
export interface CrazyGamesSDK {
  init: () => Promise<void>;
  ad: {
    requestAd: (type: 'midroll' | 'rewarded', callbacks: {
      adStarted?: () => void;
      adFinished?: () => void;
      adError?: (error: string) => void;
    }) => void;
  };
  user: {
    getUser: () => Promise<any>;
    getUserToken: () => Promise<string>;
    getSystemInfo: () => any;
    showAuthPrompt: () => Promise<any>;
    showAccountLinkPrompt: () => Promise<any>;
    addAuthListener: (callback: (user: any) => void) => void;
    removeAuthListener: (callback: (user: any) => void) => void;
  };
  game: {
    gameplayStart: () => void;
    gameplayStop: () => void;
    happyTime: () => void;
    loadingStart: () => void;
    loadingStop: () => void;
  };
}

declare global {
  interface Window {
    CrazyGames?: {
      SDK: CrazyGamesSDK;
    };
  }
}

let sdkInstance: CrazyGamesSDK | null = null;

export const initCrazyGames = async () => {
  if (typeof window === 'undefined' || !window.CrazyGames) return null;
  
  try {
    sdkInstance = window.CrazyGames.SDK;
    await sdkInstance.init();
    console.log('CrazyGames SDK initialized');
    return sdkInstance;
  } catch (error) {
    console.error('Failed to initialize CrazyGames SDK:', error);
    return null;
  }
};

export const getCrazyGamesSDK = () => sdkInstance;

export const requestAd = (type: 'midroll' | 'rewarded', onStarted: () => void, onFinished: () => void, onError?: (err: string) => void) => {
  if (!sdkInstance) {
    console.warn('CrazyGames SDK not initialized, skipping ad.');
    onFinished(); // Fallback
    return;
  }

  try {
    sdkInstance.ad.requestAd(type, {
      adStarted: onStarted,
      adFinished: onFinished,
      adError: (err) => {
        console.error('Ad error:', err);
        if (onError) onError(err);
        onFinished(); // Still finish to unblock user
      }
    });
  } catch (err) {
    console.error('Ad request failed synchronously:', err);
    if (onError) onError(String(err));
    onFinished();
  }
};

export const crazyGamesLogin = async () => {
  if (!sdkInstance) return null;
  
  try {
    const token = await sdkInstance.user.getUserToken();
    if (token) {
      const response = await fetch('/api/verify-crazygames-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
      if (response.ok) {
        const data = await response.json();
        console.log('CrazyGames user verified:', data.user);
        return data.user;
      }
    }
    return null;
  } catch (error) {
    console.error('CrazyGames login error:', error);
    return null;
  }
};

export const showAuthPrompt = async () => {
  if (!sdkInstance) return null;
  return await sdkInstance.user.showAuthPrompt();
};

export const showAccountLinkPrompt = async () => {
  if (!sdkInstance) return null;
  return await sdkInstance.user.showAccountLinkPrompt();
};

export const addAuthListener = (callback: (user: any) => void) => {
  if (sdkInstance) sdkInstance.user.addAuthListener(callback);
};

export const removeAuthListener = (callback: (user: any) => void) => {
  if (sdkInstance) sdkInstance.user.removeAuthListener(callback);
};

export const gameplayStart = () => {
  if (sdkInstance) sdkInstance.game.gameplayStart();
};

export const gameplayStop = () => {
  if (sdkInstance) sdkInstance.game.gameplayStop();
};

export const happyTime = () => {
  if (sdkInstance) sdkInstance.game.happyTime();
};

export const loadingStart = () => {
  if (sdkInstance) sdkInstance.game.loadingStart();
};

export const loadingStop = () => {
  if (sdkInstance) sdkInstance.game.loadingStop();
};
