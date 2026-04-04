import { Routes, Route, NavLink } from 'react-router-dom';
import { Router, Network, Settings, ShoppingCart } from 'lucide-react';
import CatalogPage from './pages/CatalogPage.jsx';
import BuilderPage from './pages/BuilderPage.jsx';

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <div className="header-brand">
          <Router size={24} />
          <span className="header-title">MikroTik Configurator</span>
        </div>
        <nav className="header-nav">
          <NavLink to="/" end className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            <ShoppingCart size={16} />
            <span>Catalog</span>
          </NavLink>
          <NavLink to="/builder" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            <Network size={16} />
            <span>Network Builder</span>
          </NavLink>
        </nav>
      </header>
      <main className="app-main">
        <Routes>
          <Route path="/" element={<CatalogPage />} />
          <Route path="/builder" element={<BuilderPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
