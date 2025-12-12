import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Login from '@/pages/Login'
import ProtectedRoute from '@/components/auth/ProtectedRoute'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={
            <div className="flex flex-col items-center justify-center min-h-screen">
              <h1 className="text-3xl font-bold">Welcome Home</h1>
              <p>You are logged in.</p>
            </div>
          } />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
