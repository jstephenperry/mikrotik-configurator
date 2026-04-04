import { useReducer, useState, useCallback, useEffect, useRef } from 'react';
import { Plus, Link, Unlink, Server, Trash2 } from 'lucide-react';
import useProducts from '../hooks/useProducts.js';
import DeviceSelector from './DeviceSelector.jsx';
import TopologyCanvas from './TopologyCanvas.jsx';
import ValidationPanel from './ValidationPanel.jsx';
import PricingSummary from './PricingSummary.jsx';
import { getConnectionOptions } from '../utils/compatibility.js';

const STORAGE_KEY = 'mikrotik-configurator-topology';
const NEXT_ID_KEY = 'mikrotik-configurator-next-id';

function loadPersistedState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.devices && Array.isArray(parsed.devices)) {
        const devices = parsed.devices;
        const connections = Array.isArray(parsed.connections)
          ? parsed.connections
          : [];
        const positions =
          parsed.positions &&
          typeof parsed.positions === 'object' &&
          !Array.isArray(parsed.positions)
            ? parsed.positions
            : {};
        return {
          ...parsed,
          devices,
          connections,
          positions,
        };
      }
    }
  } catch {
    // Ignore corrupted data
  }
  return null;
}

function loadNextId() {
  try {
    const saved = localStorage.getItem(NEXT_ID_KEY);
    if (saved) return parseInt(saved, 10) || 1;
  } catch {
    // Ignore
  }
  return 1;
}

let nextId = loadNextId();

function topologyReducer(state, action) {
  switch (action.type) {
    case 'ADD_DEVICE': {
      const device = { ...action.payload, _id: `dev_${nextId++}` };
      try {
        localStorage.setItem(NEXT_ID_KEY, String(nextId));
      } catch {
        // Ignore storage errors to avoid breaking reducer execution
      }
      return {
        ...state,
        devices: [...state.devices, device],
      };
    }
    case 'REMOVE_DEVICE': {
      const id = action.payload;
      const newPositions = { ...state.positions };
      delete newPositions[id];
      return {
        ...state,
        devices: state.devices.filter((d) => d._id !== id),
        connections: state.connections.filter(
          (c) => c.sourceId !== id && c.targetId !== id
        ),
        positions: newPositions,
      };
    }
    case 'ADD_CONNECTION': {
      return {
        ...state,
        connections: [...state.connections, action.payload],
      };
    }
    case 'REMOVE_CONNECTION': {
      return {
        ...state,
        connections: state.connections.filter((_, i) => i !== action.payload),
      };
    }
    case 'UPDATE_POSITIONS': {
      return {
        ...state,
        positions: { ...state.positions, ...action.payload },
      };
    }
    case 'CLEAR_ALL': {
      return { devices: [], connections: [], positions: {} };
    }
    default:
      return state;
  }
}

function getInitialState() {
  return loadPersistedState() || { devices: [], connections: [], positions: {} };
}

