import { DollarSign, Download, Trash2 } from 'lucide-react';

export default function PricingSummary({ devices, onRemoveDevice }) {
  const total = devices.reduce((sum, d) => sum + (d.price_usd || 0), 0);

  function exportCSV() {
    const headers = ['Name', 'Model', 'Category', 'Price (USD)'];
    const rows = devices.map((d) => [
      `"${d.name}"`,
      `"${d.model}"`,
      d.category,
      d.price_usd != null ? d.price_usd.toFixed(2) : 'N/A',
    ]);
    rows.push(['', '', 'TOTAL', total.toFixed(2)]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'mikrotik-network-pricing.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="pricing-summary">
      <h3 className="panel-title">
        <DollarSign size={16} />
        <span>Pricing Summary</span>
      </h3>

      {devices.length === 0 ? (
        <p className="pricing-empty">No devices added yet.</p>
      ) : (
        <>
          <ul className="pricing-list">
            {devices.map((device) => (
              <li key={device._id} className="pricing-item">
                <div className="pricing-item-info">
                  <span className="pricing-item-name">{device.name}</span>
                  <span className="pricing-item-price">
                    {device.price_usd != null ? `$${device.price_usd.toFixed(2)}` : 'N/A'}
                  </span>
                </div>
                {onRemoveDevice && (
                  <button
                    className="btn-icon btn-icon-danger"
                    onClick={() => onRemoveDevice(device._id)}
                    title="Remove device"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </li>
            ))}
          </ul>

          <div className="pricing-total">
            <span className="pricing-total-label">Total</span>
            <span className="pricing-total-value">${total.toFixed(2)}</span>
          </div>

          <button className="btn btn-secondary pricing-export" onClick={exportCSV}>
            <Download size={14} />
            <span>Export CSV</span>
          </button>
        </>
      )}
    </div>
  );
}
