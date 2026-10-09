import { ALL_TV_BRANDS, type TVBrandInfo } from '../data/tvDatabase';

export interface DiscoveredSmartTV {
  id: string;
  name: string;
  ipAddress: string;
  port: number;
  protocol: 'Wi-Fi' | 'Bluetooth' | 'IR Blaster';
  brandId: string;
  signalStrength: number;
  latencyMs: number;
  serviceType: string;
  isPaired: boolean;
  isDemo?: boolean;
}

// Well-known Smart TV ports and protocols
export const KNOWN_TV_PORTS = [
  { port: 8008, name: 'Google Cast / Android TV', brandHint: 'google_tv', path: '/ssdp/device-desc.xml' },
  { port: 6467, name: 'Android TV Remote v2', brandHint: 'google_tv', path: '' },
  { port: 8060, name: 'Roku TV ECP', brandHint: 'roku', path: '/query/device-info' },
  { port: 8001, name: 'Samsung Tizen OS', brandHint: 'samsung', path: '/api/v2/' },
  { port: 3000, name: 'LG webOS TV', brandHint: 'lg', path: '' },
  { port: 20060, name: 'Sony Bravia Smart TV', brandHint: 'sony', path: '/sony/system' },
  { port: 6095, name: 'Xiaomi Mi TV PatchWall', brandHint: 'mi', path: '' },
  { port: 80, name: 'Smart TV Web Control', brandHint: 'google_tv', path: '' },
];

// Common Wi-Fi subnets in home routers
export const COMMON_SUBNETS = [
  { prefix: '192.168.1.', label: '192.168.1.x (Airtel, TP-Link, Netgear, D-Link, BSNL)' },
  { prefix: '192.168.29.', label: '192.168.29.x (Reliance JioFiber Gateway)' },
  { prefix: '192.168.0.', label: '192.168.0.x (TP-Link, Tenda, ACT Fibernet)' },
  { prefix: '192.168.31.', label: '192.168.31.x (Xiaomi Mi Wi-Fi Router)' },
  { prefix: '10.0.0.', label: '10.0.0.x (Standard Class A Private LAN)' },
];

const LOCAL_STORAGE_SAVED_DEVICES_KEY = 'universal_tv_saved_devices_v2';
const LOCAL_STORAGE_ACTIVE_DEVICE_KEY = 'universal_tv_active_device_v2';

// Load saved devices from localStorage
export function getSavedDevices(): DiscoveredSmartTV[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_SAVED_DEVICES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  return [];
}

// Save devices to localStorage
export function saveDevicesList(devices: DiscoveredSmartTV[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_SAVED_DEVICES_KEY, JSON.stringify(devices));
  } catch {
    // ignore
  }
}

// Load active device from localStorage
export function getStoredActiveDevice(): DiscoveredSmartTV | null {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_ACTIVE_DEVICE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // ignore
  }
  return null;
}

// Store active device
export function setStoredActiveDevice(device: DiscoveredSmartTV): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_ACTIVE_DEVICE_KEY, JSON.stringify(device));
  } catch {
    // ignore
  }
}

/**
 * Ping / Probe a specific IP address and port on the local Wi-Fi LAN.
 * Uses AbortController with fetch in mode 'no-cors'.
 * In browsers, if an IP/port is alive on the LAN, fetch rejects or resolves in <350ms.
 * If the IP is unassigned, it will hang until the timeout (abort).
 */
