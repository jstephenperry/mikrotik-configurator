import { useState } from 'react';
import { X, Plus, ExternalLink, Server, Monitor, Zap, Info, Wifi, Radio, Package } from 'lucide-react';

function SpecRow({ label, value }) {
  if (value == null || value === '') return null;
  return (
    <tr>
      <td className="spec-label">{label}</td>
      <td className="spec-value">{String(value)}</td>
    </tr>
  );
}

const CATEGORY_CONFIG = {
  routers:     { icon: Server,  label: 'Router',    badge: 'badge-router' },
  switches:    { icon: Monitor, label: 'Switch',    badge: 'badge-switch' },
  wireless:    { icon: Wifi,    label: 'Wireless',  badge: 'badge-wireless' },
  lte:         { icon: Radio,   label: 'LTE/5G',    badge: 'badge-lte' },
  accessories: { icon: Package, label: 'Accessory', badge: 'badge-accessory' },
};

export default function ProductDetail({ product, onClose, onAddToNetwork }) {
  const [imgError, setImgError] = useState(false);

  if (!product) return null;

  const ports = product.ports || {};
  const cat = CATEGORY_CONFIG[product.category] || CATEGORY_CONFIG.routers;
  const CatIcon = cat.icon;

  function handleOverlayClick(e) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-content product-detail-modal">
        <button className="modal-close" onClick={onClose} aria-label="Close">
          <X size={20} />
        </button>

        {product.image_url && !imgError ? (
          <div className="detail-image">
            <img
              src={product.image_url}
              alt={product.name}
              onError={() => setImgError(true)}
            />
          </div>
        ) : (
          <div className="detail-image detail-image-fallback">
            <CatIcon size={56} />
          </div>
        )}

        <div className="detail-header">
          <span className={`category-badge ${cat.badge}`}>
            <CatIcon size={14} />
            <span>{cat.label}</span>
          </span>
          <h2 className="detail-name">{product.name}</h2>
          <p className="detail-model">{product.model}</p>
          {product.description && (
            <p className="detail-description">{product.description}</p>
          )}
        </div>

        <div className="detail-body">
          <div className="detail-section">
            <h3 className="section-title">
              <Info size={16} /> Specifications
            </h3>
            <table className="specs-table">
              <tbody>
                <SpecRow label="CPU" value={product.cpu} />
                <SpecRow label="RAM" value={product.ram_mb ? `${product.ram_mb} MB` : null} />
                <SpecRow label="Storage" value={product.storage_mb ? `${product.storage_mb} MB` : null} />
                <SpecRow label="RouterOS License" value={product.routeros_license ? `Level ${product.routeros_license}` : null} />
                <SpecRow label="Switch OS" value={product.switch_os} />
                <SpecRow label="Max Power" value={product.max_power_consumption_watts ? `${product.max_power_consumption_watts}W` : null} />
                <SpecRow label="Temperature" value={product.operating_temp_c} />
                <SpecRow label="Dimensions" value={product.dimensions} />
              </tbody>
            </table>
          </div>

          <div className="detail-section">
            <h3 className="section-title">
              <Server size={16} /> Port Breakdown
            </h3>
            <table className="specs-table">
              <tbody>
                {ports.ethernet_count > 0 && (
                  <SpecRow
                    label="Ethernet"
                    value={`${ports.ethernet_count}x (${(ports.ethernet_speed || ['1G']).join(', ')})`}
                  />
                )}
                <SpecRow label="SFP" value={ports.sfp_count > 0 ? `${ports.sfp_count}x` : null} />
                <SpecRow label="SFP+" value={ports.sfp_plus_count > 0 ? `${ports.sfp_plus_count}x` : null} />
                <SpecRow label="SFP28" value={ports.sfp28_count > 0 ? `${ports.sfp28_count}x` : null} />
                <SpecRow label="QSFP+" value={ports.qsfp_plus_count > 0 ? `${ports.qsfp_plus_count}x` : null} />
                <SpecRow label="QSFP28" value={ports.qsfp28_count > 0 ? `${ports.qsfp28_count}x` : null} />
                <SpecRow label="USB" value={ports.usb_count > 0 ? `${ports.usb_count}x` : null} />
                <SpecRow label="Serial Port" value={ports.serial_port ? 'Yes' : null} />
              </tbody>
            </table>
          </div>

          {(ports.poe_in || ports.poe_out) && (
            <div className="detail-section">
              <h3 className="section-title">
                <Zap size={16} /> PoE Information
              </h3>
              <table className="specs-table">
                <tbody>
                  <SpecRow label="PoE Input" value={ports.poe_in ? 'Yes' : null} />
                  <SpecRow label="PoE Output" value={ports.poe_out ? 'Yes' : null} />
                  <SpecRow label="PoE Out Ports" value={ports.poe_out_ports > 0 ? `${ports.poe_out_ports}` : null} />
                  <SpecRow label="PoE Budget" value={ports.poe_budget_watts ? `${ports.poe_budget_watts}W` : null} />
                </tbody>
              </table>
            </div>
          )}

          {product.wireless && (
            <div className="detail-section">
              <h3 className="section-title">
                <Wifi size={16} /> Wireless
              </h3>
              <table className="specs-table">
                <tbody>
                  <SpecRow label="Standard" value={product.wireless.standard} />
                  <SpecRow label="Bands" value={product.wireless.bands?.join(', ')} />
                  <SpecRow label="Max Data Rate" value={product.wireless.max_data_rate_mbps ? `${product.wireless.max_data_rate_mbps} Mbps` : null} />
                  <SpecRow label="Antenna Gain" value={product.wireless.antenna_gain_dbi ? `${product.wireless.antenna_gain_dbi} dBi` : null} />
                  <SpecRow label="MIMO" value={product.wireless.mimo} />
                </tbody>
              </table>
            </div>
          )}

          {product.lte && (
            <div className="detail-section">
              <h3 className="section-title">
                <Radio size={16} /> LTE/5G Modem
              </h3>
              <table className="specs-table">
                <tbody>
                  <SpecRow label="Category" value={product.lte.category} />
                  <SpecRow label="Max Download" value={product.lte.max_download_mbps ? `${product.lte.max_download_mbps} Mbps` : null} />
                  <SpecRow label="Max Upload" value={product.lte.max_upload_mbps ? `${product.lte.max_upload_mbps} Mbps` : null} />
                  <SpecRow label="Bands" value={product.lte.bands} />
                  <SpecRow label="SIM Slots" value={product.lte.sim_slots} />
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="detail-footer">
          <span className="detail-price">
            {product.price_usd != null ? `$${product.price_usd.toFixed(2)}` : 'Price N/A'}
          </span>
          <div className="detail-actions">
            {product.url && (
              <a
                href={product.url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary"
              >
                <ExternalLink size={14} />
                <span>MikroTik Page</span>
              </a>
            )}
            {onAddToNetwork && (
              <button className="btn btn-primary" onClick={() => onAddToNetwork(product)}>
                <Plus size={14} />
                <span>Add to Network</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
