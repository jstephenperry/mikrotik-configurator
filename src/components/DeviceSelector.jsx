import { useState } from 'react';
import { X, Search, Plus, Server, Monitor, Check, Zap, Wifi, Radio, Package } from 'lucide-react';
import { getCompatibleSwitches, checkPortCompatibility } from '../utils/compatibility.js';

const CATEGORY_CONFIG = {
  'ethernet-routers':              { icon: Server,  badge: 'badge-router' },
  'switches':                      { icon: Monitor, badge: 'badge-switch' },
  'wireless-for-home-and-office':  { icon: Wifi,    badge: 'badge-wireless' },
  'wireless-systems':              { icon: Wifi,    badge: 'badge-wireless' },
  'lte-5g-products':               { icon: Radio,   badge: 'badge-lte' },
  'iot-products':                  { icon: Radio,   badge: 'badge-lte' },
  '60-ghz-products':               { icon: Wifi,    badge: 'badge-wireless' },
  'routerboard':                   { icon: Server,  badge: 'badge-router' },
  'enclosures':                    { icon: Package, badge: 'badge-accessory' },
  'interfaces':                    { icon: Monitor, badge: 'badge-switch' },
  'accessories':                   { icon: Package, badge: 'badge-accessory' },
  'antennas':                      { icon: Wifi,    badge: 'badge-wireless' },
  'sfp-qsfp':                      { icon: Monitor, badge: 'badge-switch' },
  'new':                           { icon: Server,  badge: 'badge-router' },
};

export default function DeviceSelector({ products, existingDevices, onSelect, onClose }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');

  // Determine if we have routers already to highlight compatible switches
  const existingRouters = existingDevices.filter((d) => d.category === 'ethernet-routers');
  const existingSwitches = existingDevices.filter((d) => d.category === 'switches');

  let compatibleSwitchModels = null;
  if (existingRouters.length > 0) {
    const allSwitches = products.filter((p) => p.category === 'switches');
    const compatSets = existingRouters.map((r) =>
      getCompatibleSwitches(r, allSwitches).map((s) => s.model)
    );
    // Union of all compatible switches across all routers
    compatibleSwitchModels = new Set(compatSets.flat());
  }

  let filtered = products;

  if (filterCategory !== 'all') {
    filtered = filtered.filter((p) => p.category === filterCategory);
  }

  if (searchTerm.trim()) {
    const term = searchTerm.toLowerCase();
    filtered = filtered.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        p.model.toLowerCase().includes(term) ||
        (p.short_descriptor && p.short_descriptor.toLowerCase().includes(term)) ||
        (p.description && p.description.toLowerCase().includes(term))
    );
  }

  function handleOverlayClick(e) {
    if (e.target === e.currentTarget) onClose();
  }

  function isCompatibleHighlight(product) {
    if (!compatibleSwitchModels) return false;
    if (product.category !== 'switches') return false;
    return compatibleSwitchModels.has(product.model);
  }

  function getCompatInfo(product) {
    if (product.category === 'switches' && existingRouters.length > 0) {
      for (const router of existingRouters) {
        const result = checkPortCompatibility(router, product);
        if (result.compatible) {
          return result.matchedPorts.map((m) => `${m.portA} <-> ${m.portB}`).join(', ');
        }
      }
    }
    if (product.category === 'ethernet-routers' && existingSwitches.length > 0) {
      for (const sw of existingSwitches) {
        const result = checkPortCompatibility(product, sw);
        if (result.compatible) {
          return result.matchedPorts.map((m) => `${m.portA} <-> ${m.portB}`).join(', ');
        }
      }
    }
    return null;
  }

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-content device-selector-modal">
        <button className="modal-close" onClick={onClose} aria-label="Close">
          <X size={20} />
        </button>

        <h2 className="selector-title">Add Device</h2>

        <div className="selector-filters">
          <div className="selector-search">
            <Search size={16} />
            <input
              type="text"
              placeholder="Search devices..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="selector-categories">
            {[
              { value: 'all', label: 'All' },
              { value: 'ethernet-routers', label: 'Routers' },
              { value: 'switches', label: 'Switches' },
              { value: 'wireless-for-home-and-office', label: 'Wireless' },
              { value: 'lte-5g-products', label: 'LTE/5G' },
              { value: 'accessories', label: 'Accessories' },
            ].map((cat) => (
              <button
                key={cat.value}
                className={`filter-btn ${filterCategory === cat.value ? 'active' : ''}`}
                onClick={() => setFilterCategory(cat.value)}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        <div className="selector-list">
          {filtered.length === 0 && (
            <div className="selector-empty">No devices match your search.</div>
          )}
          {filtered.map((product) => {
            const isCompat = isCompatibleHighlight(product);
            const compatInfo = getCompatInfo(product);
            const ports = product.ports || {};

            return (
              <div
                key={product._catalogId || product.model}
                className={`selector-item ${isCompat ? 'compatible' : ''}`}
              >
                {product.image_url && (
                  <div className="selector-item-image">
                    <img src={product.image_url} alt="" loading="lazy" />
                  </div>
                )}
                <div className="selector-item-info">
                  <div className="selector-item-header">
                    <span className={`category-badge-sm ${(CATEGORY_CONFIG[product.category] || CATEGORY_CONFIG['ethernet-routers']).badge}`}>
                      {(() => { const CatIcon = (CATEGORY_CONFIG[product.category] || CATEGORY_CONFIG['ethernet-routers']).icon; return <CatIcon size={10} />; })()}
                    </span>
                    <span className="selector-item-name">{product.name}</span>
                    {product.short_descriptor && (
                      <span className="selector-item-descriptor">{product.short_descriptor}</span>
                    )}
                    {ports.poe_out && (
                      <span className="poe-badge-sm">
                        <Zap size={10} />
                      </span>
                    )}
                    {isCompat && (
                      <span className="compat-badge">
                        <Check size={10} /> Compatible
                      </span>
                    )}
                  </div>
                  {compatInfo && (
                    <span className="compat-info">{compatInfo}</span>
                  )}
                  <span className="selector-item-price">
                    {product.price_usd != null ? `$${product.price_usd.toFixed(2)}` : ''}
                  </span>
                </div>
                <button
                  className="btn btn-sm btn-primary"
                  onClick={() => onSelect(product)}
                >
                  <Plus size={14} />
                  <span>Add</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