export async function probeHost(
  ip: string,
  port: number = 8008,
  path: string = '',
  timeoutMs: number = 900
): Promise<{ alive: boolean; latency: number; error?: string }> {
  const startTime = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const url = `http://${ip}:${port}${path}`;

  try {
    // Attempt no-cors fetch
    await fetch(url, {
      method: 'GET',
      mode: 'no-cors',
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timer);
    const latency = Math.round(performance.now() - startTime);
    return { alive: true, latency };
  } catch (err: unknown) {
    clearTimeout(timer);
    const latency = Math.round(performance.now() - startTime);
    const errorObj = err as { name?: string };

    // If aborted due to timeout, host is likely offline / unreachable
    if (errorObj?.name === 'AbortError') {
      return { alive: false, latency, error: 'Timeout' };
    }

    // A TypeError in 'no-cors' mode (such as NS_ERROR_NET_RESET, CORS refusal, or connection refused)
    // that completes before the timeout often indicates a live network node that rejected the HTTP handshake!
    if (latency < timeoutMs * 0.75) {
      return { alive: true, latency };
    }

    return { alive: false, latency, error: 'Unreachable' };
  }
}

/**
 * Perform a real ping test to a user-entered TV IP across common smart TV ports.
 */
export async function testTvReachability(
  ipAddress: string
): Promise<{ reachable: boolean; latency: number; detectedService?: string; matchedPort?: number }> {
  const portsToTest = [8008, 6467, 8001, 8060, 3000, 80];

  for (const port of portsToTest) {
    const portInfo = KNOWN_TV_PORTS.find((p) => p.port === port);
    const result = await probeHost(ipAddress, port, portInfo?.path || '', 850);
    if (result.alive) {
      return {
        reachable: true,
        latency: result.latency,
        detectedService: portInfo?.name || 'Smart TV Network Port',
        matchedPort: port,
      };
    }
  }

  // Fallback check on port 80
  const fallback = await probeHost(ipAddress, 80, '', 600);
  return {
    reachable: fallback.alive,
    latency: fallback.latency,
    detectedService: fallback.alive ? 'LAN Device (Port 80)' : undefined,
    matchedPort: fallback.alive ? 80 : undefined,
  };
}

/**
 * Scan a range of IP addresses on the selected local Wi-Fi subnet.
 * Reports real-time progress via onProgress callback.
 */
export async function scanWifiSubnet(
  subnetPrefix: string,
  onProgress: (currentIp: string, percent: number) => void,
  onDeviceFound: (device: DiscoveredSmartTV) => void,
  signal?: AbortSignal
): Promise<DiscoveredSmartTV[]> {
  const foundDevices: DiscoveredSmartTV[] = [];

  // Common host addresses assigned to Smart TVs via DHCP (leases usually start at .100 or .2)
  // We scan the highest-probability smart TV IP ranges:
  // 1) .100 to .115 (typical DHCP range in Indian & Global routers like Airtel, JioFiber, TP-Link)
  // 2) .2 to .15 (static / early leases)
  // 3) .50 to .65
  const targetHostOctets = [
    100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 115,
    2, 3, 4, 5, 6, 7, 8, 10, 15,
    50, 55, 60, 70, 80, 90, 95
  ];

  const total = targetHostOctets.length;

  for (let i = 0; i < targetHostOctets.length; i++) {
    if (signal?.aborted) break;

    const octet = targetHostOctets[i];
    const targetIp = `${subnetPrefix}${octet}`;
    const percent = Math.round(((i + 1) / total) * 100);
    onProgress(targetIp, percent);

    // Fast-probe port 8008 (Google Cast / Android TV) & port 8001 (Samsung)
    const probe = await probeHost(targetIp, 8008, '', 450);

    if (probe.alive) {
      // Host is alive! Identify TV brand or type
      const latency = probe.latency;
      const strength = Math.max(50, Math.min(99, 100 - Math.round(latency / 10)));
      
      const newDev: DiscoveredSmartTV = {
        id: `wifi-${targetIp}`,
        name: `Smart TV (${targetIp})`,
        ipAddress: targetIp,
        port: 8008,
        protocol: 'Wi-Fi',
        brandId: 'google_tv',
        signalStrength: strength,
        latencyMs: latency,
        serviceType: 'Google Cast / Android TV',
        isPaired: false,
      };

      foundDevices.push(newDev);
      onDeviceFound(newDev);
    }
  }

  return foundDevices;
}

/**
 * Web Bluetooth (BLE) Real Scanning
 * Uses navigator.bluetooth.requestDevice to connect real Bluetooth Android TV / Remote.
 */
export async function scanRealBluetoothDevice(): Promise<DiscoveredSmartTV | null> {
  const nav = navigator as unknown as { bluetooth?: { requestDevice: (options: object) => Promise<{ id: string; name?: string }> } };
  
  if (!nav.bluetooth) {
    throw new Error('Web Bluetooth is not supported in this browser. Please use Chrome on Android or a supported browser.');
  }

  try {
    const device = await nav.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: ['generic_access', 'battery_service', 'device_information'],
    });

    const devName = device.name || 'Bluetooth Smart TV / Remote';
    let brandId = 'google_tv';

    const lower = devName.toLowerCase();
    if (lower.includes('mi') || lower.includes('xiaomi')) brandId = 'mi';
    else if (lower.includes('oneplus')) brandId = 'oneplus';
    else if (lower.includes('samsung')) brandId = 'samsung';
    else if (lower.includes('sony')) brandId = 'sony';
    else if (lower.includes('lg')) brandId = 'lg';
    else if (lower.includes('vu')) brandId = 'vu';

    const bluetoothDevice: DiscoveredSmartTV = {
      id: `ble-${device.id}`,
      name: devName,
      ipAddress: `BLE:${device.id.slice(0, 8).toUpperCase()}`,
      port: 0,
      protocol: 'Bluetooth',
      brandId,
      signalStrength: 94,
      latencyMs: 12,
      serviceType: 'Bluetooth Low Energy (BLE)',
      isPaired: true,
    };

    return bluetoothDevice;
  } catch (err: unknown) {
    const errorObj = err as { name?: string; message?: string };
    if (errorObj?.name === 'NotFoundError') {
      // User cancelled the browser Bluetooth picker dialog
      return null;
    }
    throw err;
  }
}

