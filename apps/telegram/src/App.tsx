import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import Home from "@/pages/Home";
import Studio from "@/pages/Studio";
import Leaderboard from "@/pages/Leaderboard";
import Profile from "@/pages/Profile";
import PublicProfile from '@/pages/PublicProfile';
import Settings from "@/pages/Settings";
import SubscriptionsPage from "@/pages/SubscriptionsPage";
import ProposeContest from "@/pages/ProposeContest";
import ContestDetail from "@/pages/ContestDetail";
import Accumulations from "@/pages/Accumulations";
import EventsPage from "@/pages/EventsPage";
import SpinPage from "@/pages/SpinPage";
import ImageEditorPage from "@/pages/ImageEditorPage";
import MultiGeneration from "@/pages/MultiGeneration";
import WatermarkEditor from "@/pages/WatermarkEditor";
import Login from "@/pages/Login";
import Landing from "@/pages/Landing";
import AuthCallback from "@/pages/AuthCallback";
import PrivacyPolicy from "@/pages/PrivacyPolicy";
import TermsOfService from "@/pages/TermsOfService";
import FAQ from "@/pages/FAQ";
import { PaymentResult } from "@/pages/PaymentResult";
import { Header } from "@/components/layout/Header";
import { TabBar } from "@/components/layout/TabBar";
import { PendingIndicator } from "@/components/PendingIndicator";
import { PageErrorBoundary } from "@/components/ErrorBoundary";
import { useEffect, useRef } from "react";
import WebApp from "@twa-dev/sdk";
import { AnnouncementModal } from "@/components/AnnouncementModal";
import { CloudflareProxyProvider } from "@/contexts/CloudflareProxyContext";
import { DebugOverlay } from "@/components/DebugOverlay";
import { AIChatOverlay } from "@/components/AIChatOverlay";
import { AIFloatingButton } from "@/components/AIFloatingButton";
import { useAuthStore } from "@/store/authStore";

// Check if running inside Telegram WebApp
function isInTelegramWebApp(): boolean {
  return !!(WebApp.initData && WebApp.initDataUnsafe?.user);
}

