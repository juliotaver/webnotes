// App.js
import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs, updateDoc, doc } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { Menu, X, Search, ArrowUp, ArrowDown } from 'lucide-react';
import { useOfflineSync } from './hooks/useOfflineSync';
import { initDB } from './db/indexedDB';

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID
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
  const { isOnline, saveNoteLocally, syncWithServer } = useOfflineSync();
  const [isInitialized, setIsInitialized] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [noteSearchTerm, setNoteSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
  const [searchMatches, setSearchMatches] = useState([]);
  const textareaRef = useRef(null);

  // Función para búsqueda global en todas las notas
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
    // Función para búsqueda dentro de una nota específica
    const searchInNote = (term) => {
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
        matches.push(index);
        index = content.indexOf(searchTerm, index + 1);
      }
  
      setSearchMatches(matches);
      if (matches.length > 0) {
        setCurrentSearchIndex(0);
        highlightMatch(matches[0]);
      }
    };
  
    // Función para navegar entre resultados de búsqueda en una nota
    const highlightMatch = (index) => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(index, index + noteSearchTerm.length);
        
        // Calcular la posición de scroll necesaria
        const lineHeight = 20; // altura aproximada de línea
        const textBefore = currentNote.content.substring(0, index);
        const lineCount = textBefore.split('\n').length;
        const scrollPosition = lineHeight * lineCount;
        
        textareaRef.current.scrollTop = scrollPosition - 100; // 100px de margen superior
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
    if (!isLoggedIn) {
      return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center">
          <div className="bg-white p-8 rounded-lg shadow-md w-96">
            <h1 className="text-2xl mb-6 text-center">Notas App</h1>
            <form>
              <input
                type="email"
                placeholder="Email"
                className="w-full p-2 mb-4 border rounded"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <input
                type="password"
                placeholder="Contraseña"
                className="w-full p-2 mb-4 border rounded"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                onClick={handleLogin}
                className="w-full bg-blue-500 text-white p-2 rounded mb-2"
              >
                Iniciar Sesión
              </button>
              <button
                onClick={handleSignup}
                className="w-full bg-green-500 text-white p-2 rounded"
              >
                Crear Cuenta
              </button>
            </form>
          </div>
        </div>
      );
    }
  
    return (
      <div className="flex h-screen bg-gray-100 relative">
        {/* Sidebar con búsqueda global */}
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
            
            {/* Búsqueda global */}
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
                {searchTerm && (note.title?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                               note.content?.toLowerCase().includes(searchTerm.toLowerCase())) && (
                  <div className="mt-1 text-xs text-blue-500">
                    Coincidencia encontrada
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
  
        {/* Área principal con búsqueda en nota actual */}
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
                
                {/* Búsqueda en nota actual */}
                <div className="flex items-center mt-2 space-x-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      placeholder="Buscar en esta nota..."
                      className="w-full p-2 pr-8 border rounded text-sm"
                      value={noteSearchTerm}
                      onChange={(e) => {
                        setNoteSearchTerm(e.target.value);
                        searchInNote(e.target.value);
                      }}
                    />
                    <Search className="absolute right-2 top-2.5 text-gray-400" size={16} />
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
            <textarea
              ref={textareaRef}
              className="flex-1 p-4 resize-none focus:outline-none"
              value={currentNote.content || ''}
              onChange={(e) => {
                const newContent = e.target.value;
                setCurrentNote({ ...currentNote, content: newContent });
                updateNote(currentNote.id, { content: newContent });
              }}
              placeholder="Escribe tu nota aquí..."
            />
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
