/**
 * MikroTik Network Compatibility Engine
 *
 * Determines physical port compatibility, PoE matching, and validates
 * network topologies built from MikroTik routers and switches.
 */

const PORT_COMPAT = {
  SFP:       { accepts: ['SFP'], speed_gbps: 1 },
  'SFP+':    { accepts: ['SFP+', 'SFP'], speed_gbps: 10 },
  SFP28:     { accepts: ['SFP28', 'SFP+', 'SFP'], speed_gbps: 25 },
  'QSFP+':   { accepts: ['QSFP+'], speed_gbps: 40 },
  QSFP28:    { accepts: ['QSFP28', 'QSFP+'], speed_gbps: 100 },
  RJ45_100M: { accepts: ['RJ45_100M'], speed_gbps: 0.1 },
  RJ45_1G:   { accepts: ['RJ45_1G', 'RJ45_100M'], speed_gbps: 1 },
  'RJ45_2.5G': { accepts: ['RJ45_2.5G', 'RJ45_1G', 'RJ45_100M'], speed_gbps: 2.5 },
  RJ45_5G:   { accepts: ['RJ45_5G', 'RJ45_2.5G', 'RJ45_1G', 'RJ45_100M'], speed_gbps: 5 },
  RJ45_10G:  { accepts: ['RJ45_10G', 'RJ45_5G', 'RJ45_2.5G', 'RJ45_1G', 'RJ45_100M'], speed_gbps: 10 },
};

const POE_COMPAT = {
  '802.3af':    ['802.3af', '802.3at', '802.3bt'],
  '802.3at':    ['802.3at', '802.3bt'],
  '802.3bt':    ['802.3bt'],
  passive_24v:  ['passive_24v'],
  passive_48v:  ['passive_48v'],
};

/**
 * Build a list of { type, count } port descriptors from a device's ports object.
 */
function getPortTypes(device) {
  const ports = device.ports || {};
  const types = [];

  if (ports.sfp_count > 0) types.push({ type: 'SFP', count: ports.sfp_count });
  if (ports.sfp_plus_count > 0) types.push({ type: 'SFP+', count: ports.sfp_plus_count });
  if (ports.sfp28_count > 0) types.push({ type: 'SFP28', count: ports.sfp28_count });
  if (ports.qsfp_plus_count > 0) types.push({ type: 'QSFP+', count: ports.qsfp_plus_count });
  if (ports.qsfp28_count > 0) types.push({ type: 'QSFP28', count: ports.qsfp28_count });

  if (ports.ethernet_count > 0) {
    const speeds = ports.ethernet_speed || ['1G'];
    const highestSpeed = speeds.includes('10G')
      ? 'RJ45_10G'
      : speeds.includes('5G')
        ? 'RJ45_5G'
        : speeds.includes('2.5G')
          ? 'RJ45_2.5G'
          : speeds.includes('1G')
            ? 'RJ45_1G'
            : 'RJ45_100M';
    types.push({ type: highestSpeed, count: ports.ethernet_count });
  }

  return types;
}

/**
 * Check if portTypeA can physically connect to portTypeB.
 */
function canPortsConnect(typeA, typeB) {
  const specA = PORT_COMPAT[typeA];
  const specB = PORT_COMPAT[typeB];
  if (!specA || !specB) return false;
  return specA.accepts.includes(typeB) || specB.accepts.includes(typeA);
}

/**
 * Check if two devices share at least one compatible port type.
 */
export function checkPortCompatibility(deviceA, deviceB) {
  const portsA = getPortTypes(deviceA);
  const portsB = getPortTypes(deviceB);

  for (const pA of portsA) {
    for (const pB of portsB) {
      if (canPortsConnect(pA.type, pB.type)) {
        return {
          compatible: true,
          matchedPorts: [{ portA: pA.type, portB: pB.type }],
        };
      }
    }
  }

  return { compatible: false, matchedPorts: [] };
}

/**
 * Check PoE compatibility between two devices.
 */