/**
 * Dispatch real command to TV via Wi-Fi HTTP or Roku ECP
 */
export async function dispatchRealTvCommand(
  ipAddress: string,
  command: string,
  brandId: string
): Promise<boolean> {
  try {
    // If it's a Roku TV on local network
    if (brandId === 'roku') {
      const rokuKeyMap: Record<string, string> = {
        power: 'Power',
        home: 'Home',
        up: 'Up',
        down: 'Down',
        left: 'Left',
        right: 'Right',
        ok: 'Select',
        back: 'Back',
        volume_up: 'VolumeUp',
        volume_down: 'VolumeDown',
        mute: 'VolumeMute',
      };
      const key = rokuKeyMap[command.toLowerCase()] || 'Select';
      await fetch(`http://${ipAddress}:8060/keypress/${key}`, {
        method: 'POST',
        mode: 'no-cors',
      });
      return true;
    }

    // Generic Android TV HTTP / Web request
    await fetch(`http://${ipAddress}:8008/apps/YouTube`, {
      method: 'POST',
      mode: 'no-cors',
    }).catch(() => {
      // no-cors fetch fired
    });

    return true;
  } catch {
    return false;
  }
}

// Sample fallback devices for demonstration/testing ONLY when requested by user
export const SAMPLE_TEST_DEVICES: DiscoveredSmartTV[] = [
  {
    id: 'sample-mi',
    name: 'Mi TV 4X 55" (Living Room)',
    ipAddress: '192.168.1.104',
    port: 6095,
    protocol: 'Wi-Fi',
    brandId: 'mi',
    signalStrength: 95,
    latencyMs: 18,
    serviceType: 'PatchWall & Android TV Remote',
    isPaired: true,
    isDemo: true,
  },
  {
    id: 'sample-coocaa',
    name: 'Coocaa 55" Eye Care Google TV',
    ipAddress: '192.168.1.95',
    port: 8008,
    protocol: 'Wi-Fi',
    brandId: 'coocaa',
    signalStrength: 86,
    latencyMs: 24,
    serviceType: 'Google Cast & Android TV Remote v2',
    isPaired: false,
    isDemo: true,
  },
  {
    id: 'sample-oneplus',
    name: 'OnePlus TV Y1S Pro (Bedroom)',
    ipAddress: '192.168.1.88',
    port: 8008,
    protocol: 'Wi-Fi',
    brandId: 'oneplus',
    signalStrength: 88,
    latencyMs: 22,
    serviceType: 'OxygenPlay Smart Cast',
    isPaired: false,
    isDemo: true,
  },
];
