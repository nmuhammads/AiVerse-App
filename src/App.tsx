import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import Home from "@/pages/Home";
import Studio from "@/pages/Studio";
import Leaderboard from "@/pages/Leaderboard";
import Profile from "@/pages/Profile";
import { Header } from "@/components/layout/Header";
import { TabBar } from "@/components/layout/TabBar";

export default function App() {
  return (
    <>
      <Router>
        <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
          <div className="absolute -top-20 -left-10 w-[600px] h-[600px] bg-violet-600/10 rounded-full blur-[120px]"></div>
          <div className="absolute -bottom-20 -right-10 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px]"></div>
        </div>
        <Header />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/studio" element={<Studio />} />
          <Route path="/top" element={<Leaderboard />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <TabBar />
      </Router>
      <Toaster />
    </>
  );
}
