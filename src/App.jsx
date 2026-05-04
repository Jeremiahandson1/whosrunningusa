import React, { Suspense, lazy, useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import Header from './components/Header'
import Footer from './components/Footer'
import ScrollToTop from './components/ScrollToTop'
import { useAuth } from './context/AuthContext'

// Eager load the home page for fast initial render
import HomePage from './pages/HomePage'

// Lazy load all other pages
const ExplorePage = lazy(() => import('./pages/ExplorePage'))
const CandidatePage = lazy(() => import('./pages/CandidatePage'))
const CandidateDashboardPage = lazy(() => import('./pages/CandidateDashboardPage'))
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
const AdminCriminalRecords = lazy(() => import('./pages/admin/CriminalRecordsPage'))
const EndorsementsPage = lazy(() => import('./pages/EndorsementsPage'))
const ConnectionsPage = lazy(() => import('./pages/ConnectionsPage'))
const PostFeedPage = lazy(() => import('./pages/PostFeedPage'))
const FindMyBallotPage = lazy(() => import('./pages/FindMyBallotPage'))
const IssueMatchPage = lazy(() => import('./pages/IssueMatchPage'))
const AccountabilityPage = lazy(() => import('./pages/AccountabilityPage'))
const AccountabilityMirrorPage = lazy(() => import('./pages/AccountabilityMirrorPage'))
const PetitionsPage = lazy(() => import('./pages/PetitionsPage'))
const RevolvingDoorPage = lazy(() => import('./pages/RevolvingDoorPage'))
const TradingMonitorPage = lazy(() => import('./pages/TradingMonitorPage'))
const TransparencyPage = lazy(() => import('./pages/TransparencyPage'))
const FinanceMapPage = lazy(() => import('./pages/FinanceMapPage'))
const ClaimProfilePage = lazy(() => import('./pages/ClaimProfilePage'))
const ForeignAidPage = lazy(() => import('./pages/ForeignAidPage'))
const DarkMoneyPage = lazy(() => import('./pages/DarkMoneyPage'))
const ForeignInfluencePage = lazy(() => import('./pages/ForeignInfluencePage'))
const RevenueViolationsPage = lazy(() => import('./pages/RevenueViolationsPage'))
const PromiseTrackerPage = lazy(() => import('./pages/PromiseTrackerPage'))
const CostCalculatorPage = lazy(() => import('./pages/CostCalculatorPage'))
const ConflictsPage = lazy(() => import('./pages/ConflictsPage'))
const RubberStampPage = lazy(() => import('./pages/RubberStampPage'))
const BallotMeasuresPage = lazy(() => import('./pages/BallotMeasuresPage'))
const GerrymanderingPage = lazy(() => import('./pages/GerrymanderingPage'))
const VoterAccessPage = lazy(() => import('./pages/VoterAccessPage'))
const PacPledgePage = lazy(() => import('./pages/PacPledgePage'))
const WidgetGalleryPage = lazy(() => import('./pages/WidgetGalleryPage'))
const MissionPage = lazy(() => import('./pages/MissionPage'))
const PlatformFeaturesPage = lazy(() => import('./pages/PlatformFeaturesPage'))
const CandidateFAQPage = lazy(() => import('./pages/CandidateFAQPage'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))

function PageLoader() {
  return (
    <div
      className="loading-state"
      aria-live="polite"
      role="status"
      style={{
        minHeight: 240,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem 1rem',
        textAlign: 'center',
        opacity: 0.7,
      }}
    >
      <div className="loading-spinner" />
    </div>
  )
}

// Once a user is signed in, warm the cache for the routes they're most likely
// to visit next. Calling `import()` here prepopulates Vite's chunk cache so
// that when React.lazy reaches for the same module, it resolves synchronously
// and the post-login navigation no longer flashes the page-loader.
//
// Each chunk goes through `requestIdleCallback` so the JS parse never lands
// on the same frame as a route render — on weaker devices, kicking off four
// imports at once was visibly stalling the renderer.
function AuthChunkPrefetcher() {
  const { user } = useAuth()
  useEffect(() => {
    if (!user) return
    const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 250))
    const cancel = window.cancelIdleCallback || clearTimeout

    const chunks = [
      () => import('./pages/ExplorePage'),
      () => import('./pages/VotingGuidePage'),
      () => import('./pages/PetitionsPage'),
      () => import('./pages/ComparePage'),
    ]
    if (user.user_type === 'candidate') {
      chunks.push(() => import('./pages/CandidateDashboardPage'))
      chunks.push(() => import('./pages/CandidateEditPage'))
    }

    const handles = chunks.map((load, i) =>
      idle(() => { load() }, { timeout: 4000 + i * 500 })
    )
    return () => handles.forEach(cancel)
  }, [user])
  return null
}

