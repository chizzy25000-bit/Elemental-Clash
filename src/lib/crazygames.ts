
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
    addAuthListener: (callback: (user: any) => void) => void;
    removeAuthListener: (callback: (user: any) => void) => void;
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
let isInitializing = false;

export const initCrazyGames = async () => {
  if (typeof window === 'undefined') return null;
  if (sdkInstance) return sdkInstance;
  if (isInitializing) {
    // Wait for existing initialization
    return new Promise<CrazyGamesSDK | null>((resolve) => {
      const check = setInterval(() => {
        if (sdkInstance) {
          clearInterval(check);
          resolve(sdkInstance);
        }
      }, 100);
      setTimeout(() => {
        clearInterval(check);
        resolve(null);
      }, 5000);
    });
  }

  if (!window.CrazyGames) {
    console.warn('CrazyGames SDK script not found. Ads will not work.');
    return null;
  }
  
  try {
    isInitializing = true;
    sdkInstance = window.CrazyGames.SDK;
    await sdkInstance.init();
    console.log('CrazyGames SDK v3 initialized successfully');
    isInitializing = false;
    return sdkInstance;
  } catch (error) {
    console.error('Failed to initialize CrazyGames SDK:', error);
    isInitializing = false;
    return null;
  }
};

export const getCrazyGamesSDK = () => sdkInstance;

export const requestAd = (type: 'midroll' | 'rewarded', onFinished: () => void, onError?: (err: string) => void) => {
  if (!sdkInstance) {
    console.warn(`CrazyGames SDK not initialized. Skipping ${type} ad.`);
    onFinished(); // Fallback to unblock user
    return;
  }

  console.log(`Requesting ${type} ad...`);
  
  // CrazyGames best practice: stop gameplay before ad
  try {
    sdkInstance.game.gameplayStop();
  } catch (e) {
    console.warn('Failed to call gameplayStop:', e);
  }

  sdkInstance.ad.requestAd(type, {
    adStarted: () => {
      console.log(`${type} ad started`);
    },
    adFinished: () => {
      console.log(`${type} ad finished`);
      try {
        sdkInstance?.game.gameplayStart();
      } catch (e) {}
      onFinished();
    },
    adError: (err) => {
      console.error(`${type} ad error:`, err);
      try {
        sdkInstance?.game.gameplayStart();
      } catch (e) {}
      if (onError) onError(err);
      onFinished(); // Still finish to unblock user
    }
  });
};

export const addCrazyGamesAuthListener = (callback: (user: any) => void) => {
  if (sdkInstance) {
    sdkInstance.user.addAuthListener(callback);
  }
};

export const removeCrazyGamesAuthListener = (callback: (user: any) => void) => {
  if (sdkInstance) {
    sdkInstance.user.removeAuthListener(callback);
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