export function checkPoeCompatibility(deviceA, deviceB) {
  const pA = deviceA.ports || {};
  const pB = deviceB.ports || {};

  // If neither device has PoE, it is not applicable
  if (!pA.poe_in && !pA.poe_out && !pB.poe_in && !pB.poe_out) {
    return { applicable: false, compatible: false, message: 'Neither device uses PoE' };
  }

  // One provides PoE, other consumes
  const providerA = pA.poe_out;
  const consumerB = pB.poe_in;
  const providerB = pB.poe_out;
  const consumerA = pA.poe_in;

  if ((providerA && consumerB) || (providerB && consumerA)) {
    return { applicable: true, compatible: true, message: 'PoE supply/demand match' };
  }

  if ((providerA || providerB) && !(consumerA || consumerB)) {
    return { applicable: true, compatible: true, message: 'PoE available but not required' };
  }

  if ((consumerA || consumerB) && !(providerA || providerB)) {
    return { applicable: true, compatible: false, message: 'Device needs PoE but no PoE source in this connection' };
  }

  return { applicable: false, compatible: true, message: 'PoE not relevant' };
}

/**
 * Return all switches compatible with a given router.
 */
export function getCompatibleSwitches(router, allSwitches) {
  return allSwitches.filter((sw) => {
    const result = checkPortCompatibility(router, sw);
    return result.compatible;
  });
}

/**
 * Return all devices compatible with a given device (across any category).
 */
export function getCompatibleDevices(device, allDevices) {
  return allDevices.filter((other) => {
    if (other.model === device.model && other._catalogId === device._catalogId) return false;
    const result = checkPortCompatibility(device, other);
    return result.compatible;
  });
}

/**
 * Return all possible connection options between two devices.
 */
export function getConnectionOptions(deviceA, deviceB) {
  const portsA = getPortTypes(deviceA);
  const portsB = getPortTypes(deviceB);
  const options = [];

  for (const pA of portsA) {
    for (const pB of portsB) {
      if (canPortsConnect(pA.type, pB.type)) {
        const speed = calculateEffectiveSpeed(pA.type, pB.type);
        options.push({
          portA: pA.type,
          portB: pB.type,
          availableA: pA.count,
          availableB: pB.count,
          speed_gbps: speed,
        });
      }
    }
  }

  // Sort by speed descending so the fastest option is first
  options.sort((a, b) => b.speed_gbps - a.speed_gbps);
  return options;
}

/**
 * Calculate the effective (weakest link) speed between two port types.
 */
export function calculateEffectiveSpeed(portTypeA, portTypeB) {
  const specA = PORT_COMPAT[portTypeA];
  const specB = PORT_COMPAT[portTypeB];
  if (!specA || !specB) return 0;
  return Math.min(specA.speed_gbps, specB.speed_gbps);
}

/**
 * Validate an entire network topology.
 *
 * @param {Array} devices  - Array of device objects (each with a unique `_id` field)
 * @param {Array} connections - Array of { sourceId, targetId, portTypeA, portTypeB }
 * @returns {{ valid: boolean, errors: Array, warnings: Array, info: Array }}
 */
