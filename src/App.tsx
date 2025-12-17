import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { Toaster, toast } from "sonner";
import Home from "@/pages/Home";
import Studio from "@/pages/Studio";
import Leaderboard from "@/pages/Leaderboard";
import Profile from "@/pages/Profile";
import PublicProfile from '@/pages/PublicProfile';
import Settings from "@/pages/Settings";
// Contests page is now integrated into EventsPage
import ContestDetail from "@/pages/ContestDetail";
import Accumulations from "@/pages/Accumulations";
import EventsPage from "@/pages/EventsPage";
import SpinPage from "@/pages/SpinPage";
import { Header } from "@/components/layout/Header";
import { TabBar } from "@/components/layout/TabBar";
import { useEffect, useRef } from "react";
import WebApp from "@twa-dev/sdk";
import { AnnouncementModal } from "@/components/AnnouncementModal";

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
      // Handle legacy/simple params
      if (p === "generate" || p === "studio") {
        navigate("/studio", { replace: true, state: { fromDeepLink: true } });
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

      // Handle dynamic params
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

      // Handle ref with optional remix: ref-{username} or ref-{username}-remix-{id}
      if (p.startsWith("ref-")) {
        const match = p.match(/^ref-([^-]+)(?:-remix-(\d+))?$/);
        if (match) {
          const refValue = match[1];
          const generationId = match[2];
          // Store ref in sessionStorage for subscribe call
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

      // Handle remix without ref: remix-{id}
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

export default function App() {
  useEffect(() => {
    const ensureExpand = () => {
      try { WebApp.expand() } catch { void 0 }
    }
    try {
      WebApp.ready();
      const ver = Number((WebApp as unknown as { version?: string }).version || '0')
      if (WebApp.platform === 'ios' || WebApp.platform === 'android') {
        if (ver >= 8) { try { (WebApp as unknown as { requestFullscreen?: () => void }).requestFullscreen?.() } catch { void 0 } }
      }
      ensureExpand()
      WebApp.onEvent("activated", ensureExpand)
      WebApp.onEvent("viewportChanged", ensureExpand)
      WebApp.setHeaderColor("bg_color");
    } catch { void 0 }
    return () => {
      try {
        WebApp.offEvent("activated", ensureExpand)
        WebApp.offEvent("viewportChanged", ensureExpand)
      } catch { void 0 }
    }
  }, []);
  return (
    <>
      <Router>
        <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
          <div className="absolute -top-20 -left-10 w-[600px] h-[600px] bg-violet-600/10 rounded-full blur-[120px]"></div>
          <div className="absolute -bottom-20 -right-10 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px]"></div>
        </div>
        <div className={`${WebApp.platform === 'android' ? 'pt-[calc(env(safe-area-inset-top)+24px)]' : 'pt-[env(safe-area-inset-top)]'} min-h-screen flex flex-col`}>
          <Header />
          <StartParamRouter />
          <div className="flex-1">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/studio" element={<Studio />} />
              <Route path="/top" element={<Leaderboard />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/profile/:userId" element={<PublicProfile />} />
              <Route path="/settings" element={<Settings />} />
              {/* Contests are now part of EventsPage */}
              <Route path="/contests/:id" element={<ContestDetail />} />
              <Route path="/accumulations" element={<Accumulations />} />
              <Route path="/events" element={<EventsPage />} />
              <Route path="/spin" element={<SpinPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
          <TabBar />
          <AnnouncementModal />
        </div>
      </Router>
      <Toaster />
    </>
  );
}
