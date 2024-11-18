// App.js
import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs, updateDoc, doc } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
// Importamos íconos para el botón de toggle
import { Menu, X } from 'lucide-react';

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

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(user => {
      if (user) {
        setIsLoggedIn(true);
        loadNotes();
      } else {
        setIsLoggedIn(false);
        setNotes([]);
      }
    });

    return () => unsubscribe();
  }, []);

  const loadNotes = async () => {
    if (!auth.currentUser) return;
    
    const notesCollection = collection(db, `users/${auth.currentUser.uid}/notes`);
    const notesSnapshot = await getDocs(notesCollection);
    const notesList = notesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    setNotes(notesList);
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

  // Nueva función de cierre de sesión
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
    
    const noteRef = doc(db, `users/${auth.currentUser.uid}/notes`, noteId);
    await updateDoc(noteRef, {
      ...updates,
      updatedAt: new Date().toISOString()
    });
    
    setNotes(notes.map(note => 
      note.id === noteId 
        ? { ...note, ...updates, updatedAt: new Date().toISOString() }
        : note
    ));
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
      {/* Sidebar - Lista de notas */}
      <div className={`${
        isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } absolute md:relative w-64 bg-white border-r overflow-y-auto h-full transition-transform duration-300 ease-in-out z-10`}>
        <div className="p-4 border-b">
          <button
            onClick={createNote}
            className="w-full bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Nueva Nota
          </button>
        </div>
        <div className="overflow-y-auto">
          {notes.map(note => (
            <div
              key={note.id}
              onClick={() => {
                setCurrentNote(note);
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

      {/* Área principal de edición */}
      <div className="flex-1 flex flex-col">
        <div className="flex justify-between items-center bg-white border-b">
          {/* Botón de toggle sidebar */}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-4 text-gray-600 hover:text-gray-900"
          >
            {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </button>

          {/* Área del título */}
          <div className="flex-1">
            {currentNote.id && (
              <input
                type="text"
                value={currentNote.title || ''}
                onChange={(e) => {
                  const newTitle = e.target.value;
                  setCurrentNote({ ...currentNote, title: newTitle });
                  updateNote(currentNote.id, { title: newTitle });
                }}
                className="text-xl font-semibold w-full p-4 border-none focus:outline-none"
                placeholder="Título de la nota"
              />
            )}
          </div>
          
          {/* Botón de cierre de sesión */}
          <button
            onClick={handleLogout}
            className="px-4 py-2 m-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
          >
            Cerrar Sesión
          </button>
        </div>
        
        {currentNote.id ? (
          <textarea
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