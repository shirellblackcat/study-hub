import { Route, Routes, useLocation } from 'react-router-dom';
import BottomNav from './components/BottomNav';
import ThemeToggle from './components/ThemeToggle';
import ErrorBoundary from './components/ErrorBoundary';
import Dashboard from './pages/Dashboard';
import Import from './pages/Import';
import Library from './pages/Library';
import GuideDetail from './pages/GuideDetail';
import ManageGuide from './pages/ManageGuide';
import Study from './pages/Study';
import Quiz from './pages/Quiz';
import Search from './pages/Search';

function App() {
  const location = useLocation();
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-100">
      <main className="flex-1 overflow-y-auto pb-20">
        <ThemeToggle />
        {/* Keyed by route so a crash on one page doesn't strand the user —
            navigating away (e.g. via BottomNav, which stays mounted outside
            this boundary) automatically resets the error state. */}
        <ErrorBoundary key={location.pathname + location.search}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/import" element={<Import />} />
            <Route path="/library" element={<Library />} />
            <Route path="/guide/:guideId" element={<GuideDetail />} />
            <Route path="/guide/:guideId/manage" element={<ManageGuide />} />
            <Route path="/study/:guideId" element={<Study />} />
            <Route path="/quiz/:guideId" element={<Quiz />} />
            <Route path="/search" element={<Search />} />
          </Routes>
        </ErrorBoundary>
      </main>
      <BottomNav />
    </div>
  );
}

export default App;
