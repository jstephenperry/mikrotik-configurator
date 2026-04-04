import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Server, Monitor, Zap, Trash2, Wifi, Radio, Package, ZoomIn, ZoomOut, Maximize, Plus } from 'lucide-react';

const CATEGORY_CONFIG = {
  'ethernet-routers':              { icon: Server,  nodeClass: 'node-router' },
  'switches':                      { icon: Monitor, nodeClass: 'node-switch' },
  'wireless-for-home-and-office':  { icon: Wifi,    nodeClass: 'node-wireless' },
  'wireless-systems':              { icon: Wifi,    nodeClass: 'node-wireless' },
  'lte-5g-products':               { icon: Radio,   nodeClass: 'node-lte' },
  'iot-products':                  { icon: Radio,   nodeClass: 'node-lte' },
  '60-ghz-products':               { icon: Wifi,    nodeClass: 'node-wireless' },
  'routerboard':                   { icon: Server,  nodeClass: 'node-router' },
  'enclosures':                    { icon: Package, nodeClass: 'node-accessory' },
  'interfaces':                    { icon: Monitor, nodeClass: 'node-switch' },
  'accessories':                   { icon: Package, nodeClass: 'node-accessory' },
  'antennas':                      { icon: Wifi,    nodeClass: 'node-wireless' },
  'sfp-qsfp':                      { icon: Monitor, nodeClass: 'node-switch' },
  'new':                           { icon: Server,  nodeClass: 'node-router' },
};

const NODE_WIDTH = 180;
const NODE_HEIGHT = 80;
const GRID_COLS = 4;
const GRID_SPACING_X = 260;
const GRID_SPACING_Y = 160;
const CANVAS_PADDING = 60;

const MIN_ZOOM = 0.15;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.15;

function getNodePosition(index) {
  const col = index % GRID_COLS;
  const row = Math.floor(index / GRID_COLS);
  return {
    x: CANVAS_PADDING + col * GRID_SPACING_X,
    y: CANVAS_PADDING + row * GRID_SPACING_Y,
  };
}

