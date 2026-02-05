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

function StartParamRouter() {
  const navigate = useNavigate();
  const location = useLocation();
  const processedRef = useRef(false);

  useEffect(() => {
    if (processedRef.current) return;

    const qs = new URLSearchParams(location.search);
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
        navigate("/", { replace: true });
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
        const match = p.match(/^ref-([^-]+)(?:-remix-(\d+))?$/);
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
  const isLoginPage = location.pathname === '/login';

  // Don't show header/tabbar on login page
  if (isLoginPage) {
    return (
      <div className="min-h-screen">
        <Routes>
          <Route path="/login" element={<Login />} />
        </Routes>
      </div>
    );
  }

  return (
    <div className={`${WebApp.platform === 'android' ? 'pt-[calc(env(safe-area-inset-top)+24px)]' : 'pt-[env(safe-area-inset-top)]'} min-h-screen flex flex-col`}>
      <Header />
      <StartParamRouter />
      <div className="flex-1">
        <Routes>
          <Route path="/" element={<PageErrorBoundary pageName="Лента"><Home /></PageErrorBoundary>} />
          <Route path="/chat" element={<Navigate to="/studio?mode=chat" replace />} />
          <Route path="/studio" element={<PageErrorBoundary pageName="Студия"><Studio /></PageErrorBoundary>} />
          <Route path="/top" element={<PageErrorBoundary pageName="Рейтинг"><Leaderboard /></PageErrorBoundary>} />
          <Route path="/profile" element={<PageErrorBoundary pageName="Профиль"><Profile /></PageErrorBoundary>} />
          <Route path="/profile/:userId" element={<PageErrorBoundary pageName="Профиль"><PublicProfile /></PageErrorBoundary>} />
          <Route path="/settings" element={<PageErrorBoundary pageName="Настройки"><Settings /></PageErrorBoundary>} />
          <Route path="/contests/propose" element={<PageErrorBoundary pageName="Создание конкурса"><ProposeContest /></PageErrorBoundary>} />
          <Route path="/contests/:id" element={<PageErrorBoundary pageName="Конкурс"><ContestDetail /></PageErrorBoundary>} />
          <Route path="/accumulations" element={<PageErrorBoundary pageName="Накопления"><Accumulations /></PageErrorBoundary>} />
          <Route path="/events" element={<PageErrorBoundary pageName="События"><EventsPage /></PageErrorBoundary>} />
          <Route path="/spin" element={<PageErrorBoundary pageName="Рулетка"><SpinPage /></PageErrorBoundary>} />
          <Route path="/editor" element={<PageErrorBoundary pageName="Редактор"><ImageEditorPage /></PageErrorBoundary>} />
          <Route path="/multi-generation" element={<PageErrorBoundary pageName="Мульти-генерация"><MultiGeneration /></PageErrorBoundary>} />
          <Route path="/subscriptions" element={<PageErrorBoundary pageName="Подписки"><SubscriptionsPage /></PageErrorBoundary>} />
          <Route path="/watermark" element={<PageErrorBoundary pageName="Водяной знак"><WatermarkEditor /></PageErrorBoundary>} />
          <Route path="/login" element={<Login />} />
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
