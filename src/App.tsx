import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import { GenerationForm } from "@/components/GenerationForm";

export default function App() {
  return (
    <>
      <Router>
        <Routes>
          <Route path="/" element={<GenerationForm />} />
          <Route path="/other" element={<div className="text-center text-xl">Other Page - Coming Soon</div>} />
        </Routes>
      </Router>
      <Toaster />
    </>
  );
}
