import { useState } from 'react';
import { Server, Monitor, Zap, Eye, Wifi, Radio, Package } from 'lucide-react';

function formatPorts(ports) {
  if (!ports) return '';
  const parts = [];

  if (ports.ethernet_count > 0) {
    const speeds = (ports.ethernet_speed || ['1G']).join('/');
    parts.push(`${ports.ethernet_count}x ${speeds}`);
  }
  if (ports.sfp_count > 0) parts.push(`${ports.sfp_count}x SFP`);
  if (ports.sfp_plus_count > 0) parts.push(`${ports.sfp_plus_count}x SFP+`);
  if (ports.sfp28_count > 0) parts.push(`${ports.sfp28_count}x SFP28`);
  if (ports.qsfp_plus_count > 0) parts.push(`${ports.qsfp_plus_count}x QSFP+`);
  if (ports.qsfp28_count > 0) parts.push(`${ports.qsfp28_count}x QSFP28`);

  return parts.join(', ');
}

const CATEGORY_CONFIG = {
  routers:     { icon: Server,  label: 'Router',    badge: 'badge-router' },
  switches:    { icon: Monitor, label: 'Switch',    badge: 'badge-switch' },
  wireless:    { icon: Wifi,    label: 'Wireless',  badge: 'badge-wireless' },
  lte:         { icon: Radio,   label: 'LTE/5G',    badge: 'badge-lte' },
  accessories: { icon: Package, label: 'Accessory', badge: 'badge-accessory' },
};

export default function ProductCard({ product, onClick }) {
  const [imgError, setImgError] = useState(false);
  const ports = product.ports || {};
  const portSummary = formatPorts(ports);
  const cat = CATEGORY_CONFIG[product.category] || CATEGORY_CONFIG.routers;
  const CatIcon = cat.icon;

  return (
    <div className="product-card" onClick={() => onClick(product)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') onClick(product); }}>
      {product.image_url && !imgError ? (
        <div className="card-image">
          <img
            src={product.image_url}
            alt={product.name}
            loading="lazy"
            onError={() => setImgError(true)}
          />
        </div>
      ) : (
        <div className="card-image card-image-fallback">
          <CatIcon size={40} />
        </div>
      )}

      <div className="card-header">
        <span className={`category-badge ${cat.badge}`}>
          <CatIcon size={12} />
          <span>{cat.label}</span>
        </span>
        {ports.poe_out && (
          <span className="poe-badge">
            <Zap size={12} />
            <span>PoE{ports.poe_budget_watts ? ` ${ports.poe_budget_watts}W` : ''}</span>
          </span>
        )}
        {product.wireless && (
          <span className="wifi-badge">
            <Wifi size={12} />
            <span>{product.wireless.standard.split(' ')[0]}</span>
          </span>
        )}
        {product.lte && (
          <span className="lte-badge">
            <Radio size={12} />
            <span>{product.lte.category}</span>
          </span>
        )}
      </div>

      <h3 className="card-name">{product.name}</h3>

      {product.short_descriptor && (
        <p className="card-descriptor">{product.short_descriptor}</p>
      )}

      <p className="card-ports">{portSummary}</p>

      <div className="card-footer">
        <span className="card-price">
          {product.price_usd != null ? `$${product.price_usd.toFixed(2)}` : 'Price N/A'}
        </span>
        <span className="card-action">
          <Eye size={14} />
          <span>Details</span>
        </span>
      </div>
    </div>
  );
}
