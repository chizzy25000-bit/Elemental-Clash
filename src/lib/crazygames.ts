
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
    getSystemInfo: () => any;
    showAuthPrompt: () => Promise<any>;
  };
  game: {
    gameplayStart: () => void;
    gameplayStop: () => void;
    happyTime: () => void;
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

export const requestAd = (type: 'midroll' | 'rewarded', onFinished: () => void, onError?: (err: string) => void) => {
  if (!sdkInstance) {
    console.warn('CrazyGames SDK not initialized, skipping ad.');
    onFinished(); // Fallback
    return;
  }

  try {
    sdkInstance.ad.requestAd(type, {
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
    const user = await sdkInstance.user.getUser();
    if (user) {
      console.log('CrazyGames user logged in:', user);
      return user;
    } else {
      // Try to show auth prompt if not logged in?
      // For "automatic login", we just try to get the user first.
      return null;
    }
  } catch (error) {
    console.error('CrazyGames login error:', error);
    return null;
  }
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
