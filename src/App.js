// App.js
import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs, updateDoc, doc } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { Menu, X, Search, ArrowUp, ArrowDown } from 'lucide-react';
import { useOfflineSync } from './hooks/useOfflineSync';
import { initDB } from './db/indexedDB';

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

function App() {
  const [notes, setNotes] = useState([]);
  const [currentNote, setCurrentNote] = useState({ id: null, title: '', content: '' });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [noteSearchTerm, setNoteSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
  const [searchMatches, setSearchMatches] = useState([]);
  const [activeSearch, setActiveSearch] = useState('');
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

  const searchNotes = (term) => {
    if (!term.trim()) {
      setSearchResults([]);
      return;
    }

    const results = notes.filter(note => {
      const titleMatch = note.title?.toLowerCase().includes(term.toLowerCase());
      const contentMatch = note.content?.toLowerCase().includes(term.toLowerCase());
      return titleMatch || contentMatch;
    });

    setSearchResults(results);
  };

  const searchInNote = (term, shouldNavigate = false) => {
    if (!term.trim() || !currentNote.content) {
      setSearchMatches([]);
      setCurrentSearchIndex(0);
      return;
    }

    const matches = [];
    const content = currentNote.content.toLowerCase();
    const searchTerm = term.toLowerCase();
    let index = content.indexOf(searchTerm);
    
    while (index !== -1) {
      matches.push({
        start: index,
        end: index + searchTerm.length
      });
      index = content.indexOf(searchTerm, index + 1);
    }

    setSearchMatches(matches);
    setActiveSearch(term);
    
    if (matches.length > 0 && shouldNavigate) {
      setCurrentSearchIndex(0);
      highlightMatch(matches[0]);
    }
  };
  const highlightMatch = (match) => {
    if (textareaRef.current) {
      const textarea = textareaRef.current;
      
      // Seleccionar el texto
      textarea.focus();
      textarea.setSelectionRange(match.start, match.end);
      
      // Calcular la posición para el scroll
      const textBefore = textarea.value.substring(0, match.start);
      const linesBefore = textBefore.split('\n').length;
      const lineHeight = parseFloat(window.getComputedStyle(textarea).lineHeight) || 20;
      
      // Hacer scroll a la posición
      const scrollPosition = (linesBefore - 1) * lineHeight;
      textarea.scrollTop = scrollPosition - 100;
    }
  };

  const nextSearchResult = () => {
    if (searchMatches.length > 0) {
      const newIndex = (currentSearchIndex + 1) % searchMatches.length;
      setCurrentSearchIndex(newIndex);
      highlightMatch(searchMatches[newIndex]);
    }
  };
  
  const previousSearchResult = () => {
    if (searchMatches.length > 0) {
      const newIndex = currentSearchIndex === 0 ? 
        searchMatches.length - 1 : 
        currentSearchIndex - 1;
      setCurrentSearchIndex(newIndex);
      highlightMatch(searchMatches[newIndex]);
    }
  };

  return (
    <div className="flex h-screen bg-gray-100 relative">
      <div className={`${
        isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } absolute md:relative w-64 bg-white border-r overflow-y-auto h-full transition-transform duration-300 ease-in-out z-10`}>
        <div className="p-4 border-b space-y-4">
          <button
            onClick={createNote}
            className="w-full bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Nueva Nota
          </button>
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar en todas las notas..."
              className="w-full p-2 pr-8 border rounded"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                searchNotes(e.target.value);
              }}
            />
            <Search className="absolute right-2 top-2.5 text-gray-400" size={18} />
          </div>
        </div>

        <div className="overflow-y-auto">
          {(searchTerm ? searchResults : notes).map(note => (
            <div
              key={note.id}
              onClick={() => {
                setCurrentNote(note);
                setNoteSearchTerm('');
                setSearchMatches([]);
                if (window.innerWidth < 768) {
                  setIsSidebarOpen(false);
                }
              }}
              className={`p-4 border-b cursor-pointer hover:bg-gray-50 ${
                currentNote.id === note.id ? 'bg-blue-50' : ''
              }`}
            >
              <h3 className="font-medium truncate">{note.title || 'Sin título'}</h3>
              <p className="text-sm text-gray-500 truncate">{note.content || 'Sin contenido'}</p>
              <p className="text-xs text-gray-400 mt-1">
                {new Date(note.updatedAt).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        <div className="flex justify-between items-center bg-white border-b p-2">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 text-gray-600 hover:text-gray-900"
          >
            {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </button>

          {currentNote.id && (
            <div className="flex-1 mx-4">
              <input
                type="text"
                value={currentNote.title || ''}
                onChange={(e) => {
                  const newTitle = e.target.value;
                  setCurrentNote({ ...currentNote, title: newTitle });
                  updateNote(currentNote.id, { title: newTitle });
                }}
                className="text-xl font-semibold w-full border-none focus:outline-none"
                placeholder="Título de la nota"
              />
              <div className="flex items-center mt-2 space-x-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder="Buscar en esta nota..."
                    className="w-full p-2 pr-8 border rounded text-sm"
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
                  />
                  <button
                    onClick={() => searchInNote(noteSearchTerm, true)}
                    className="absolute right-2 top-2.5 text-gray-400 hover:text-gray-600"
                  >
                    <Search size={16} />
                  </button>
                </div>
                {searchMatches.length > 0 && (
                  <div className="flex items-center space-x-2">
                    <button 
                      onClick={previousSearchResult}
                      className="p-1 hover:bg-gray-100 rounded"
                    >
                      <ArrowUp size={20} />
                    </button>
                    <span className="text-sm text-gray-500">
                      {currentSearchIndex + 1}/{searchMatches.length}
                    </span>
                    <button 
                      onClick={nextSearchResult}
                      className="p-1 hover:bg-gray-100 rounded"
                    >
                      <ArrowDown size={20} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
          >
            Cerrar Sesión
          </button>
        </div>
        
        {currentNote.id ? (
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              className="w-full h-full p-4 resize-none focus:outline-none"
              style={{
                fontFamily: 'monospace',
                lineHeight: '1.5',
                fontSize: '14px',
                caretColor: 'black',
                backgroundColor: 'white'
              }}
              value={currentNote.content || ''}
              onChange={(e) => {
                const newContent = e.target.value;
                setCurrentNote({ ...currentNote, content: newContent });
                updateNote(currentNote.id, { content: newContent });
              }}
              placeholder="Escribe tu nota aquí..."
              spellCheck="false"
            />
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            Selecciona una nota o crea una nueva
          </div>
        )}
      </div>
    </div>
  );
}

export default App;