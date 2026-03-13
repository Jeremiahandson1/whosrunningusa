import React, { Suspense, lazy } from 'react'
import { Routes, Route } from 'react-router-dom'
import Header from './components/Header'
import Footer from './components/Footer'
import ScrollToTop from './components/ScrollToTop'

// Eager load the home page for fast initial render
import HomePage from './pages/HomePage'

// Lazy load all other pages
const ExplorePage = lazy(() => import('./pages/ExplorePage'))
const CandidatePage = lazy(() => import('./pages/CandidatePage'))
const CandidateEditPage = lazy(() => import('./pages/CandidateEditPage'))
const LoginPage = lazy(() => import('./pages/LoginPage'))
const RegisterPage = lazy(() => import('./pages/RegisterPage'))
const RacesPage = lazy(() => import('./pages/RacesPage'))
const RaceDetailPage = lazy(() => import('./pages/RaceDetailPage'))
const TownHallsPage = lazy(() => import('./pages/TownHallsPage'))
const HowItWorksPage = lazy(() => import('./pages/HowItWorksPage'))
const RunForOfficePage = lazy(() => import('./pages/RunForOfficePage'))
const ComparePage = lazy(() => import('./pages/ComparePage'))
const VotingGuidePage = lazy(() => import('./pages/VotingGuidePage'))
const AboutPage = lazy(() => import('./pages/AboutPage'))
const ContactPage = lazy(() => import('./pages/ContactPage'))
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'))
const TermsPage = lazy(() => import('./pages/TermsPage'))
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'))
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'))
const VerifyEmailPage = lazy(() => import('./pages/VerifyEmailPage'))

const AdminDashboard = lazy(() => import('./pages/admin/DashboardPage'))
const AdminCandidates = lazy(() => import('./pages/admin/CandidatesPage'))
const AdminModeration = lazy(() => import('./pages/admin/ModerationPage'))
const AdminElections = lazy(() => import('./pages/admin/ElectionsPage'))
const AdminUsers = lazy(() => import('./pages/admin/UsersPage'))
const AdminSyncLogs = lazy(() => import('./pages/admin/SyncLogsPage'))

function PageLoader() {
  return (
    <div className="loading-state" style={{ padding: '4rem 0', textAlign: 'center' }}>
      <div className="loading-spinner" />
      Loading...
    </div>
  )
}

function App() {
  return (
    <div className="app">
      <ScrollToTop />
      <Header />
      <main>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/explore" element={<ExplorePage />} />
            <Route path="/candidate/edit" element={<CandidateEditPage />} />
            <Route path="/candidate/:id" element={<CandidatePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/races" element={<RacesPage />} />
            <Route path="/races/:id" element={<RaceDetailPage />} />
            <Route path="/town-halls" element={<TownHallsPage />} />
            <Route path="/how-it-works" element={<HowItWorksPage />} />
            <Route path="/run" element={<RunForOfficePage />} />
            <Route path="/compare" element={<ComparePage />} />
            <Route path="/voting-guide" element={<VotingGuidePage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/mission" element={<AboutPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route path="/candidate-features" element={<RunForOfficePage />} />
            <Route path="/faq-candidates" element={<RunForOfficePage />} />

            {/* Admin */}
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/candidates" element={<AdminCandidates />} />
            <Route path="/admin/moderation" element={<AdminModeration />} />
            <Route path="/admin/elections" element={<AdminElections />} />
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/sync-logs" element={<AdminSyncLogs />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
    </div>
  )
}

export default App
