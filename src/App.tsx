import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { Toaster, toast } from "sonner";
import Home from "@/pages/Home";
import Studio from "@/pages/Studio";
import Leaderboard from "@/pages/Leaderboard";
import Profile from "@/pages/Profile";
import PublicProfile from '@/pages/PublicProfile';
import Settings from "@/pages/Settings";
import SubscriptionsPage from "@/pages/SubscriptionsPage";
// Contests page is now integrated into EventsPage
import ContestDetail from "@/pages/ContestDetail";
import Accumulations from "@/pages/Accumulations";
import EventsPage from "@/pages/EventsPage";
import SpinPage from "@/pages/SpinPage";
import ImageEditorPage from "@/pages/ImageEditorPage";
import MultiGeneration from "@/pages/MultiGeneration";
import WatermarkEditor from "@/pages/WatermarkEditor";
import { Header } from "@/components/layout/Header";
import { TabBar } from "@/components/layout/TabBar";
import { PendingIndicator } from "@/components/PendingIndicator";
import { useEffect, useRef } from "react";
import WebApp from "@twa-dev/sdk";
import { AnnouncementModal } from "@/components/AnnouncementModal";
import { CloudflareProxyProvider } from "@/contexts/CloudflareProxyContext";

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
      if (p === "spin" || p === "fortune") {
        navigate("/spin", { replace: true, state: { fromDeepLink: true } });
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
      ensureExpand()
      WebApp.onEvent("activated", ensureExpand)
      WebApp.onEvent("viewportChanged", ensureExpand)

      // Remove preloader
      const loader = document.getElementById('app-loader')
      if (loader) {
        // Add fade out effect
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
              <Route path="/editor" element={<ImageEditorPage />} />
              <Route path="/multi-generation" element={<MultiGeneration />} />
              <Route path="/subscriptions" element={<SubscriptionsPage />} />
              <Route path="/watermark" element={<WatermarkEditor />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
          <TabBar />
          <PendingIndicator />
          <AnnouncementModal />
        </div>
      </Router>
      <Toaster />
    </CloudflareProxyProvider>
  );
}
