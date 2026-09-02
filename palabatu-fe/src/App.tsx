import './App.css'
import 'leaflet/dist/leaflet.css'
import { Header, ErrorBoundary } from './components/index.js'
import { VerifyEmail } from './pages/index.js'
import { Routes, Route } from 'react-router-dom'
import FooterSection from './components/Footer.js'
import { ProblemList } from './pages/ProblemList.js'
import { SpotList } from './pages/SpotList.js'
import { AddSheetProvider } from './lib/AddSheetContext.js'
import { MapPage, Landing, Directory, Profile, Login, Signup, ForgotPassword, ResetPassword, NotFound, ProblemDetailPage, CragDetailPage, BoulderDetailPage, ApproachReadingPage, ApproachCaptureView, AdminReports, AdminMergeRequests, Notifications, ComingSoon, UnderConstruction, Developer } from './pages/index.js'

// Site isn't public yet -- flip to true to bring the real app back online.
const SITE_LIVE = true

// The app is being reworked -- every route falls through to a single
// under-construction screen. Flip to false to unblock the real app.
// Takes precedence over SITE_LIVE: this is the newer of the two curtains.
const UNDER_CONSTRUCTION = true

export default function App() {
  if (UNDER_CONSTRUCTION) {
    return (
      <ErrorBoundary>
        <Routes>
          <Route path="*" element={<UnderConstruction />} />
        </Routes>
      </ErrorBoundary>
    )
  }

  if (!SITE_LIVE) {
    return (
      <ErrorBoundary>
        <Routes>
          <Route path="*" element={<ComingSoon />} />
        </Routes>
      </ErrorBoundary>
    )
  }

  return (
    <ErrorBoundary>
      <AddSheetProvider>
        <div className="min-h-dvh flex flex-col bg-ink">
          <Header />

          {/* The fixed Header/Footer reserve no flow space of their own, so the
              shell pads for both here -- see --header-h/--footer-h in
              index.css. Pages therefore never need their own header offset,
              and nothing they render can land under either bar. */}
          <main className="flex-1 pt-[var(--header-h)] pb-[var(--footer-h)]">
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/map" element={<MapPage />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/profile/:slug" element={<Profile />} />
              <Route path="/verify-email" element={<VerifyEmail />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/directory" element={<Directory />} />
              <Route path="/directory/all" element={<ProblemList />} />
              <Route path="/directory/spots" element={<SpotList />} />
              <Route path="/problems/:id" element={<ProblemDetailPage />} />
              <Route path="/crags/:id" element={<CragDetailPage />} />
              <Route path="/crags/:id/approaches/new" element={<ApproachCaptureView />} />
              <Route path="/approaches/:id" element={<ApproachReadingPage />} />
              <Route path="/boulders/:id" element={<BoulderDetailPage />} />
              <Route path="/admin/reports" element={<AdminReports />} />
              <Route path="/admin/merge-requests" element={<AdminMergeRequests />} />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/developer" element={<Developer />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </main>

          <FooterSection />
        </div>
      </AddSheetProvider>
    </ErrorBoundary>
  )
}