export function validateTopology(devices, connections) {
  const errors = [];
  const warnings = [];
  const info = [];

  if (devices.length === 0) {
    info.push({ type: 'info', message: 'No devices in topology' });
    return { valid: true, errors, warnings, info };
  }

  // Build a map of port utilization per device
  const portUsage = {};
  devices.forEach((d) => {
    portUsage[d._id] = {};
    const types = getPortTypes(d);
    types.forEach((pt) => {
      portUsage[d._id][pt.type] = { total: pt.count, used: 0 };
    });
  });

  // Validate each connection
  connections.forEach((conn, idx) => {
    const sourceDevice = devices.find((d) => d._id === conn.sourceId);
    const targetDevice = devices.find((d) => d._id === conn.targetId);

    if (!sourceDevice || !targetDevice) {
      errors.push({
        type: 'error',
        connection: idx,
        message: `Connection ${idx + 1} references a missing device`,
      });
      return;
    }

    // Check port compatibility
    if (!canPortsConnect(conn.portTypeA, conn.portTypeB)) {
      errors.push({
        type: 'error',
        connection: idx,
        message: `${conn.portTypeA} on ${sourceDevice.name} cannot connect to ${conn.portTypeB} on ${targetDevice.name}`,
      });
    }

    // Track port usage
    if (portUsage[conn.sourceId] && portUsage[conn.sourceId][conn.portTypeA]) {
      portUsage[conn.sourceId][conn.portTypeA].used += 1;
    }
    if (portUsage[conn.targetId] && portUsage[conn.targetId][conn.portTypeB]) {
      portUsage[conn.targetId][conn.portTypeB].used += 1;
    }

    // Speed info
    const speed = calculateEffectiveSpeed(conn.portTypeA, conn.portTypeB);
    if (speed > 0) {
      info.push({
        type: 'info',
        connection: idx,
        message: `${sourceDevice.name} <-> ${targetDevice.name}: ${speed >= 1 ? speed + ' Gbps' : (speed * 1000) + ' Mbps'}`,
      });
    }
  });

  // Check port over-utilization
  devices.forEach((d) => {
    const usage = portUsage[d._id] || {};
    Object.entries(usage).forEach(([portType, { total, used }]) => {
      if (used > total) {
        errors.push({
          type: 'error',
          device: d._id,
          message: `${d.name}: ${portType} ports over-allocated (${used}/${total})`,
        });
      } else if (used === total && total > 0) {
        warnings.push({
          type: 'warning',
          device: d._id,
          message: `${d.name}: All ${portType} ports used (${used}/${total})`,
        });
      }
    });
  });

  // PoE budget check
  devices.forEach((d) => {
    const ports = d.ports || {};
    if (ports.poe_out && ports.poe_budget_watts) {
      const connectedPoeDevices = connections.filter(
        (c) => c.sourceId === d._id || c.targetId === d._id
      );
      const poeConsumers = connectedPoeDevices
        .map((c) => {
          const otherId = c.sourceId === d._id ? c.targetId : c.sourceId;
          return devices.find((dev) => dev._id === otherId);
        })
        .filter((dev) => dev && dev.ports && dev.ports.poe_in);

      const totalDraw = poeConsumers.reduce(
        (sum, dev) => sum + (dev.max_power_consumption_watts || 15),
        0
      );

      if (totalDraw > ports.poe_budget_watts) {
        errors.push({
          type: 'error',
          device: d._id,
          message: `${d.name}: PoE budget exceeded (${totalDraw}W / ${ports.poe_budget_watts}W)`,
        });
      } else if (totalDraw > ports.poe_budget_watts * 0.8) {
        warnings.push({
          type: 'warning',
          device: d._id,
          message: `${d.name}: PoE budget above 80% (${totalDraw}W / ${ports.poe_budget_watts}W)`,
        });
      }
    }
  });

  // Check for isolated devices
  devices.forEach((d) => {
    const hasConnection = connections.some(
      (c) => c.sourceId === d._id || c.targetId === d._id
    );
    if (!hasConnection && devices.length > 1) {
      warnings.push({
        type: 'warning',
        device: d._id,
        message: `${d.name} is not connected to any other device`,
      });
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    info,
  };
}

/**
 * Get port utilization summary for a device within a topology.
 */
export function getPortUtilization(device, connections) {
  const types = getPortTypes(device);
  const usage = {};

  types.forEach((pt) => {
    usage[pt.type] = { total: pt.count, used: 0 };
  });

  connections.forEach((conn) => {
    if (conn.sourceId === device._id && usage[conn.portTypeA]) {
      usage[conn.portTypeA].used += 1;
    }
    if (conn.targetId === device._id && usage[conn.portTypeB]) {
      usage[conn.portTypeB].used += 1;
    }
  });

  return usage;
}

export { getPortTypes, canPortsConnect, PORT_COMPAT, POE_COMPAT };
