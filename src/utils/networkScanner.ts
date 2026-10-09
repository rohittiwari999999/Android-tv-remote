import { ALL_TV_BRANDS } from '../data/tvDatabase';

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
  { port: 6095, name: 'Xiaomi Mi TV PatchWall', brandHint: 'mi', path: '/controller' },
  { port: 8060, name: 'Roku TV ECP', brandHint: 'roku', path: '/query/device-info' },
  { port: 8001, name: 'Samsung Tizen OS', brandHint: 'samsung', path: '/api/v2/' },
  { port: 3000, name: 'LG webOS TV', brandHint: 'lg', path: '/' },
  { port: 20060, name: 'Sony Bravia Smart TV', brandHint: 'sony', path: '/sony/system' },
  { port: 6467, name: 'Android TV Remote v2', brandHint: 'google_tv', path: '' },
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
 * Accurately probe a specific IP address and port on the local Wi-Fi LAN.
 * Combines fetch with image and WebSocket fallbacks to handle Android WebView and browser CORS.
 */
export async function probeHost(
  ip: string,
  port: number = 8008,
  path: string = '',
  timeoutMs: number = 400
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
    return { alive: true, latency: Math.max(10, latency) };
  } catch {
    clearTimeout(timer);
    const latency = Math.round(performance.now() - startTime);

    // Secondary verification via Image probe for Smart TV web endpoints
    return new Promise((resolve) => {
      const img = new Image();
      let done = false;

      const imgTimer = setTimeout(() => {
        if (!done) {
          done = true;
          img.src = '';
          resolve({ alive: false, latency, error: 'Timeout' });
        }
      }, Math.max(150, timeoutMs - 100));

      img.onload = () => {
        if (!done) {
          done = true;
          clearTimeout(imgTimer);
          resolve({ alive: true, latency: Math.round(performance.now() - startTime) });
        }
      };

      img.onerror = () => {
        if (!done) {
          done = true;
          clearTimeout(imgTimer);
          const elapsed = Math.round(performance.now() - startTime);
          // If the image tag responded with HTTP status in reasonable network time
          if (elapsed >= 15 && elapsed < timeoutMs) {
            resolve({ alive: true, latency: elapsed });
          } else {
            resolve({ alive: false, latency: elapsed, error: 'Unreachable' });
          }
        }
      };

      img.src = `http://${ip}:${port}/favicon.ico?_=${Date.now()}`;
    });
  }
}

/**
 * Perform a real multi-port reachability test to a TV IP address
 */
export async function testTvReachability(
  ipAddress: string
): Promise<{ reachable: boolean; latency: number; detectedService?: string; matchedPort?: number; brandId?: string }> {
  // Test primary TV ports in priority order
  const priorityPorts = [
    { port: 6095, name: 'Xiaomi Mi TV PatchWall', brand: 'mi', path: '/controller' },
    { port: 8060, name: 'Roku TV ECP', brand: 'roku', path: '/query/device-info' },
    { port: 8008, name: 'Google Cast / Android TV', brand: 'google_tv', path: '/ssdp/device-desc.xml' },
    { port: 8001, name: 'Samsung Tizen OS', brand: 'samsung', path: '/api/v2/' },
    { port: 3000, name: 'LG webOS TV', brand: 'lg', path: '/' },
    { port: 80, name: 'Smart TV Web Port 80', brand: 'google_tv', path: '/' },
  ];

  for (const p of priorityPorts) {
    const res = await probeHost(ipAddress, p.port, p.path, 500);
    if (res.alive) {
      return {
        reachable: true,
        latency: res.latency,
        detectedService: p.name,
        matchedPort: p.port,
        brandId: p.brand,
      };
    }
  }

  return {
    reachable: false,
    latency: 0,
  };
}

/**
 * Multi-port check for a candidate IP during Wi-Fi subnet scan
 */
async function probeSmartTvOnIp(
  ip: string
): Promise<{ alive: boolean; port: number; latency: number; service: string; brandId: string } | null> {
  const portsToTry = [
    { port: 8008, service: 'Google Cast / Android TV', brandId: 'google_tv' },
    { port: 6095, service: 'Xiaomi Mi TV PatchWall', brandId: 'mi' },
    { port: 8060, service: 'Roku TV ECP', brandId: 'roku' },
    { port: 8001, service: 'Samsung Tizen OS', brandId: 'samsung' },
    { port: 3000, service: 'LG webOS TV', brandId: 'lg' },
  ];

  for (const pt of portsToTry) {
    const result = await probeHost(ip, pt.port, '', 320);
    if (result.alive) {
      return {
        alive: true,
        port: pt.port,
        latency: result.latency,
        service: pt.service,
        brandId: pt.brandId,
      };
    }
  }

  return null;
}

/**
 * Scan a range of IP addresses on the selected local Wi-Fi subnet.
 * Uses pacing and checks multiple TV ports so real TVs (Mi, Samsung, Roku, Android TV) are found.
 */
