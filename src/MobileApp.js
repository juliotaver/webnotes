// MobileApp.js
import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs, updateDoc, doc } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { Menu, X, Search, ArrowUp, ArrowDown, ChevronLeft, Plus } from 'lucide-react';
import { useOfflineSync } from './hooks/useOfflineSync';
import { initDB } from './db/indexedDB';

// Configuración Firebase
const firebaseConfig = {
  apiKey: "AIzaSyD2sbd1v0Z6XPpcleFren_LgkmcRV3eJKA",
  authDomain: "webnotes-ca978.firebaseapp.com",
  projectId: "webnotes-ca978",
  storageBucket: "webnotes-ca978.firebasestorage.app",
  messagingSenderId: "431224345212",
  appId: "1:431224345212:web:1bbfb926e61ac6dccdeff9"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

function MobileApp() {
  const [notes, setNotes] = useState([]);
  const [currentNote, setCurrentNote] = useState({ id: null, title: '', content: '' });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [noteSearchTerm, setNoteSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
  const [searchMatches, setSearchMatches] = useState([]);
  const textareaRef = useRef(null);
  const { isOnline, saveNoteLocally, syncWithServer } = useOfflineSync();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        setIsLoggedIn(true);
        const db = await initDB();
        const transaction = db.transaction('userData', 'readwrite');
        const userStore = transaction.objectStore('userData');
        await userStore.put({
          id: 'currentUser',
          uid: user.uid,
          email: user.email
        });
        await loadNotes();
      } else {
        setIsLoggedIn(false);
        setNotes([]);
      }
    });
    return () => unsubscribe();
  }, []);

  const loadNotes = async () => {
    if (!auth.currentUser) return;
    
    try {
      if (isOnline) {
        const notesCollection = collection(db, `users/${auth.currentUser.uid}/notes`);
        const notesSnapshot = await getDocs(notesCollection);
        const notesList = notesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        const idb = await initDB();
        const transaction = idb.transaction('notes', 'readwrite');
        const notesStore = transaction.objectStore('notes');
        
        for (const note of notesList) {
          await notesStore.put(note);
        }
        
        setNotes(notesList);
      } else {
        const idb = await initDB();
        const transaction = idb.transaction('notes', 'readonly');
        const notesStore = transaction.objectStore('notes');
        const notesList = await notesStore.getAll();
        setNotes(notesList);
      }
    } catch (error) {
      console.error('Error loading notes:', error);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setIsLoggedIn(true);
    } catch (error) {
      alert('Error al iniciar sesión: ' + error.message);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      setIsLoggedIn(true);
    } catch (error) {
      alert('Error al crear cuenta: ' + error.message);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setIsLoggedIn(false);
      setCurrentNote({ id: null, title: '', content: '' });
    } catch (error) {
      alert('Error al cerrar sesión: ' + error.message);
    }
  };

  const createNote = async () => {
    if (!auth.currentUser) return;
    
    const newNote = {
      title: 'Nueva Nota',
      content: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const notesCollection = collection(db, `users/${auth.currentUser.uid}/notes`);
    const docRef = await addDoc(notesCollection, newNote);
    const newNoteWithId = { ...newNote, id: docRef.id };
    setCurrentNote(newNoteWithId);
    setNotes([...notes, newNoteWithId]);
  };

  const updateNote = async (noteId, updates) => {
    if (!auth.currentUser) return;
    
    try {
      const updatedNote = {
        ...currentNote,
        ...updates,
        updatedAt: new Date().toISOString()
      };

      await saveNoteLocally(updatedNote);
      
      if (isOnline) {
        const noteRef = doc(db, `users/${auth.currentUser.uid}/notes`, noteId);
        await updateDoc(noteRef, {
          ...updates,
          updatedAt: new Date().toISOString()
        });
      }

      setNotes(notes.map(note => 
        note.id === noteId 
          ? { ...note, ...updates, updatedAt: new Date().toISOString() }
          : note
      ));
    } catch (error) {
      console.error('Error updating note:', error);
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gray-100 p-4">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl mb-6 text-center font-bold">Notas</h1>
          <form className="space-y-4">
            <input
              type="email"
              placeholder="Email"
              className="w-full p-3 border rounded-lg"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              type="password"
              placeholder="Contraseña"
              className="w-full p-3 border rounded-lg"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              onClick={handleLogin}
              className="w-full bg-blue-500 text-white p-3 rounded-lg font-medium"
            >
              Iniciar Sesión
            </button>
            <button
              onClick={handleSignup}
              className="w-full bg-green-500 text-white p-3 rounded-lg font-medium"
            >
              Crear Cuenta
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      <div className="bg-white border-b">
        <div className="flex items-center justify-between p-4">
          {currentNote.id ? (
            <button 
              onClick={() => setCurrentNote({ id: null, title: '', content: '' })}
              className="p-2 -ml-2"
            >
              <ChevronLeft size={24} />
            </button>
          ) : (
            <h1 className="text-xl font-bold">Mis Notas</h1>
          )}
          <div className="flex items-center space-x-2">
            {currentNote.id && (
              <button
                onClick={() => setIsSearching(!isSearching)}
                className="p-2"
              >
                <Search size={20} />
              </button>
            )}
            <button
              onClick={handleLogout}
              className="px-3 py-1 bg-red-500 text-white text-sm rounded-md"
            >
              Salir
            </button>
          </div>
        </div>

        {isSearching && currentNote.id && (
          <div className="p-4 border-t bg-gray-50">
            <div className="flex items-center space-x-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Buscar en esta nota..."
                  className="w-full p-2 pr-8 border rounded-lg text-sm"
                  value={noteSearchTerm}
                  onChange={(e) => {
                    setNoteSearchTerm(e.target.value);
                    searchInNote(e.target.value, false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      searchInNote(noteSearchTerm, true);
                    }
                  }}
                  autoFocus
                />
                                <X
                  size={16}
                  className="absolute right-2 top-2.5 text-gray-400"
                  onClick={() => {
                    setNoteSearchTerm('');
                    setIsSearching(false);
                  }}
                />
              </div>
              {searchMatches.length > 0 && (
                <div className="flex items-center space-x-2">
                  <button onClick={previousSearchResult}>
                    <ArrowUp size={20} />
                  </button>
                  <span className="text-sm">
                    {currentSearchIndex + 1}/{searchMatches.length}
                  </span>
                  <button onClick={nextSearchResult}>
                    <ArrowDown size={20} />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Contenido Principal */}
      {currentNote.id ? (
        <div className="flex-1 flex flex-col">
          <input
            type="text"
            value={currentNote.title || ''}
            onChange={(e) => {
              const newTitle = e.target.value;
              setCurrentNote({ ...currentNote, title: newTitle });
              updateNote(currentNote.id, { title: newTitle });
            }}
            className="px-4 py-2 text-lg font-medium border-b focus:outline-none bg-white"
            placeholder="Título de la nota"
          />
          <textarea
            ref={textareaRef}
            className="flex-1 p-4 resize-none focus:outline-none bg-white"
            style={{
              fontFamily: 'monospace',
              lineHeight: '1.5',
              fontSize: '14px'
            }}
            value={currentNote.content || ''}
            onChange={(e) => {
              const newContent = e.target.value;
              setCurrentNote({ ...currentNote, content: newContent });
              updateNote(currentNote.id, { content: newContent });
            }}
            placeholder="Escribe tu nota aquí..."
          />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {/* Lista de Notas */}
          <div className="divide-y">
            {(searchTerm ? searchResults : notes).map(note => (
              <div
                key={note.id}
                onClick={() => setCurrentNote(note)}
                className="p-4 bg-white hover:bg-gray-50 active:bg-gray-100"
              >
                <h3 className="font-medium">{note.title || 'Sin título'}</h3>
                <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                  {note.content || 'Sin contenido'}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {new Date(note.updatedAt).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Botón flotante para nueva nota */}
      {!currentNote.id && (
        <button
          onClick={createNote}
          className="fixed right-4 bottom-4 w-12 h-12 bg-blue-500 text-white rounded-full shadow-lg flex items-center justify-center"
        >
          <Plus size={24} />
        </button>
      )}
    </div>
  );
}

export default MobileApp;