import React, { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useCoins } from '../contexts/CoinContext';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, setDoc, onSnapshot, collection, query, getDocs } from 'firebase/firestore';
import { getInventoryKey, getLoadoutKey, getCustomElementsKey } from '../shared';

export const FirebaseSync: React.FC = () => {
  const { user } = useAuth();
  const { coins, setCoins } = useCoins();
  const syncInProgress = useRef(false);

  useEffect(() => {
    if (!user || typeof user.uid !== 'string' || user.uid.length === 0) return;

    const userDocRef = doc(db, 'users', user.uid);

    // Initial load and real-time sync
    const unsubscribe = onSnapshot(userDocRef, async (snapshot) => {
      try {
        if (snapshot.exists()) {
          const data = snapshot.data();
          
          // Sync coins
          if (data.coins !== undefined) {
            setCoins(data.coins);
          }

          // Sync inventory and loadout
          if (data.inventory) {
            localStorage.setItem(getInventoryKey(user.uid), JSON.stringify(data.inventory));
          }
          if (data.loadout) {
            localStorage.setItem(getLoadoutKey(user.uid), JSON.stringify(data.loadout));
          }

          // Sync custom elements
          const ceQuery = query(collection(db, 'users', user.uid, 'customElements'));
          const ceSnapshot = await getDocs(ceQuery);
          const customElements: Record<string, any> = {};
          ceSnapshot.forEach(doc => {
            customElements[doc.id] = doc.data();
          });
          localStorage.setItem(getCustomElementsKey(user.uid), JSON.stringify(customElements));
          
          window.dispatchEvent(new CustomEvent('cloud_sync_complete'));
        } else {
          // Create initial profile if it doesn't exist
          await setDoc(userDocRef, {
            uid: user.uid,
            displayName: user.displayName || 'Player',
            coins: coins,
            inventory: [],
            loadout: { attack: null, defense: null, mobility: null, healing: null, ultimate: null },
            updatedAt: new Date().toISOString()
          });
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
    });

    return () => unsubscribe();
  }, [user]);

  // Listen for local changes to sync to cloud
  useEffect(() => {
    if (!user || typeof user.uid !== 'string' || user.uid.length === 0) return;

    const syncToCloud = async () => {
      if (syncInProgress.current) return;
      
      const inventory = JSON.parse(localStorage.getItem(getInventoryKey(user.uid)) || '[]');
      const loadout = JSON.parse(localStorage.getItem(getLoadoutKey(user.uid)) || '{}');
      const customElements = JSON.parse(localStorage.getItem(getCustomElementsKey(user.uid)) || '{}');

      const userDocRef = doc(db, 'users', user.uid);
      
      try {
        syncInProgress.current = true;
        await setDoc(userDocRef, { 
          coins,
          inventory,
          loadout,
          updatedAt: new Date().toISOString()
        }, { merge: true });

        // Sync custom elements to subcollection
        for (const id in customElements) {
          await setDoc(doc(db, 'users', user.uid, 'customElements', id), customElements[id]);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
      } finally {
        syncInProgress.current = false;
      }
    };

    const handleSyncRequest = () => {
      syncToCloud();
    };

    window.addEventListener('sync_to_cloud', handleSyncRequest);
    return () => {
      window.removeEventListener('sync_to_cloud', handleSyncRequest);
    };
  }, [user, coins]);

  return null;
};
