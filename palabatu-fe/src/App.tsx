import './App.css'
import 'leaflet/dist/leaflet.css'
import { Header, ErrorBoundary } from './components/index.js'
import { VerifyEmail } from './pages/index.js'
import { Routes, Route } from 'react-router-dom'
import FooterSection from './components/Footer.js'
import { ProblemList } from './pages/ProblemList.js'
import { MapPage, Landing, Profile, Login, Signup, ForgotPassword, ResetPassword, NotFound, ProblemDetailPage, AdminReports, Notifications } from './pages/index.js'

export default function App() {
  return (
    <ErrorBoundary>
      <div className="min-h-screen flex flex-col">
        <Header />

        <main className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/map" element={<MapPage />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/profile/:id" element={<Profile />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/directory" element={<ProblemList />} />
            <Route path="/problems/:id" element={<ProblemDetailPage />} />
            <Route path="/admin/reports" element={<AdminReports />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>

        <FooterSection />
      </div>
    </ErrorBoundary>
  )
}