export default function NetworkBuilder({ initialProduct, navigationKey }) {
  const { products } = useProducts();
  const [state, dispatch] = useReducer(topologyReducer, null, getInitialState);
  const [showSelector, setShowSelector] = useState(false);
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const [connectMode, setConnectMode] = useState(null); // { sourceId } or null
  const [showConnectionOptions, setShowConnectionOptions] = useState(null);
  const initialProductHandled = useRef(null);

  // Persist topology state to localStorage on every change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore storage errors (quota exceeded, privacy mode, etc.)
    }
  }, [state]);

  // Handle product passed from CatalogPage via navigation state.
  // Track the last-handled navigationKey so each distinct navigation
  // (even to the same route) enqueues a new device add.
  useEffect(() => {
    if (initialProduct && navigationKey !== initialProductHandled.current) {
      initialProductHandled.current = navigationKey;
      dispatch({ type: 'ADD_DEVICE', payload: initialProduct });
    }
  }, [initialProduct, navigationKey]);

  const addDevice = useCallback((product) => {
    dispatch({ type: 'ADD_DEVICE', payload: product });
    setShowSelector(false);
  }, []);

  const removeDevice = useCallback((id) => {
    dispatch({ type: 'REMOVE_DEVICE', payload: id });
    setSelectedDeviceId(null);
    setConnectMode(null);
  }, []);

  const removeConnection = useCallback((idx) => {
    dispatch({ type: 'REMOVE_CONNECTION', payload: idx });
  }, []);

  const updatePositions = useCallback((newPositions) => {
    dispatch({ type: 'UPDATE_POSITIONS', payload: newPositions });
  }, []);

  function handleSelectDevice(deviceId) {
    if (connectMode && deviceId && deviceId !== connectMode.sourceId) {
      // Completing a connection
      const sourceDevice = state.devices.find((d) => d._id === connectMode.sourceId);
      const targetDevice = state.devices.find((d) => d._id === deviceId);

      if (sourceDevice && targetDevice) {
        let options = getConnectionOptions(sourceDevice, targetDevice);

        // If a specific port type was selected via "+", filter to matching options
        if (connectMode.portType) {
          options = options.filter((o) => o.portA === connectMode.portType);
        }

        if (options.length === 1) {
          // Auto-connect when there's only one option
          handleConfirmConnection({
            ...options[0],
            _sourceId: connectMode.sourceId,
            _targetId: deviceId,
          });
          setConnectMode(null);
          return;
        } else if (options.length > 1) {
          setShowConnectionOptions({
            sourceId: connectMode.sourceId,
            targetId: deviceId,
            options,
          });
        }
      }
      setConnectMode(null);
    } else {
      setSelectedDeviceId(deviceId);
    }
  }

  function handleStartConnect(deviceId, portType) {
    const id = deviceId || selectedDeviceId;
    if (id) {
      setConnectMode({ sourceId: id, portType: portType || null });
    }
  }

  function handleConfirmConnection(option) {
    const sourceId = option._sourceId || (showConnectionOptions && showConnectionOptions.sourceId);
    const targetId = option._targetId || (showConnectionOptions && showConnectionOptions.targetId);
    if (sourceId && targetId) {
      dispatch({
        type: 'ADD_CONNECTION',
        payload: {
          sourceId,
          targetId,
          portTypeA: option.portA,
          portTypeB: option.portB,
          speed_gbps: option.speed_gbps,
        },
      });
      setShowConnectionOptions(null);
    }
  }

  const selectedDevice = state.devices.find((d) => d._id === selectedDeviceId);

  return (
    <div className="network-builder">
      {/* Left Sidebar */}
      <aside className="builder-sidebar builder-sidebar-left">
        <div className="sidebar-header">
          <h3>
            <Server size={16} /> Devices ({state.devices.length})
          </h3>
          <div className="sidebar-header-actions">
            {state.devices.length > 0 && (
              <button
                className="btn btn-sm btn-danger"
                onClick={() => {
                  dispatch({ type: 'CLEAR_ALL' });
                  setSelectedDeviceId(null);
                  setConnectMode(null);
                  setShowConnectionOptions(null);
                  setShowSelector(false);
                }}
                title="Clear all devices"
                aria-label="Clear all devices"
              >
                <Trash2 size={14} />
              </button>
            )}
            <button className="btn btn-sm btn-primary" onClick={() => setShowSelector(true)}>
              <Plus size={14} /> Add
            </button>
          </div>
        </div>

        <div className="device-list">
          {state.devices.length === 0 && (
            <p className="sidebar-empty">No devices added. Click "Add" to begin.</p>
          )}
          {state.devices.map((device) => (
            <div
              key={device._id}
              className={`device-list-item ${selectedDeviceId === device._id ? 'selected' : ''}`}
              onClick={() => setSelectedDeviceId(device._id)}
            >
              <span className="device-list-name">{device.name}</span>
              <span className="device-list-price">
                {device.price_usd != null ? `$${device.price_usd.toFixed(2)}` : ''}
              </span>
            </div>
          ))}
        </div>

        {selectedDevice && (
          <div className="device-actions">
            <button
              className="btn btn-sm btn-secondary"
              onClick={handleStartConnect}
              disabled={state.devices.length < 2}
            >
              <Link size={14} />
              <span>{connectMode ? 'Click target...' : 'Connect'}</span>
            </button>
            {connectMode && (
              <button
                className="btn btn-sm btn-secondary"
                onClick={() => setConnectMode(null)}
              >
                <Unlink size={14} />
                <span>Cancel</span>
              </button>
            )}
          </div>
        )}

        {/* Connection list */}
        {state.connections.length > 0 && (
          <div className="connection-list">
            <h4>Connections ({state.connections.length})</h4>
            {state.connections.map((conn, idx) => {
              const src = state.devices.find((d) => d._id === conn.sourceId);
              const tgt = state.devices.find((d) => d._id === conn.targetId);
              return (
                <div key={idx} className="connection-list-item">
                  <span className="connection-info">
                    {src?.name?.slice(0, 12)} - {tgt?.name?.slice(0, 12)}
                  </span>
                  <span className="connection-speed">
                    {conn.speed_gbps >= 1 ? `${conn.speed_gbps}G` : `${conn.speed_gbps * 1000}M`}
                  </span>
                  <button
                    className="btn-icon btn-icon-danger"
                    onClick={() => removeConnection(idx)}
                    title="Remove connection"
                  >
                    <Unlink size={12} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </aside>

      {/* Center Canvas */}
      <div className="builder-canvas">
        {connectMode && (
          <div className="connect-mode-banner">
            Click a target device to connect
            {connectMode.portType ? ` via ${connectMode.portType}` : ''} from {state.devices.find((d) => d._id === connectMode.sourceId)?.name}
          </div>
        )}
        <TopologyCanvas
          devices={state.devices}
          connections={state.connections}
          selectedDeviceId={selectedDeviceId}
          connectMode={connectMode}
          onSelectDevice={handleSelectDevice}
          onRemoveDevice={removeDevice}
          onStartConnect={handleStartConnect}
          devicePositions={state.positions}
          onUpdatePositions={updatePositions}
        />
      </div>

      {/* Right Sidebar */}
      <aside className="builder-sidebar builder-sidebar-right">
        <ValidationPanel devices={state.devices} connections={state.connections} />
        <PricingSummary devices={state.devices} onRemoveDevice={removeDevice} />
      </aside>

      {/* Device Selector Modal */}
      {showSelector && (
        <DeviceSelector
          products={products}
          existingDevices={state.devices}
          onSelect={addDevice}
          onClose={() => setShowSelector(false)}
        />
      )}

      {/* Connection Options Modal */}
      {showConnectionOptions && (
        <div className="modal-overlay" onClick={() => setShowConnectionOptions(null)}>
          <div className="modal-content connection-options-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Select Connection Type</h3>
            <p className="connection-options-subtitle">
              {state.devices.find((d) => d._id === showConnectionOptions.sourceId)?.name}
              {' to '}
              {state.devices.find((d) => d._id === showConnectionOptions.targetId)?.name}
            </p>
            <div className="connection-options-list">
              {showConnectionOptions.options.map((opt, idx) => (
                <button
                  key={idx}
                  className="connection-option-btn"
                  onClick={() => handleConfirmConnection(opt)}
                >
                  <span className="conn-opt-ports">{opt.portA} &harr; {opt.portB}</span>
                  <span className="conn-opt-speed">
                    {opt.speed_gbps >= 1 ? `${opt.speed_gbps} Gbps` : `${opt.speed_gbps * 1000} Mbps`}
                  </span>
                  <span className="conn-opt-avail">
                    ({opt.availableA} / {opt.availableB} available)
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
