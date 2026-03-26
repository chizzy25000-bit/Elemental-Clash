import React, { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, getDoc, setDoc, onSnapshot, collection, query, getDocs } from 'firebase/firestore';
import { CustomElement } from '../shared';

export const FirebaseSync: React.FC = () => {
  const { user } = useAuth();
  const syncInProgress = useRef(false);

  useEffect(() => {
    if (!user) return;

    const userDocRef = doc(db, 'users', user.uid);

    // Initial load and real-time sync
    const unsubscribe = onSnapshot(userDocRef, async (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        
        // Sync coins
        if (data.coins !== undefined) {
          localStorage.setItem('elemental_clash_global_coins', data.coins.toString());
          window.dispatchEvent(new CustomEvent('coins_changed', { detail: data.coins }));
        }

        // Sync inventory and loadout
        if (data.inventory) {
          localStorage.setItem('elemental_clash_cloud_inventory', JSON.stringify(data.inventory));
        }
        if (data.loadout) {
          localStorage.setItem('elemental_clash_cloud_loadout', JSON.stringify(data.loadout));
        }

        // Sync custom elements
        const ceQuery = query(collection(db, 'users', user.uid, 'customElements'));
        const ceSnapshot = await getDocs(ceQuery);
        const customElements: Record<string, any> = {};
        ceSnapshot.forEach(doc => {
          customElements[doc.id] = doc.data();
        });
        localStorage.setItem('elemental_clash_cloud_custom_elements', JSON.stringify(customElements));
        
        window.dispatchEvent(new CustomEvent('cloud_sync_complete'));
      } else {
        // Create initial profile if it doesn't exist
        try {
          const localCoins = parseInt(localStorage.getItem('elemental_clash_global_coins') || '500', 10);
          await setDoc(userDocRef, {
            uid: user.uid,
            displayName: user.displayName || 'Player',
            coins: localCoins,
            inventory: [],
            loadout: { attack: null, defense: null, mobility: null, healing: null, ultimate: null },
            updatedAt: new Date().toISOString()
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, `users/${user.uid}`);
        }
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
    });

    return () => unsubscribe();
  }, [user]);

  // Listen for local changes to sync to cloud
  useEffect(() => {
    if (!user) return;

    const syncToCloud = async () => {
      if (syncInProgress.current) return;
      
      const coins = parseInt(localStorage.getItem('elemental_clash_global_coins') || '500', 10);
      const inventory = JSON.parse(localStorage.getItem('elemental_clash_cloud_inventory') || '[]');
      const loadout = JSON.parse(localStorage.getItem('elemental_clash_cloud_loadout') || '{}');
      const customElements = JSON.parse(localStorage.getItem('elemental_clash_cloud_custom_elements') || '{}');

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
        console.error('Failed to sync to cloud:', error);
      } finally {
        syncInProgress.current = false;
      }
    };

    const handleSyncRequest = () => {
      syncToCloud();
    };

    window.addEventListener('sync_to_cloud', handleSyncRequest);
    window.addEventListener('coins_changed', handleSyncRequest);
    return () => {
      window.removeEventListener('sync_to_cloud', handleSyncRequest);
      window.removeEventListener('coins_changed', handleSyncRequest);
    };
  }, [user]);

  return null;
};
