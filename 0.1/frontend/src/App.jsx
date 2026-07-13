import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AdminPage } from './features/admin/pages/AdminPage/AdminPage'
import { AuthProvider } from './features/auth/AuthProvider'
import { AuthPage } from './features/auth/pages/AuthPage/AuthPage'
import { ProtectedRoute } from './features/auth/ProtectedRoute'
import { StorySimulation } from './features/deepSaga/pages/StorySimulation/StorySimulation'
import { LibraryPage } from './features/library/pages/LibraryPage/LibraryPage'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/library" replace />} />
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/register" element={<AuthPage mode="register" />} />
          <Route path="/library" element={<ProtectedRoute><LibraryPage /></ProtectedRoute>} />
          <Route path="/read/:cycleId" element={<ProtectedRoute><StorySimulation /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute admin><AdminPage /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