// Protected route component - redirects to login if not authenticated
function RequireAuth({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { isAuthenticated } = useAuthStore();

  // DEV MODE: bypass auth for local development
  const isDevMode = import.meta.env.DEV || import.meta.env.VITE_DEV_MODE === 'true';
  if (isDevMode) {
    return <>{children}</>;
  }

  // In Telegram Mini App - always allow
  if (isInTelegramWebApp()) {
    return <>{children}</>;
  }

  // Allow users with ?ref= parameter to pass through (StartParamRouter will redirect to /studio)
  const hasRefParam = new URLSearchParams(location.search).has('ref');
  if (hasRefParam) {
    return <>{children}</>;
  }

  // Not authenticated - redirect to landing
  if (!isAuthenticated) {
    return <Navigate to="/landing" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

// Auth redirect - redirects authenticated users away from login
function GuestOnly({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();

  // In Telegram - skip login page
  if (isInTelegramWebApp()) {
    return <Navigate to="/" replace />;
  }

  // Already authenticated - redirect to home
  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function StartParamRouter() {
  const navigate = useNavigate();
  const location = useLocation();
  const processedRef = useRef(false);

  useEffect(() => {
    if (processedRef.current) return;

    const qs = new URLSearchParams(location.search);

    // Handle web referral: ?ref=username (separate from Telegram's ref- deeplinks)
    const webRef = qs.get('ref');
    if (webRef && !localStorage.getItem('aiverse_ref')) {
      localStorage.setItem('aiverse_ref', webRef);
      console.log(`[Referral/Web] Saved ref=${webRef} to localStorage`);
    }

    // If user came with ref param, redirect to studio (auth modal will show if not logged in)
    if (webRef) {
      processedRef.current = true;
      navigate('/studio', { replace: true, state: { fromDeepLink: true, showAuthModal: true } });
      return;
    }

    const fromQuery = qs.get("tgWebAppStartParam") || qs.get("start") || (qs.has("generate") ? "generate" : null) || qs.get("p");
    const fromSdk = WebApp?.initDataUnsafe?.start_param || null;
    const p = fromSdk || fromQuery;


    if (!p) return;

    processedRef.current = true;

    const timer = setTimeout(() => {
      if (p === "generate" || p === "studio") {
        navigate("/studio", { replace: true, state: { fromDeepLink: true } });
        return;
      }
      if (p === "chat") {
        navigate("/studio?mode=chat", { replace: true, state: { fromDeepLink: true } });
        return;
      }
      if (p === "home") {
        navigate("/home", { replace: true });
        return;
      }
      if (p === "top") {
        navigate("/top", { replace: true, state: { fromDeepLink: true } });
        return;
      }
      if (p === "profile") {
        navigate("/profile", { replace: true, state: { fromDeepLink: true } });
        return;
      }
      if (p === "settings") {
        navigate("/settings", { replace: true, state: { fromDeepLink: true } });
        return;
      }
      if (p === "accumulations") {
        navigate("/accumulations", { replace: true, state: { fromDeepLink: true } });
        return;
      }
      if (p === "balance" || p === "payment") {
        navigate("/profile?payment=true", { replace: true, state: { fromDeepLink: true } });
        return;
      }
      if (p === "contests" || p === "events") {
        navigate("/events", { replace: true, state: { fromDeepLink: true } });
        return;
      }
      if (p === "spin" || p === "fortune") {
        navigate("/spin", { replace: true, state: { fromDeepLink: true } });
        return;
      }
      if (p.startsWith("studio-")) {
        const modelId = p.replace("studio-", "");
        navigate(`/studio?model=${modelId}`, { replace: true, state: { fromDeepLink: true } });
        return;
      }
      if (p.startsWith("photo-")) {
        const modelId = p.replace("photo-", "");
        navigate(`/studio?model=${modelId}&media=image`, { replace: true, state: { fromDeepLink: true } });
        return;
      }
      if (p.startsWith("video-")) {
        const modelId = p.replace("video-", "");
        navigate(`/studio?model=${modelId}&media=video`, { replace: true, state: { fromDeepLink: true } });
        return;
      }
      if (p.startsWith("contest-")) {
        const id = p.replace("contest-", "");
        if (id) {
          navigate(`/contests/${id}`, { replace: true, state: { fromDeepLink: true } });
        }
        return;
      }
      if (p.startsWith("profile-")) {
        const id = p.replace("profile-", "");
        if (id) {
          navigate(`/profile/${id}`, { replace: true, state: { fromDeepLink: true } });
        }
        return;
      }
      if (p.startsWith("ref-")) {
        const match = p.match(/^ref-([^-]+)(?:-remix-([a-zA-Z0-9]+))?$/);
        if (match) {
          const refValue = match[1];
          const generationId = match[2];
          if (refValue) {
            sessionStorage.setItem('aiverse_ref', refValue);
          }
          if (generationId) {
            navigate(`/studio?remix=${generationId}`, { replace: true, state: { fromDeepLink: true } });
          } else {
            navigate("/", { replace: true, state: { fromDeepLink: true } });
          }
        }
        return;
      }
      if (p.startsWith("remix-")) {
        const generationId = p.replace("remix-", "");
        if (generationId) {
          navigate(`/studio?remix=${generationId}`, { replace: true, state: { fromDeepLink: true } });
        }
        return;
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [location.search, navigate]);
  return null;
}

// Main App Layout with Header and TabBar
function AppLayout() {
  const location = useLocation();
  const isLoginPage = location.pathname === '/login' || location.pathname === '/landing' || location.pathname.startsWith('/auth/') || location.pathname.startsWith('/payment/') || location.pathname === '/privacy' || location.pathname === '/terms' || location.pathname === '/faq';
  const inTelegram = isInTelegramWebApp();

  // Initialize auth state
  useEffect(() => {
    // If in Telegram, mark as authenticated via Telegram
    if (inTelegram) {
      useAuthStore.getState().setAuthMethod('telegram');
      useAuthStore.getState().setLoading(false);
    } else {
      // Check if we have stored auth
      const stored = useAuthStore.getState();
      if (stored.accessToken && !stored.isTokenExpired()) {
        // Token is valid
        useAuthStore.getState().setLoading(false);
      } else if (stored.refreshToken) {
        // Try to refresh - in real implementation would call refreshTokens()
        useAuthStore.getState().setLoading(false);
      } else {
        useAuthStore.getState().setLoading(false);
      }
    }
  }, [inTelegram]);

  // Check for payment result pages
  const isPaymentResultPage = location.pathname.startsWith('/payment/');

  // Login page or payment result - no header/tabbar
  if (isLoginPage || isPaymentResultPage) {
    return (
      <div className="min-h-screen">
        <Routes>
          <Route path="/landing" element={<GuestOnly><Landing /></GuestOnly>} />
          <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/auth/confirm" element={<AuthCallback />} />
          <Route path="/payment/success" element={<PaymentResult />} />
          <Route path="/payment/fail" element={<PaymentResult />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsOfService />} />
          <Route path="/faq" element={<FAQ />} />
        </Routes>
      </div>
    );
  }

  // Resolve real platform for web/PWA (WebApp.platform is 'unknown' outside Telegram)
  const resolvedPlatform = inTelegram
    ? WebApp.platform
    : /Android/.test(navigator.userAgent) ? 'android' : 'ios-or-desktop'

  return (
    <div className={`${resolvedPlatform === 'android' ? 'pt-[calc(env(safe-area-inset-top)+24px)]' : ''} h-dvh flex flex-col overflow-hidden`}>
      <Header />
      <StartParamRouter />
      <div className="flex-1 overflow-y-auto">
        <Routes>
          {/* Public routes (viewable without auth, but need auth for actions) */}
          <Route path="/" element={<RequireAuth><PageErrorBoundary pageName="Студия"><Studio /></PageErrorBoundary></RequireAuth>} />
          <Route path="/home" element={<PageErrorBoundary pageName="Лента"><Home /></PageErrorBoundary>} />
          <Route path="/studio" element={<PageErrorBoundary pageName="Студия"><Studio /></PageErrorBoundary>} />
          <Route path="/top" element={<PageErrorBoundary pageName="Рейтинг"><Leaderboard /></PageErrorBoundary>} />
          <Route path="/profile/:userId" element={<PageErrorBoundary pageName="Профиль"><PublicProfile /></PageErrorBoundary>} />
          <Route path="/contests/:id" element={<PageErrorBoundary pageName="Конкурс"><ContestDetail /></PageErrorBoundary>} />
          <Route path="/events" element={<PageErrorBoundary pageName="События"><EventsPage /></PageErrorBoundary>} />

          {/* Protected routes - require authentication */}
          <Route path="/chat" element={<Navigate to="/studio?mode=chat" replace />} />
          <Route path="/profile" element={<RequireAuth><PageErrorBoundary pageName="Профиль"><Profile /></PageErrorBoundary></RequireAuth>} />
          <Route path="/settings" element={<RequireAuth><PageErrorBoundary pageName="Настройки"><Settings /></PageErrorBoundary></RequireAuth>} />
          <Route path="/contests/propose" element={<RequireAuth><PageErrorBoundary pageName="Создание конкурса"><ProposeContest /></PageErrorBoundary></RequireAuth>} />
          <Route path="/accumulations" element={<RequireAuth><PageErrorBoundary pageName="Накопления"><Accumulations /></PageErrorBoundary></RequireAuth>} />
          <Route path="/spin" element={<RequireAuth><PageErrorBoundary pageName="Рулетка"><SpinPage /></PageErrorBoundary></RequireAuth>} />
          <Route path="/editor" element={<RequireAuth><PageErrorBoundary pageName="Редактор"><ImageEditorPage /></PageErrorBoundary></RequireAuth>} />
          <Route path="/multi-generation" element={<RequireAuth><PageErrorBoundary pageName="Мульти-генерация"><MultiGeneration /></PageErrorBoundary></RequireAuth>} />
          <Route path="/subscriptions" element={<RequireAuth><PageErrorBoundary pageName="Подписки"><SubscriptionsPage /></PageErrorBoundary></RequireAuth>} />
          <Route path="/watermark" element={<RequireAuth><PageErrorBoundary pageName="Водяной знак"><WatermarkEditor /></PageErrorBoundary></RequireAuth>} />

          {/* Login route */}
          <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />

          {/* Catch all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      <TabBar />
      <PendingIndicator />
      <AnnouncementModal />
      <DebugOverlay />
      <AIChatOverlay />
      <AIFloatingButton />
    </div>
  );
}

export default function App() {
  useEffect(() => {
    const ensureExpand = () => {
      try { WebApp.expand() } catch { void 0 }
    }
    try {
      ensureExpand()
      WebApp.onEvent("activated", ensureExpand)
      WebApp.onEvent("viewportChanged", ensureExpand)

      const loader = document.getElementById('app-loader')
      if (loader) {
        loader.style.opacity = '0'
        setTimeout(() => {
          loader.remove()
        }, 500)
      }
    } catch { void 0 }
    return () => {
      try {
        WebApp.offEvent("activated", ensureExpand)
        WebApp.offEvent("viewportChanged", ensureExpand)
      } catch { void 0 }
    }
  }, []);

  return (
    <CloudflareProxyProvider>
      <Router>
        <AppLayout />
      </Router>
      <Toaster />
    </CloudflareProxyProvider>
  );
}
