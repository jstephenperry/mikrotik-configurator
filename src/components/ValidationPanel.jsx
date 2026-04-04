import { Check, AlertTriangle, X as XIcon, Info, Server, Zap } from 'lucide-react';
import { validateTopology, getPortUtilization } from '../utils/compatibility.js';

function StatusIcon({ type }) {
  switch (type) {
    case 'error':
      return <XIcon size={14} className="status-icon status-error" />;
    case 'warning':
      return <AlertTriangle size={14} className="status-icon status-warning" />;
    case 'info':
      return <Info size={14} className="status-icon status-info" />;
    default:
      return <Check size={14} className="status-icon status-ok" />;
  }
}

export default function ValidationPanel({ devices, connections }) {
  const result = validateTopology(devices, connections);

  const overallStatus = result.errors.length > 0
    ? 'error'
    : result.warnings.length > 0
      ? 'warning'
      : 'ok';

  const statusLabel = overallStatus === 'error'
    ? 'Errors Found'
    : overallStatus === 'warning'
      ? 'Warnings'
      : 'All Good';

  const statusClass = `overall-status status-${overallStatus}`;

  return (
    <div className="validation-panel">
      <h3 className="panel-title">
        <AlertTriangle size={16} />
        <span>Validation</span>
      </h3>

      <div className={statusClass}>
        {overallStatus === 'ok' && <Check size={18} />}
        {overallStatus === 'warning' && <AlertTriangle size={18} />}
        {overallStatus === 'error' && <XIcon size={18} />}
        <span>{statusLabel}</span>
      </div>

      {/* Port utilization */}
      {devices.length > 0 && (
        <div className="validation-section">
          <h4 className="validation-section-title">
            <Server size={14} /> Port Utilization
          </h4>
          {devices.map((device) => {
            const usage = getPortUtilization(device, connections);
            const entries = Object.entries(usage);
            if (entries.length === 0) return null;

            return (
              <div key={device._id} className="port-util-device">
                <span className="port-util-name">{device.name}</span>
                <div className="port-util-bars">
                  {entries.map(([portType, { total, used }]) => {
                    const pct = total > 0 ? (used / total) * 100 : 0;
                    const barClass = pct > 100 ? 'bar-error' : pct >= 80 ? 'bar-warning' : 'bar-ok';
                    return (
                      <div key={portType} className="port-util-row">
                        <span className="port-util-type">{portType}</span>
                        <div className="port-util-bar-bg">
                          <div
                            className={`port-util-bar-fill ${barClass}`}
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                        <span className="port-util-count">{used}/{total}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Errors */}
      {result.errors.length > 0 && (
        <div className="validation-section">
          <h4 className="validation-section-title validation-errors-title">
            <XIcon size={14} /> Errors ({result.errors.length})
          </h4>
          <ul className="validation-list">
            {result.errors.map((err, i) => (
              <li key={i} className="validation-item validation-error">
                <StatusIcon type="error" />
                <span>{err.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Warnings */}
      {result.warnings.length > 0 && (
        <div className="validation-section">
          <h4 className="validation-section-title validation-warnings-title">
            <AlertTriangle size={14} /> Warnings ({result.warnings.length})
          </h4>
          <ul className="validation-list">
            {result.warnings.map((warn, i) => (
              <li key={i} className="validation-item validation-warning">
                <StatusIcon type="warning" />
                <span>{warn.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Info */}
      {result.info.length > 0 && (
        <div className="validation-section">
          <h4 className="validation-section-title">
            <Info size={14} /> Connection Info
          </h4>
          <ul className="validation-list">
            {result.info.map((inf, i) => (
              <li key={i} className="validation-item validation-info">
                <StatusIcon type="info" />
                <span>{inf.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {devices.length === 0 && (
        <p className="validation-empty">Add devices to see validation results.</p>
      )}
    </div>
  );
}