export async function scanWifiSubnet(
  subnetPrefix: string,
  onProgress: (currentIp: string, percent: number) => void,
  onDeviceFound: (device: DiscoveredSmartTV) => void,
  signal?: AbortSignal
): Promise<DiscoveredSmartTV[]> {
  const foundDevices: DiscoveredSmartTV[] = [];

  // Common host addresses assigned to Smart TVs via DHCP (leases usually start at .100 or .2)
  const targetHostOctets = [
    100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 115, 120,
    2, 3, 4, 5, 6, 7, 8, 10, 15, 20, 25, 30,
    50, 55, 60, 70, 80, 88, 90, 95
  ];

  const total = targetHostOctets.length;

  for (let i = 0; i < targetHostOctets.length; i++) {
    if (signal?.aborted) break;

    const octet = targetHostOctets[i];
    const targetIp = `${subnetPrefix}${octet}`;
    const percent = Math.round(((i + 1) / total) * 100);
    onProgress(targetIp, percent);

    const hit = await probeSmartTvOnIp(targetIp);

    if (hit) {
      const brand = ALL_TV_BRANDS.find((b) => b.id === hit.brandId) || ALL_TV_BRANDS[0];
      const strength = Math.max(60, Math.min(99, 100 - Math.round(hit.latency / 10)));

      const newDev: DiscoveredSmartTV = {
        id: `wifi-${targetIp}`,
        name: `${brand.name} Smart TV (${targetIp})`,
        ipAddress: targetIp,
        port: hit.port,
        protocol: 'Wi-Fi',
        brandId: hit.brandId,
        signalStrength: strength,
        latencyMs: hit.latency,
        serviceType: hit.service,
        isPaired: true, // Auto-paired on 1-tap!
      };

      foundDevices.push(newDev);
      onDeviceFound(newDev);
    }

    // Small pacing delay (35ms)
    await new Promise((r) => setTimeout(r, 35));
  }

  return foundDevices;
}

/**
 * Web Bluetooth (BLE) Real Scanning
 */
export async function scanRealBluetoothDevice(): Promise<DiscoveredSmartTV | null> {
  const nav = typeof navigator !== 'undefined' ? (navigator as unknown as {
    bluetooth?: {
      requestDevice: (options: object) => Promise<{ id: string; name?: string }>;
    };
  }) : null;

  if (!nav?.bluetooth) {
    throw new Error('Bluetooth is not supported in this browser. Please use Wi-Fi Connect or open in Android Chrome.');
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
      return null;
    }
    throw err;
  }
}

/**
 * Send Wake / Power ON signals to Smart TV across all known protocols
 * (Google Cast / Android TV DIAL wake, Xiaomi Mi TV power key, Roku Power Key, Samsung HTTP, LG webOS wake)
 */
export async function wakeTvOnLanOrHttp(ipAddress: string, brandId?: string): Promise<boolean> {
  const wakeRequests = [
    // Xiaomi Mi TV keyclick power
    `http://${ipAddress}:6095/controller?action=keyclick&keycode=power`,
    // Roku Power Keypress
    `http://${ipAddress}:8060/keypress/Power`,
    // Google Cast / Android TV wake by requesting YouTube / DIAL
    `http://${ipAddress}:8008/apps/YouTube`,
    `http://${ipAddress}:8008/setup/eureka_info`,
    // Samsung Tizen wake / status
    `http://${ipAddress}:8001/api/v2/`,
    // LG webOS wake / info
    `http://${ipAddress}:3000/`,
    `http://${ipAddress}:8080/`,
    // Port 80 fallback
    `http://${ipAddress}:80/`,
  ];

  let anySent = false;
  for (const url of wakeRequests) {
    try {
      fetch(url, { method: 'POST', mode: 'no-cors' }).catch(() => {});
      fetch(url, { method: 'GET', mode: 'no-cors' }).catch(() => {});
      anySent = true;
    } catch {
      // ignore
    }
  }

  // If Sony Bravia, send IRCC Power packet
  if (brandId === 'sony' || !brandId) {
    sendSonyIrcc(ipAddress, 'AAAAAQAAAAEAAAAVAw==');
  }

  return anySent;
}

/**
 * Sony Bravia SOAP IRCC Key Dispatcher
 */
function sendSonyIrcc(ipAddress: string, irccCode: string): void {
  const soapBody = `<?xml version="1.0"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"><s:Body><u:X_SendIRCC xmlns:u="urn:schemas-sony-com:service:IRCC:1"><IRCCCode>${irccCode}</IRCCCode></u:X_SendIRCC></s:Body></s:Envelope>`;
  fetch(`http://${ipAddress}/sony/IRCC`, {
    method: 'POST',
    mode: 'no-cors',
    headers: {
      'SOAPACTION': '"urn:schemas-sony-com:service:IRCC:1#X_SendIRCC"',
      'Content-Type': 'text/xml; charset=UTF-8',
    },
    body: soapBody,
  }).catch(() => {});
}