function App() {
  return (
    <div className="app">
      <a
        href="#main-content"
        className="skip-to-content"
        style={{
          position: 'absolute',
          left: '-9999px',
          top: '0',
          zIndex: 9999,
          padding: '0.75rem 1.5rem',
          background: 'var(--navy-800)',
          color: 'white',
          fontWeight: 600,
          fontSize: '0.875rem',
          textDecoration: 'none',
          borderRadius: '0 0 8px 0',
        }}
      >
        Skip to main content
      </a>
      <ScrollToTop />
      <AuthChunkPrefetcher />
      <Header />
      <main id="main-content">
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/explore" element={<ExplorePage />} />
            <Route path="/dashboard" element={<CandidateDashboardPage />} />
            <Route path="/candidate/edit" element={<CandidateEditPage />} />
            <Route path="/candidate/:id" element={<CandidatePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/races" element={<RacesPage />} />
            <Route path="/races/:id" element={<RaceDetailPage />} />
            <Route path="/endorsements" element={<EndorsementsPage />} />
            <Route path="/connections" element={<ConnectionsPage />} />
            <Route path="/feed" element={<PostFeedPage />} />
            <Route path="/town-halls" element={<TownHallsPage />} />
            <Route path="/how-it-works" element={<HowItWorksPage />} />
            <Route path="/run" element={<RunForOfficePage />} />
            <Route path="/compare" element={<ComparePage />} />
            <Route path="/voting-guide" element={<VotingGuidePage />} />
            <Route path="/find-my-ballot" element={<FindMyBallotPage />} />
            <Route path="/issue-match" element={<IssueMatchPage />} />
            <Route path="/accountability" element={<AccountabilityPage />} />
            <Route path="/accountability-mirror" element={<AccountabilityMirrorPage />} />
            <Route path="/petitions" element={<PetitionsPage />} />
            <Route path="/revolving-door" element={<RevolvingDoorPage />} />
            <Route path="/trading-monitor" element={<TradingMonitorPage />} />
            <Route path="/transparency" element={<TransparencyPage />} />
            <Route path="/follow-the-money" element={<FinanceMapPage />} />
            <Route path="/finance-map" element={<FinanceMapPage />} />
            <Route path="/claim-profile" element={<ClaimProfilePage />} />
            <Route path="/foreign-aid" element={<ForeignAidPage />} />
            <Route path="/foreign-aid/:countryCode" element={<ForeignAidPage />} />
            <Route path="/dark-money" element={<DarkMoneyPage />} />
            <Route path="/foreign-influence" element={<ForeignInfluencePage />} />
            <Route path="/they-took-it" element={<RevenueViolationsPage />} />
            <Route path="/revenue-violations" element={<RevenueViolationsPage />} />
            <Route path="/promises" element={<PromiseTrackerPage />} />
            <Route path="/cost-calculator" element={<CostCalculatorPage />} />
            <Route path="/conflicts" element={<ConflictsPage />} />
            <Route path="/rubber-stamp" element={<RubberStampPage />} />
            <Route path="/ballot-measures" element={<BallotMeasuresPage />} />
            <Route path="/gerrymandering" element={<GerrymanderingPage />} />
            <Route path="/voter-access" element={<VoterAccessPage />} />
            <Route path="/pac-pledge" element={<PacPledgePage />} />
            <Route path="/widgets" element={<WidgetGalleryPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/mission" element={<MissionPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route path="/candidate-features" element={<PlatformFeaturesPage />} />
            <Route path="/faq-candidates" element={<CandidateFAQPage />} />

            {/* Legacy slug aliases — keep old links working */}
            <Route path="/promise-tracker" element={<PromiseTrackerPage />} />
            <Route path="/cost-to-you" element={<CostCalculatorPage />} />
            <Route path="/conflict-scanner" element={<ConflictsPage />} />

            {/* Admin */}
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/candidates" element={<AdminCandidates />} />
            <Route path="/admin/moderation" element={<AdminModeration />} />
            <Route path="/admin/elections" element={<AdminElections />} />
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/criminal-records" element={<AdminCriminalRecords />} />
            <Route path="/admin/sync-logs" element={<AdminSyncLogs />} />

            {/* 404 catch-all */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
    </div>
  )
}

export default App
