import { useState, useEffect } from 'react';
import { initDB } from '../db/indexedDB';

export const useOfflineSync = () => {
  const [isOnline, setIsOnline] = useState(window.navigator.onLine);
  const [db, setDB] = useState(null);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    initDB().then(database => setDB(database));

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const saveNoteLocally = async (note) => {
    const transaction = db.transaction(['notes', 'pendingChanges'], 'readwrite');
    const notesStore = transaction.objectStore('notes');
    const pendingStore = transaction.objectStore('pendingChanges');

    await notesStore.put(note);
    
    if (!isOnline) {
      await pendingStore.put({
        id: note.id,
        type: 'UPDATE',
        data: note,
        timestamp: Date.now()
      });
    }
  };

  const syncWithServer = async (updateNote) => {
    if (!isOnline || !db) return;

    const transaction = db.transaction('pendingChanges', 'readwrite');
    const pendingStore = transaction.objectStore('pendingChanges');
    const changes = await pendingStore.getAll();

    for (const change of changes) {
      try {
        await updateNote(change.data.id, change.data);
        await pendingStore.delete(change.id);
      } catch (error) {
        console.error('Error syncing:', error);
      }
    }
  };

  return { isOnline, saveNoteLocally, syncWithServer };
};
