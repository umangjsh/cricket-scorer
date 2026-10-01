import { Routes, Route, Link } from "react-router-dom";
import Home from "./pages/Home.jsx";
import MatchSetup from "./pages/MatchSetup.jsx";
import ScorerView from "./pages/ScorerView.jsx";
import ViewerView from "./pages/ViewerView.jsx";
import Analytics from "./pages/Analytics.jsx";

export default function App() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <Link to="/" className="brand">
          Boundary<span className="dot">•</span>
        </Link>
        <nav>
          <Link to="/setup">New Match</Link>
        </nav>
      </header>
      <main className="page">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/setup" element={<MatchSetup />} />
          <Route path="/match/:id/score/:scorerToken" element={<ScorerView />} />
          <Route path="/match/:id" element={<ViewerView />} />
          <Route path="/match/:id/analytics" element={<Analytics />} />
        </Routes>
      </main>
    </div>
  );
}