function portLabel(portType) {
  return portType || '';
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export default function TopologyCanvas({
  devices,
  connections,
  onSelectDevice,
  onRemoveDevice,
  onSelectConnection,
  onStartConnect,
  selectedDeviceId,
  connectMode,
  devicePositions,
  onUpdatePositions,
}) {
  const svgRef = useRef(null);
  const wrapperRef = useRef(null);

  // Zoom & pan state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  // Touch state
  const touchRef = useRef({ lastPinchDist: null, isPanning: false, isDragging: null });

  // Track wrapper dimensions for minimap viewport calculation
  const [wrapperSize, setWrapperSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setWrapperSize({ width, height });
      }
    });
    ro.observe(wrapper);
    // Set initial size
    const rect = wrapper.getBoundingClientRect();
    setWrapperSize({ width: rect.width, height: rect.height });
    return () => ro.disconnect();
  }, []);

  // Device drag state
  const [dragging, setDragging] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Build positions map
  const positions = useMemo(() => {
    const pos = {};
    devices.forEach((d, i) => {
      if (devicePositions && devicePositions[d._id]) {
        pos[d._id] = devicePositions[d._id];
      } else {
        pos[d._id] = getNodePosition(i);
      }
    });
    return pos;
  }, [devices, devicePositions]);

  // Convert screen coordinates to SVG coordinates accounting for zoom & pan
  const screenToSvg = useCallback((clientX, clientY) => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return { x: 0, y: 0 };
    const rect = wrapper.getBoundingClientRect();
    return {
      x: (clientX - rect.left - pan.x) / zoom,
      y: (clientY - rect.top - pan.y) / zoom,
    };
  }, [zoom, pan]);

  // --- Zoom ---
  const zoomAt = useCallback((newZoom, centerX, centerY) => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const rect = wrapper.getBoundingClientRect();
    const cx = centerX ?? rect.width / 2;
    const cy = centerY ?? rect.height / 2;

    const clamped = clamp(newZoom, MIN_ZOOM, MAX_ZOOM);
    const ratio = clamped / zoom;

    setPan((prev) => ({
      x: cx - ratio * (cx - prev.x),
      y: cy - ratio * (cy - prev.y),
    }));
    setZoom(clamped);
  }, [zoom]);

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const rect = wrapper.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const direction = e.deltaY < 0 ? 1 : -1;
    const factor = 1 + direction * ZOOM_STEP;
    zoomAt(zoom * factor, cx, cy);
  }, [zoom, zoomAt]);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    wrapper.addEventListener('wheel', handleWheel, { passive: false });
    return () => wrapper.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  // --- Pan (middle-click or background drag) ---
  const handleBackgroundMouseDown = useCallback((e) => {
    // Only start pan on direct SVG background click (not on nodes)
    if (e.target !== svgRef.current && e.target.tagName !== 'rect') return;
    // Allow left-click pan on empty areas, always allow middle-click
    if (e.button === 1 || (e.button === 0 && !dragging)) {
      e.preventDefault();
      setIsPanning(true);
      panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
    }
  }, [pan, dragging]);

  const handlePanMove = useCallback((e) => {
    if (!isPanning) return;
    setPan({
      x: panStart.current.panX + (e.clientX - panStart.current.x),
      y: panStart.current.panY + (e.clientY - panStart.current.y),
    });
  }, [isPanning]);

  const handlePanEnd = useCallback(() => {
    setIsPanning(false);
  }, []);

  useEffect(() => {
    if (isPanning) {
      window.addEventListener('mousemove', handlePanMove);
      window.addEventListener('mouseup', handlePanEnd);
      return () => {
        window.removeEventListener('mousemove', handlePanMove);
        window.removeEventListener('mouseup', handlePanEnd);
      };
    }
  }, [isPanning, handlePanMove, handlePanEnd]);

  // --- Device dragging ---
  const handleDeviceMouseDown = useCallback(
    (e, deviceId) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      const svgPoint = screenToSvg(e.clientX, e.clientY);
      const pos = positions[deviceId] || { x: 0, y: 0 };
      setDragging(deviceId);
      setDragOffset({ x: svgPoint.x - pos.x, y: svgPoint.y - pos.y });
    },
    [positions, screenToSvg]
  );

  const handleDeviceMouseMove = useCallback(
    (e) => {
      if (!dragging) return;
      const svgPoint = screenToSvg(e.clientX, e.clientY);
      const newPositions = {
        ...devicePositions,
        [dragging]: {
          x: svgPoint.x - dragOffset.x,
          y: svgPoint.y - dragOffset.y,
        },
      };
      if (onUpdatePositions) onUpdatePositions(newPositions);
    },
    [dragging, dragOffset, devicePositions, onUpdatePositions, screenToSvg]
  );

  const handleDeviceMouseUp = useCallback(() => {
    setDragging(null);
  }, []);

  useEffect(() => {
    if (dragging) {
      window.addEventListener('mousemove', handleDeviceMouseMove);
      window.addEventListener('mouseup', handleDeviceMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleDeviceMouseMove);
        window.removeEventListener('mouseup', handleDeviceMouseUp);
      };
    }
  }, [dragging, handleDeviceMouseMove, handleDeviceMouseUp]);

  // --- Touch: pinch-to-zoom and single-finger pan ---
  const getPinchDistance = useCallback((touches) => {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }, []);

  const getPinchCenter = useCallback((touches) => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return { x: 0, y: 0 };
    const rect = wrapper.getBoundingClientRect();
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2 - rect.left,
      y: (touches[0].clientY + touches[1].clientY) / 2 - rect.top,
    };
  }, []);

  const handleTouchStart = useCallback((e) => {
    if (e.touches.length === 2) {
      // Pinch-to-zoom start
      e.preventDefault();
      touchRef.current.lastPinchDist = getPinchDistance(e.touches);
      touchRef.current.isPanning = false;
    } else if (e.touches.length === 1) {
      // Check if touch is on a device node (handled separately) or background
      const target = e.target;
      const isOnNode = target.closest && target.closest('.topology-node');
      if (!isOnNode) {
        // Single-finger pan on background
        touchRef.current.isPanning = true;
        panStart.current = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
          panX: pan.x,
          panY: pan.y,
        };
      }
    }
  }, [pan, getPinchDistance]);

  const handleTouchMove = useCallback((e) => {
    if (e.touches.length === 2 && touchRef.current.lastPinchDist !== null) {
      // Pinch-to-zoom
      e.preventDefault();
      const newDist = getPinchDistance(e.touches);
      const scale = newDist / touchRef.current.lastPinchDist;
      const center = getPinchCenter(e.touches);
      zoomAt(zoom * scale, center.x, center.y);
      touchRef.current.lastPinchDist = newDist;
    } else if (e.touches.length === 1) {
      if (touchRef.current.isDragging) {
        // Device touch-drag
        e.preventDefault();
        const touch = e.touches[0];
        const svgPoint = screenToSvg(touch.clientX, touch.clientY);
        const newPositions = {
          ...devicePositions,
          [touchRef.current.isDragging]: {
            x: svgPoint.x - dragOffset.x,
            y: svgPoint.y - dragOffset.y,
          },
        };
        if (onUpdatePositions) onUpdatePositions(newPositions);
      } else if (touchRef.current.isPanning) {
        // Single-finger pan
        e.preventDefault();
        setPan({
          x: panStart.current.panX + (e.touches[0].clientX - panStart.current.x),
          y: panStart.current.panY + (e.touches[0].clientY - panStart.current.y),
        });
      }
    }
  }, [zoom, zoomAt, getPinchDistance, getPinchCenter, screenToSvg, dragOffset, devicePositions, onUpdatePositions]);

  const handleTouchEnd = useCallback((e) => {
    if (e.touches.length < 2) {
      touchRef.current.lastPinchDist = null;
    }
    if (e.touches.length === 0) {
      touchRef.current.isPanning = false;
      if (touchRef.current.isDragging) {
        touchRef.current.isDragging = null;
        setDragging(null);
      }
    }
  }, []);

  // Attach touch events to the wrapper with passive:false to allow preventDefault
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    wrapper.addEventListener('touchstart', handleTouchStart, { passive: false });
    wrapper.addEventListener('touchmove', handleTouchMove, { passive: false });
    wrapper.addEventListener('touchend', handleTouchEnd, { passive: false });
    return () => {
      wrapper.removeEventListener('touchstart', handleTouchStart);
      wrapper.removeEventListener('touchmove', handleTouchMove);
      wrapper.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  // --- Device touch dragging ---
  const handleDeviceTouchStart = useCallback(
    (e, deviceId) => {
      e.stopPropagation();
      const touch = e.touches[0];
      const svgPoint = screenToSvg(touch.clientX, touch.clientY);
      const pos = positions[deviceId] || { x: 0, y: 0 };
      setDragging(deviceId);
      setDragOffset({ x: svgPoint.x - pos.x, y: svgPoint.y - pos.y });
      touchRef.current.isDragging = deviceId;
      touchRef.current.isPanning = false;
    },
    [positions, screenToSvg]
  );

  // --- Fit to view ---
  const fitToView = useCallback(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper || devices.length === 0) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
      return;
    }

    const posArr = Object.values(positions);
    if (posArr.length === 0) return;

    const minX = Math.min(...posArr.map((p) => p.x)) - CANVAS_PADDING;
    const minY = Math.min(...posArr.map((p) => p.y)) - CANVAS_PADDING;
    const maxX = Math.max(...posArr.map((p) => p.x + NODE_WIDTH)) + CANVAS_PADDING;
    const maxY = Math.max(...posArr.map((p) => p.y + NODE_HEIGHT)) + CANVAS_PADDING;

    const contentW = maxX - minX;
    const contentH = maxY - minY;
    const rect = wrapper.getBoundingClientRect();

    const newZoom = clamp(
      Math.min(rect.width / contentW, rect.height / contentH) * 0.9,
      MIN_ZOOM,
      MAX_ZOOM
    );

    setPan({
      x: (rect.width - contentW * newZoom) / 2 - minX * newZoom,
      y: (rect.height - contentH * newZoom) / 2 - minY * newZoom,
    });
    setZoom(newZoom);
  }, [devices, positions]);

  // --- Render ---
  function renderConnection(conn, idx) {
    const sourcePos = positions[conn.sourceId];
    const targetPos = positions[conn.targetId];
    if (!sourcePos || !targetPos) return null;

    const x1 = sourcePos.x + NODE_WIDTH / 2;
    const y1 = sourcePos.y + NODE_HEIGHT / 2;
    const x2 = targetPos.x + NODE_WIDTH / 2;
    const y2 = targetPos.y + NODE_HEIGHT / 2;
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;

    return (
      <g key={`conn-${idx}`} className="topology-connection" onClick={() => onSelectConnection && onSelectConnection(conn, idx)}>
        <line
          x1={x1} y1={y1} x2={x2} y2={y2}
          className="connection-line"
        />
        <rect
          x={midX - 50} y={midY - 12}
          width={100} height={24}
          rx={4}
          className="connection-label-bg"
        />
        <text x={midX} y={midY + 4} textAnchor="middle" className="connection-label-text">
          {portLabel(conn.portTypeA)} / {portLabel(conn.portTypeB)}
        </text>
      </g>
    );
  }

  // Compute port utilization per device for "+" indicators
  const portUtilization = useMemo(() => {
    const util = {};
    devices.forEach((d) => {
      const ports = d.ports || {};
      const types = [];
      if (ports.ethernet_count > 0) {
        const speeds = ports.ethernet_speed || ['1G'];
        const label = speeds.includes('10G') ? 'RJ45_10G'
          : speeds.includes('5G') ? 'RJ45_5G'
          : speeds.includes('2.5G') ? 'RJ45_2.5G'
          : speeds.includes('1G') ? 'RJ45_1G'
          : 'RJ45_100M';
        types.push({ type: label, total: ports.ethernet_count, used: 0, short: 'ETH' });
      }
      if (ports.sfp_count > 0) types.push({ type: 'SFP', total: ports.sfp_count, used: 0, short: 'SFP' });
      if (ports.sfp_plus_count > 0) types.push({ type: 'SFP+', total: ports.sfp_plus_count, used: 0, short: 'SFP+' });
      if (ports.sfp28_count > 0) types.push({ type: 'SFP28', total: ports.sfp28_count, used: 0, short: 'S28' });
      if (ports.qsfp_plus_count > 0) types.push({ type: 'QSFP+', total: ports.qsfp_plus_count, used: 0, short: 'QS+' });
      if (ports.qsfp28_count > 0) types.push({ type: 'QSFP28', total: ports.qsfp28_count, used: 0, short: 'Q28' });

      // Count used ports from connections
      connections.forEach((c) => {
        if (c.sourceId === d._id) {
          const pt = types.find((t) => t.type === c.portTypeA);
          if (pt) pt.used += 1;
        }
        if (c.targetId === d._id) {
          const pt = types.find((t) => t.type === c.portTypeB);
          if (pt) pt.used += 1;
        }
      });

      util[d._id] = types;
    });
    return util;
  }, [devices, connections]);

  function renderDevice(device) {
    const pos = positions[device._id];
    if (!pos) return null;
    const isSelected = selectedDeviceId === device._id;
    const isConnectSource = connectMode && connectMode.sourceId === device._id;
    const catConfig = CATEGORY_CONFIG[device.category] || CATEGORY_CONFIG['ethernet-routers'];
    const CatIcon = catConfig.icon;
    const ports = device.ports || {};
    const totalPorts =
      (ports.ethernet_count || 0) +
      (ports.sfp_count || 0) +
      (ports.sfp_plus_count || 0) +
      (ports.sfp28_count || 0) +
      (ports.qsfp_plus_count || 0) +
      (ports.qsfp28_count || 0);

    // Port "+" indicators: show when selected and not in connect mode
    const portTypes = portUtilization[device._id] || [];
    const availablePorts = portTypes.filter((pt) => pt.used < pt.total);
    const showPortIndicators = isSelected && !connectMode && devices.length >= 2 && availablePorts.length > 0;

    return (
      <g
        key={device._id}
        className={`topology-node ${isSelected ? 'selected' : ''} ${dragging === device._id ? 'dragging' : ''} ${isConnectSource ? 'connect-source' : ''}`}
        onMouseDown={(e) => handleDeviceMouseDown(e, device._id)}
        onTouchStart={(e) => handleDeviceTouchStart(e, device._id)}
        onClick={(e) => {
          e.stopPropagation();
          if (onSelectDevice) onSelectDevice(device._id);
        }}
      >
        <rect
          x={pos.x} y={pos.y}
          width={NODE_WIDTH} height={NODE_HEIGHT}
          rx={8}
          className={`node-rect ${catConfig.nodeClass}`}
        />
        <foreignObject x={pos.x + 8} y={pos.y + 10} width={24} height={24}>
          <div className="node-icon">
            <CatIcon size={18} />
          </div>
        </foreignObject>
        {ports.poe_out && (
          <foreignObject x={pos.x + NODE_WIDTH - 28} y={pos.y + 8} width={20} height={20}>
            <div className="node-poe-icon">
              <Zap size={14} />
            </div>
          </foreignObject>
        )}
        <text x={pos.x + 36} y={pos.y + 24} className="node-name">
          {device.name.length > 18 ? device.name.slice(0, 16) + '...' : device.name}
        </text>
        <text x={pos.x + 36} y={pos.y + 42} className="node-model">
          {device.model}
        </text>
        <text x={pos.x + 10} y={pos.y + 64} className="node-ports">
          {totalPorts} ports
        </text>
        {isSelected && onRemoveDevice && (
          <foreignObject x={pos.x + NODE_WIDTH - 28} y={pos.y + NODE_HEIGHT - 28} width={24} height={24}>
            <button
              className="node-delete-btn"
              onClick={(e) => {
                e.stopPropagation();
                onRemoveDevice(device._id);
              }}
              title="Remove device"
            >
              <Trash2 size={14} />
            </button>
          </foreignObject>
        )}
        {/* Port "+" connection indicators */}
        {showPortIndicators && (
          <foreignObject
            x={pos.x}
            y={pos.y + NODE_HEIGHT + 6}
            width={NODE_WIDTH}
            height={30}
          >
            <div className="node-port-indicators">
              {availablePorts.map((pt) => (
                <button
                  key={pt.type}
                  className="port-add-btn"
                  title={`Connect via ${pt.type} (${pt.total - pt.used} available)`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onStartConnect) onStartConnect(device._id, pt.type);
                  }}
                >
                  <Plus size={10} />
                  <span>{pt.short}</span>
                  <span className="port-add-count">{pt.total - pt.used}</span>
                </button>
              ))}
            </div>
          </foreignObject>
        )}
      </g>
    );
  }

  // Dot-grid background that transforms with zoom & pan for infinite tiling
  const GRID_SIZE = 40;

  return (
    <div
      className={`topology-canvas-wrapper ${isPanning ? 'panning' : ''}`}
      ref={wrapperRef}
    >
      {devices.length === 0 ? (
        <div className="topology-empty">
          <Server size={48} />
          <p>Add devices to start building your network topology</p>
        </div>
      ) : (
        <>
          <svg
            ref={svgRef}
            className="topology-svg"
            width="100%"
            height="100%"
            onMouseDown={handleBackgroundMouseDown}
            style={{ touchAction: 'none' }}
            onClick={(e) => {
              if (e.target === svgRef.current || e.target.tagName === 'rect') {
                if (onSelectDevice) onSelectDevice(null);
              }
            }}
          >
            <defs>
              <pattern
                id="dot-grid"
                width={GRID_SIZE}
                height={GRID_SIZE}
                patternUnits="userSpaceOnUse"
                patternTransform={`translate(${pan.x},${pan.y}) scale(${zoom})`}
              >
                <circle cx={GRID_SIZE / 2} cy={GRID_SIZE / 2} r={0.8} fill="rgba(255,255,255,0.06)" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#dot-grid)" />
            <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
              {connections.map((conn, idx) => renderConnection(conn, idx))}
              {devices.map((device) => renderDevice(device))}
            </g>
          </svg>

          {/* Zoom controls */}
          <div className="canvas-controls">
            <button
              className="canvas-ctrl-btn"
              onClick={() => zoomAt(zoom * (1 + ZOOM_STEP))}
              title="Zoom in"
            >
              <ZoomIn size={16} />
            </button>
            <span className="canvas-zoom-level">{Math.round(zoom * 100)}%</span>
            <button
              className="canvas-ctrl-btn"
              onClick={() => zoomAt(zoom * (1 - ZOOM_STEP))}
              title="Zoom out"
            >
              <ZoomOut size={16} />
            </button>
            <button
              className="canvas-ctrl-btn"
              onClick={fitToView}
              title="Fit to view"
            >
              <Maximize size={16} />
            </button>
          </div>

          {/* Minimap */}
          <MiniMap
            devices={devices}
            positions={positions}
            zoom={zoom}
            pan={pan}
            wrapperSize={wrapperSize}
            onNavigate={(newPan) => setPan(newPan)}
          />
        </>
      )}
    </div>
  );
}