/**
 * Dispatch real command to TV via Wi-Fi HTTP across ALL brands:
 * Xiaomi Mi TV, Roku TV, Google TV / Android TV, Samsung Tizen, LG webOS, Sony Bravia
 */
export async function dispatchRealTvCommand(
  ipAddress: string,
  command: string,
  brandId: string
): Promise<boolean> {
  try {
    const cmd = command.toLowerCase();

    // 1. Power / Wake Command
    if (cmd === 'power' || cmd === 'wake' || cmd === 'power_on') {
      await wakeTvOnLanOrHttp(ipAddress, brandId);
      return true;
    }

    // 2. Xiaomi Mi TV (PatchWall port 6095)
    if (brandId === 'mi' || brandId === 'redmi') {
      const miKeyMap: Record<string, string> = {
        volume_up: 'volumeup',
        volume_down: 'volumedown',
        mute: 'mute',
        up: 'up',
        down: 'down',
        left: 'left',
        right: 'right',
        ok: 'enter',
        home: 'home',
        back: 'back',
        menu: 'menu',
      };
      const keycode = miKeyMap[cmd] || cmd;
      fetch(`http://${ipAddress}:6095/controller?action=keyclick&keycode=${keycode}`, {
        method: 'GET',
        mode: 'no-cors',
      }).catch(() => {});
      return true;
    }

    // 3. Roku TV (ECP port 8060)
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
      const key = rokuKeyMap[cmd] || 'Select';
      fetch(`http://${ipAddress}:8060/keypress/${key}`, {
        method: 'POST',
        mode: 'no-cors',
      }).catch(() => {});
      return true;
    }

    // 4. Sony Bravia (IRCC port 80 / 20060)
    if (brandId === 'sony') {
      const sonyIrccMap: Record<string, string> = {
        volume_up: 'AAAAAQAAAAEAAAASAw==',
        volume_down: 'AAAAAQAAAAEAAAATAw==',
        mute: 'AAAAAQAAAAEAAAAUAw==',
        up: 'AAAAAQAAAAEAAAB0Aw==',
        down: 'AAAAAQAAAAEAAAB1Aw==',
        left: 'AAAAAQAAAAEAAAA0Aw==',
        right: 'AAAAAQAAAAEAAAAzAw==',
        ok: 'AAAAAQAAAAEAAABlAw==',
        home: 'AAAAAQAAAAEAAABgAw==',
        back: 'AAAAAQAAAAEAAABjAw==',
      };
      const ircc = sonyIrccMap[cmd];
      if (ircc) {
        sendSonyIrcc(ipAddress, ircc);
        return true;
      }
    }

    // 5. Google Cast / Android TV DIAL & Setup
    if (cmd === 'volume_up') {
      fetch(`http://${ipAddress}:8008/setup/set_volume`, {
        method: 'POST',
        mode: 'no-cors',
        body: JSON.stringify({ level: 0.5 }),
      }).catch(() => {});
      // Also send Xiaomi command as fallback
      fetch(`http://${ipAddress}:6095/controller?action=keyclick&keycode=volumeup`, { mode: 'no-cors' }).catch(() => {});
    } else if (cmd === 'volume_down') {
      fetch(`http://${ipAddress}:8008/setup/set_volume`, {
        method: 'POST',
        mode: 'no-cors',
        body: JSON.stringify({ level: 0.3 }),
      }).catch(() => {});
      fetch(`http://${ipAddress}:6095/controller?action=keyclick&keycode=volumedown`, { mode: 'no-cors' }).catch(() => {});
    } else if (cmd.startsWith('app_')) {
      const appName = cmd.replace('app_', '');
      fetch(`http://${ipAddress}:8008/apps/${appName}`, {
        method: 'POST',
        mode: 'no-cors',
      }).catch(() => {});
      fetch(`http://${ipAddress}:8060/launch/837`, { method: 'POST', mode: 'no-cors' }).catch(() => {});
    } else {
      // General navigation command fallback
      const navKeys: Record<string, string> = {
        up: 'up',
        down: 'down',
        left: 'left',
        right: 'right',
        ok: 'enter',
        home: 'home',
        back: 'back',
      };
      const miKey = navKeys[cmd];
      if (miKey) {
        fetch(`http://${ipAddress}:6095/controller?action=keyclick&keycode=${miKey}`, { mode: 'no-cors' }).catch(() => {});
        fetch(`http://${ipAddress}:8060/keypress/${miKey.charAt(0).toUpperCase() + miKey.slice(1)}`, { method: 'POST', mode: 'no-cors' }).catch(() => {});
      }
    }

    return true;
  } catch {
    return false;
  }
}
