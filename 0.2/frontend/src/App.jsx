import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './features/auth/AuthProvider'
import { AuthPage } from './features/auth/pages/AuthPage'
import { ProtectedRoute } from './features/auth/ProtectedRoute'
import { LibraryPage } from './features/library/pages/LibraryPage'
import { StoryPage } from './features/story/pages/StoryPage'
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/library" replace />} />
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/register" element={<AuthPage mode="register" />} />
          <Route path="/library" element={<ProtectedRoute><LibraryPage /></ProtectedRoute>} />
          <Route path="/read/:cycleId" element={<ProtectedRoute><StoryPage /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/library" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