/**
 * A small overview minimap in the corner showing device positions
 * and a viewport rectangle for orientation.
 */
function MiniMap({ devices, positions, zoom, pan, wrapperSize, onNavigate }) {
  const MINIMAP_W = 160;
  const MINIMAP_H = 110;
  const MINIMAP_PAD = 20;

  if (devices.length === 0) return null;

  const posArr = Object.values(positions);
  const minX = Math.min(...posArr.map((p) => p.x)) - MINIMAP_PAD;
  const minY = Math.min(...posArr.map((p) => p.y)) - MINIMAP_PAD;
  const maxX = Math.max(...posArr.map((p) => p.x + NODE_WIDTH)) + MINIMAP_PAD;
  const maxY = Math.max(...posArr.map((p) => p.y + NODE_HEIGHT)) + MINIMAP_PAD;

  const contentW = Math.max(maxX - minX, 200);
  const contentH = Math.max(maxY - minY, 200);
  const scale = Math.min(MINIMAP_W / contentW, MINIMAP_H / contentH);

  // Compute viewport rectangle in minimap coords using tracked wrapper size
  let vpRect = null;
  if (wrapperSize.width > 0 && wrapperSize.height > 0) {
    const vpX = (-pan.x / zoom - minX) * scale;
    const vpY = (-pan.y / zoom - minY) * scale;
    const vpW = (wrapperSize.width / zoom) * scale;
    const vpH = (wrapperSize.height / zoom) * scale;
    vpRect = { x: vpX, y: vpY, width: vpW, height: vpH };
  }

  function handleClick(e) {
    if (wrapperSize.width === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Convert minimap click to SVG coordinate
    const svgX = clickX / scale + minX;
    const svgY = clickY / scale + minY;

    onNavigate({
      x: -svgX * zoom + wrapperSize.width / 2,
      y: -svgY * zoom + wrapperSize.height / 2,
    });
  }

  return (
    <div className="canvas-minimap" onClick={handleClick}>
      <svg width={MINIMAP_W} height={MINIMAP_H}>
        {posArr.map((pos, i) => (
          <rect
            key={i}
            x={(pos.x - minX) * scale}
            y={(pos.y - minY) * scale}
            width={NODE_WIDTH * scale}
            height={NODE_HEIGHT * scale}
            rx={2}
            fill="rgba(14, 165, 233, 0.5)"
            stroke="rgba(14, 165, 233, 0.8)"
            strokeWidth={0.5}
          />
        ))}
        {vpRect && (
          <rect
            x={vpRect.x}
            y={vpRect.y}
            width={vpRect.width}
            height={vpRect.height}
            fill="none"
            stroke="rgba(255,255,255,0.6)"
            strokeWidth={1.5}
            rx={2}
          />
        )}
      </svg>
    </div>
  );
}
