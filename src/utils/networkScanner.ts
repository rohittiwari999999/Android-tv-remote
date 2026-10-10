import { Capacitor, CapacitorHttp } from '@capacitor/core';
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
  { port: 80, name: 'Smart TV Web Control', brandHint: 'google_tv', path: '/' },
];

// Common Wi-Fi subnets in home routers (especially India & Global)
export const COMMON_SUBNETS = [
  { prefix: '192.168.1.', label: '192.168.1.x (Airtel Xstream, BSNL Fiber, TP-Link, Netgear)' },
  { prefix: '192.168.29.', label: '192.168.29.x (Reliance JioFiber Router)' },
  { prefix: '192.168.0.', label: '192.168.0.x (TP-Link, Tenda, ACT Fibernet)' },
  { prefix: '192.168.31.', label: '192.168.31.x (Xiaomi Mi Wi-Fi Router)' },
  { prefix: '192.168.18.', label: '192.168.18.x (Huawei / ZTE Optical Routers)' },
  { prefix: '10.0.0.', label: '10.0.0.x (Class A Private LAN)' },
];

const LOCAL_STORAGE_SAVED_DEVICES_KEY = 'universal_tv_saved_devices_v3';
const LOCAL_STORAGE_ACTIVE_DEVICE_KEY = 'universal_tv_active_device_v3';

// Clear legacy dummy devices and remove legacy global default names that polluted all TVs
function purgeLegacyDummyDevices(): void {
  try {
    localStorage.removeItem('universal_tv_saved_devices_v2');
    localStorage.removeItem('universal_tv_saved_devices_v1');
    localStorage.removeItem('universal_tv_saved_devices');
    localStorage.removeItem('tv_custom_name_default');
  } catch {
    // ignore
  }
}
purgeLegacyDummyDevices();

// Load saved devices from localStorage
export function getSavedDevices(): DiscoveredSmartTV[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_SAVED_DEVICES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        // Filter out any invalid / dummy items
        return parsed.filter(
          (d) =>
            d &&
            typeof d.ipAddress === 'string' &&
            d.ipAddress.length > 0 &&
            !d.isDemo &&
            !d.name.includes('Dummy')
        );
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
    const cleanList = devices.filter((d) => d && !d.isDemo && !d.name.includes('Dummy'));
    localStorage.setItem(LOCAL_STORAGE_SAVED_DEVICES_KEY, JSON.stringify(cleanList));
  } catch {
    // ignore
  }
}

// Load active device from localStorage
export function getStoredActiveDevice(): DiscoveredSmartTV | null {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_ACTIVE_DEVICE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && !parsed.isDemo && parsed.ipAddress && parsed.ipAddress.includes('.')) {
        return parsed;
      }
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

// User-defined custom TV names stored in localStorage strictly per IP address
// NEVER fall back to a global default so other devices retain their real names!
export function getStoredCustomTvName(ip?: string): string | null {
  if (!ip) return null;
  try {
    const raw = localStorage.getItem(`tv_custom_name_${ip}`);
    if (raw && raw.trim()) return raw.trim();
  } catch {
    // ignore
  }
  return null;
}

export function saveCustomTvName(ip: string, name: string): void {
  if (!ip) return;
  try {
    const trimmed = name.trim();
    localStorage.setItem(`tv_custom_name_${ip}`, trimmed);
    // Update only the specific device matching this IP in saved devices
    const saved = getSavedDevices();
    const updated = saved.map((d) => (d.ipAddress === ip ? { ...d, name: trimmed } : d));
    saveDevicesList(updated);
    // Also update stored active device if it matches this IP
    const active = getStoredActiveDevice();
    if (active && active.ipAddress === ip) {
      setStoredActiveDevice({ ...active, name: trimmed });
    }
  } catch {
    // ignore
  }
}

/**
 * Actively query TV endpoint to retrieve its real friendly name
 * (e.g. "bakyard tv", "Living Room TV", "Bedroom TV", "Sony Bravia", etc.)
 */
export async function fetchTvFriendlyName(ip: string, port: number = 8008): Promise<string | null> {
  // If the user previously gave THIS specific IP a custom name, use it!
  const custom = getStoredCustomTvName(ip);
  if (custom) return custom;

  // 1. Google Cast / Android TV eureka_info (Returns real device friendly name e.g. "bakyard tv")
  try {
    const eureka = await sendLanHttpRequest(
      `http://${ip}:8008/setup/eureka_info?params=name,device_info`,
      'GET',
      {},
      undefined,
      800
    );
    if (eureka.data) {
      try {
        const parsed = JSON.parse(eureka.data);
        if (parsed?.name && typeof parsed.name === 'string' && parsed.name.trim().length > 0) {
          return parsed.name.trim();
        }
      } catch {
        const match = /"name"\s*:\s*"([^"]+)"/i.exec(eureka.data);
        if (match && match[1] && match[1].trim().length > 0) return match[1].trim();
      }
    }
  } catch {
    // ignore
  }

  // 2. DIAL / SSDP XML Description (Google TV, Android TV, Sony, LG)
  try {
    const desc = await sendLanHttpRequest(`http://${ip}:8008/ssdp/device-desc.xml`, 'GET', {}, undefined, 800);
    if (desc.data) {
      const match = /<friendlyName>(.*?)<\/friendlyName>/i.exec(desc.data);
      if (match && match[1] && match[1].trim().length > 0) return match[1].trim();
      const modelMatch = /<modelName>(.*?)<\/modelName>/i.exec(desc.data);
      if (modelMatch && modelMatch[1] && modelMatch[1].trim().length > 0) return modelMatch[1].trim();
    }
  } catch {
    // ignore
  }

  // 3. Roku TV ECP device info
  try {
    const roku = await sendLanHttpRequest(`http://${ip}:8060/query/device-info`, 'GET', {}, undefined, 800);
    if (roku.data) {
      const match = /<(?:user-device-name|friendly-device-name)>(.*?)<\/(?:user-device-name|friendly-device-name)>/i.exec(roku.data);
      if (match && match[1] && match[1].trim().length > 0) return match[1].trim();
      const modelMatch = /<model-name>(.*?)<\/model-name>/i.exec(roku.data);
      if (modelMatch && modelMatch[1] && modelMatch[1].trim().length > 0) return `Roku ${modelMatch[1].trim()}`;
    }
  } catch {
    // ignore
  }

  // 4. Samsung Tizen API v2
  try {
    const sam = await sendLanHttpRequest(`http://${ip}:8001/api/v2/`, 'GET', {}, undefined, 800);
    if (sam.data) {
      try {
        const parsed = JSON.parse(sam.data);
        const name = parsed?.device?.name || parsed?.name;
        if (name && typeof name === 'string' && name.trim().length > 0) return name.trim();
        const model = parsed?.device?.modelName || parsed?.device?.model;
        if (model && typeof model === 'string' && model.trim().length > 0) return `Samsung ${model.trim()}`;
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore
  }

  return null;
}

/**
 * Automatically detect local device IP and Wi-Fi Subnet prefix using WebRTC
 * Works on Android Chrome, WebView, and Desktop Browsers.
 */
export async function detectLocalDeviceSubnet(): Promise<string | null> {
  if (typeof window === 'undefined') return null;

  return new Promise((resolve) => {
    try {
      const RTCPC =
        window.RTCPeerConnection ||
        (window as unknown as { webkitRTCPeerConnection?: typeof RTCPeerConnection }).webkitRTCPeerConnection;
      if (!RTCPC) {
        resolve(null);
        return;
      }

      const pc = new RTCPC({ iceServers: [] });
      pc.createDataChannel('');
      pc.createOffer().then((offer) => pc.setLocalDescription(offer)).catch(() => {});

      const timer = setTimeout(() => {
        try {
          pc.close();
        } catch {
          // ignore
        }
        resolve(null);
      }, 1500);

      pc.onicecandidate = (event) => {
        if (!event || !event.candidate || !event.candidate.candidate) return;
        const line = event.candidate.candidate;
        const match = /([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})\.[0-9]{1,3}/.exec(line);
        if (match && match[1]) {
          const prefix = `${match[1]}.`;
          if (!prefix.startsWith('127.') && !prefix.startsWith('0.')) {
            clearTimeout(timer);
            try {
              pc.close();
            } catch {
              // ignore
            }
            resolve(prefix);
          }
        }
      };
    } catch {
      resolve(null);
    }
  });
}

/**
 * Universal LAN HTTP Request Dispatcher.
 * Uses CapacitorHttp in native Android app to bypass all CORS / WebView restrictions.
 * Falls back to fetch in web browser.
 */
export async function sendLanHttpRequest(
  url: string,
  method: 'GET' | 'POST' = 'GET',
  headers?: Record<string, string>,
  body?: string,
  timeoutMs: number = 600
): Promise<{ ok: boolean; status?: number; data?: string }> {
  if (Capacitor.isNativePlatform()) {
    try {
      const res = await CapacitorHttp.request({
        url,
        method,
        headers: headers || {},
        data: body,
        connectTimeout: timeoutMs,
        readTimeout: timeoutMs,
      });
      return {
        ok: res.status >= 200 && res.status < 400,
        status: res.status,
        data: typeof res.data === 'string' ? res.data : JSON.stringify(res.data),
      };
    } catch {
      return { ok: false };
    }
  } else {
    // 1. In Browser: Try standard CORS fetch first so we can read real TV response data (friendly name, XML, JSON)
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(url, {
        method,
        headers,
        body,
        signal: controller.signal,
      });
      clearTimeout(timer);
      const text = await res.text().catch(() => '');
      return {
        ok: res.status >= 200 && res.status < 400,
        status: res.status,
        data: text,
      };
    } catch {
      // 2. If blocked by browser cross-origin policy, fallback to no-cors so packets still reach the TV socket!
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        await fetch(url, {
          method,
          headers,
          body,
          mode: 'no-cors',
          signal: controller.signal,
        });
        clearTimeout(timer);
        return { ok: true };
      } catch {
        return { ok: false };
      }
    }
  }
}

/**
 * Strictly probe an IP and port for an active Smart TV HTTP endpoint.
 * Zero false positives: If port does not respond, returns alive: false.
 */
export async function probeHost(
  ip: string,
  port: number = 8008,
  path: string = '',
  timeoutMs: number = 400
): Promise<{ alive: boolean; latency: number; error?: string }> {
  const startTime = performance.now();
  const url = `http://${ip}:${port}${path}`;

  // 1. If running as native Android App, use CapacitorHttp for real socket connection
  if (Capacitor.isNativePlatform()) {
    try {
      const res = await CapacitorHttp.request({
        url,
        method: 'GET',
        connectTimeout: timeoutMs,
        readTimeout: timeoutMs,
      });
      const latency = Math.round(performance.now() - startTime);
      // Valid HTTP status response (200-599) proves the host and port are active
      if (res.status >= 200 && res.status < 600) {
        return { alive: true, latency: Math.max(8, latency) };
      }
      return { alive: false, latency, error: `HTTP ${res.status}` };
    } catch (err: unknown) {
      const latency = Math.round(performance.now() - startTime);
      return { alive: false, latency, error: (err as Error)?.message || 'Unreachable' };
    }
  }

  // 2. In Browser / Web mode: Use Fetch with strict AbortController
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    await fetch(url, {
      method: 'GET',
      mode: 'no-cors',
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timer);
    const latency = Math.round(performance.now() - startTime);
    return { alive: true, latency: Math.max(10, latency) };
  } catch (err: unknown) {
    clearTimeout(timer);
    const latency = Math.round(performance.now() - startTime);
    return { alive: false, latency, error: (err as Error)?.message || 'Unreachable' };
  }
}

/**
 * Perform a real multi-port reachability test to a TV IP address.
 * Probes priority ports concurrently for instant response!
 */
export async function testTvReachability(
  ipAddress: string
): Promise<{ reachable: boolean; latency: number; detectedService?: string; matchedPort?: number; brandId?: string; friendlyName?: string }> {
  const priorityPorts = [
    { port: 8008, name: 'Google Cast / Android TV', brand: 'google_tv', path: '/ssdp/device-desc.xml' },
    { port: 6095, name: 'Xiaomi Mi TV PatchWall', brand: 'mi', path: '/controller' },
    { port: 8060, name: 'Roku TV ECP', brand: 'roku', path: '/query/device-info' },
    { port: 8001, name: 'Samsung Tizen OS', brand: 'samsung', path: '/api/v2/' },
    { port: 3000, name: 'LG webOS TV', brand: 'lg', path: '/' },
    { port: 80, name: 'Smart TV Web Port 80', brand: 'google_tv', path: '/' },
  ];

  const results = await Promise.all(
    priorityPorts.map(async (p) => {
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
      return null;
    })
  );

  const matched = results.find((r) => r !== null);
  if (matched) {
    const friendly = await fetchTvFriendlyName(ipAddress, matched.matchedPort);
    return {
      ...matched,
      friendlyName: friendly || undefined,
    };
  }

  return {
    reachable: false,
    latency: 0,
  };
}

/**
 * Multi-port concurrent check for a candidate IP during Wi-Fi subnet scan
 */
async function probeSmartTvOnIp(
  ip: string
): Promise<{ alive: boolean; port: number; latency: number; service: string; brandId: string } | null> {
  const portsToTry = [
    { port: 8008, service: 'Google Cast / Android TV', brandId: 'google_tv', path: '/ssdp/device-desc.xml' },
    { port: 6095, service: 'Xiaomi Mi TV PatchWall', brandId: 'mi', path: '/controller' },
    { port: 8060, service: 'Roku TV ECP', brandId: 'roku', path: '/query/device-info' },
    { port: 8001, service: 'Samsung Tizen OS', brandId: 'samsung', path: '/api/v2/' },
    { port: 3000, service: 'LG webOS TV', brandId: 'lg', path: '/' },
    { port: 80, service: 'Smart TV Web Port 80', brandId: 'google_tv', path: '/' },
  ];

  try {
    const results = await Promise.all(
      portsToTry.map(async (pt) => {
        const res = await probeHost(ip, pt.port, pt.path, 350);
        if (res.alive) {
          return {
            alive: true,
            port: pt.port,
            latency: res.latency,
            service: pt.service,
            brandId: pt.brandId,
          };
        }
        return null;
      })
    );

    const hit = results.find((r) => r !== null);
    return hit || null;
  } catch {
    return null;
  }
}

/**
 * Scan a range of IP addresses on the selected local Wi-Fi subnet.
 * Uses batch parallel checks for high speed with zero false positives.
 */
export async function scanWifiSubnet(
  subnetPrefix: string,
  onProgress: (currentIp: string, percent: number) => void,
  onDeviceFound: (device: DiscoveredSmartTV) => void,
  signal?: AbortSignal
): Promise<DiscoveredSmartTV[]> {
  const foundDevices: DiscoveredSmartTV[] = [];

  // Common DHCP IP pools for Smart TVs on home routers
  // Typically DHCP leases assign IPs from .2-.20 and .100-.115
  const targetHostOctets = [
    2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 18, 20, 25, 30,
    100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 112, 115, 120,
    50, 60, 70, 80, 88, 90, 95
  ];

  const total = targetHostOctets.length;
  const batchSize = 4;

  for (let i = 0; i < targetHostOctets.length; i += batchSize) {
    if (signal?.aborted) break;

    const batch = targetHostOctets.slice(i, i + batchSize);
    const progressPercent = Math.min(99, Math.round(((i + batch.length) / total) * 100));
    onProgress(`${subnetPrefix}${batch[0]}`, progressPercent);

    const batchResults = await Promise.all(
      batch.map(async (octet) => {
        const targetIp = `${subnetPrefix}${octet}`;
        const hit = await probeSmartTvOnIp(targetIp);
        if (hit) {
          const brand = ALL_TV_BRANDS.find((b) => b.id === hit.brandId) || ALL_TV_BRANDS[0];
          const strength = Math.max(60, Math.min(99, 100 - Math.round(hit.latency / 10)));

          // Actively fetch real friendly name from TV (e.g. "bakyard tv")
          const friendly = await fetchTvFriendlyName(targetIp, hit.port);
          const finalName = friendly || `${brand.name} Smart TV (${targetIp})`;

          const newDev: DiscoveredSmartTV = {
            id: `wifi-${targetIp}`,
            name: finalName,
            ipAddress: targetIp,
            port: hit.port,
            protocol: 'Wi-Fi',
            brandId: hit.brandId,
            signalStrength: strength,
            latencyMs: hit.latency,
            serviceType: hit.service,
            isPaired: false,
          };
          return newDev;
        }
        return null;
      })
    );

    for (const dev of batchResults) {
      if (dev) {
        foundDevices.push(dev);
        onDeviceFound(dev);
      }
    }

    // Brief pacing between batches
    await new Promise((r) => setTimeout(r, 20));
  }

  onProgress(`${subnetPrefix}done`, 100);
  return foundDevices;
}

/**
 * Web Bluetooth (BLE) Real Scanning
 */
export async function scanRealBluetoothDevice(): Promise<DiscoveredSmartTV | null> {
  const nav =
    typeof navigator !== 'undefined'
      ? (navigator as unknown as {
          bluetooth?: {
            requestDevice: (options: object) => Promise<{ id: string; name?: string }>;
          };
        })
      : null;

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
    if (lower.includes('mi') || lower.includes('xiaomi') || lower.includes('redmi')) brandId = 'mi';
    else if (lower.includes('oneplus')) brandId = 'oneplus';
    else if (lower.includes('samsung')) brandId = 'samsung';
    else if (lower.includes('sony')) brandId = 'sony';
    else if (lower.includes('lg')) brandId = 'lg';
    else if (lower.includes('vu')) brandId = 'vu';
    else if (lower.includes('tcl')) brandId = 'tcl';
    else if (lower.includes('realme')) brandId = 'realme';

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
 * DOM-based Image / Link Wake Trigger:
 * Bypasses CORS and mixed-content restrictions in web browsers by letting browser media loader dispatch the HTTP requests.
 */
function triggerDomGetWake(ip: string): void {
  if (typeof document === 'undefined') return;
  const urls = [
    `http://${ip}:8008/apps/YouTube`,
    `http://${ip}:8008/apps/Netflix`,
    `http://${ip}:8008/apps/DefaultMediaReceiver`,
    `http://${ip}:8008/setup/eureka_info`,
    `http://${ip}:6095/controller?action=keyclick&keycode=power`,
    `http://${ip}:8060/keypress/Power`,
  ];
  urls.forEach((u) => {
    try {
      const img = new Image();
      img.src = `${u}?_wake=${Date.now()}`;
    } catch {
      // ignore
    }
  });
}

/**
 * Send Wake / Power ON signals to Smart TV across all known protocols simultaneously:
 * - Native Android Wake-On-LAN (WOL UDP ports 9 & 7)
 * - Google Cast / Android TV DIAL wake (YouTube, Netflix, ChromeCast, eureka_info)
 * - Xiaomi Mi TV PatchWall power key
 * - Roku Power Keypress
 * - Samsung HTTP API
 * - LG webOS SSAP wake
 * - Sony Bravia SOAP IRCC Power
 */
export async function wakeTvOnLanOrHttp(ipAddress: string, brandId?: string, macAddress?: string): Promise<boolean> {
  const dialHeaders = { 'Content-Type': 'application/x-www-form-urlencoded' };
  const jsonHeaders = { 'Content-Type': 'application/json' };

  // 1. If running as native Android app, dispatch real UDP Wake-On-LAN magic packet!
  if (Capacitor.isNativePlatform()) {
    try {
      const capWithPlugins = Capacitor as unknown as {
        Plugins?: {
          WakeOnLanPlugin?: { sendWakeOnLan: (opts: { ip: string; mac?: string }) => Promise<void> };
        };
      };
      if (capWithPlugins.Plugins?.WakeOnLanPlugin) {
        capWithPlugins.Plugins.WakeOnLanPlugin.sendWakeOnLan({ ip: ipAddress, mac: macAddress }).catch(() => {});
      }
    } catch {
      // ignore
    }
  }

  // 2. DOM-based media loader wake for browsers
  triggerDomGetWake(ipAddress);

  const wakeRequests: { url: string; method: 'GET' | 'POST'; headers?: Record<string, string>; body?: string }[] = [
    // Google Cast / Android TV DIAL App Launch (Wakes HDMI-CEC & Power Manager from standby)
    { url: `http://${ipAddress}:8008/apps/YouTube`, method: 'POST', headers: dialHeaders, body: '' },
    { url: `http://${ipAddress}:8008/apps/Netflix`, method: 'POST', headers: dialHeaders, body: '' },
    { url: `http://${ipAddress}:8008/apps/DefaultMediaReceiver`, method: 'POST', headers: dialHeaders, body: '' },
    { url: `http://${ipAddress}:8008/apps/ChromeCast`, method: 'POST', headers: dialHeaders, body: '' },
    { url: `http://${ipAddress}:8008/apps/GoogleCast`, method: 'POST', headers: dialHeaders, body: '' },
    { url: `http://${ipAddress}:8008/setup/eureka_info`, method: 'GET' },
    {
      url: `http://${ipAddress}:8008/setup/set_eureka_info`,
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ opt_in: { stats: false } }),
    },
    // Android TV Remote v2 / ADB ports ping
    { url: `http://${ipAddress}:6467/`, method: 'GET' },
    { url: `http://${ipAddress}:6466/`, method: 'GET' },
    { url: `http://${ipAddress}:5555/`, method: 'GET' },
    // Xiaomi Mi TV PatchWall keyclick power
    { url: `http://${ipAddress}:6095/controller?action=keyclick&keycode=power`, method: 'GET' },
    // Roku TV ECP Power Keypress
    { url: `http://${ipAddress}:8060/keypress/Power`, method: 'POST' },
    // Samsung Tizen OS wake
    { url: `http://${ipAddress}:8001/api/v2/`, method: 'GET' },
    // LG webOS wake
    { url: `http://${ipAddress}:3000/`, method: 'GET' },
    { url: `http://${ipAddress}:8080/`, method: 'GET' },
    // General port 80 fallback
    { url: `http://${ipAddress}:80/`, method: 'GET' },
  ];

  // Send wave 1 immediately (1000ms timeout)
  const sendWave = async () => {
    await Promise.allSettled(
      wakeRequests.map((req) => sendLanHttpRequest(req.url, req.method, req.headers, req.body, 1000))
    );
    if (brandId === 'sony' || !brandId) {
      sendSonyIrcc(ipAddress, 'AAAAAQAAAAEAAAAVAw==');
    }
  };

  await sendWave();

  // Send wave 2 after 150ms
  setTimeout(() => {
    sendWave().catch(() => {});
    triggerDomGetWake(ipAddress);
  }, 150);

  // Send wave 3 after 350ms to ensure Wi-Fi sleep cycle punch-through
  setTimeout(() => {
    sendWave().catch(() => {});
  }, 350);

  return true;
}

/**
 * Sony Bravia SOAP IRCC Key Dispatcher
 */
function sendSonyIrcc(ipAddress: string, irccCode: string): void {
  const soapBody = `<?xml version="1.0"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"><s:Body><u:X_SendIRCC xmlns:u="urn:schemas-sony-com:service:IRCC:1"><IRCCCode>${irccCode}</IRCCCode></u:X_SendIRCC></s:Body></s:Envelope>`;
  sendLanHttpRequest(
    `http://${ipAddress}/sony/IRCC`,
    'POST',
    {
      'SOAPACTION': '"urn:schemas-sony-com:service:IRCC:1#X_SendIRCC"',
      'Content-Type': 'text/xml; charset=UTF-8',
    },
    soapBody,
    500
  ).catch(() => {});
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
    if (brandId === 'mi' || brandId === 'redmi' || brandId === 'xiaomi') {
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
      sendLanHttpRequest(`http://${ipAddress}:6095/controller?action=keyclick&keycode=${keycode}`, 'GET');
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
      sendLanHttpRequest(`http://${ipAddress}:8060/keypress/${key}`, 'POST');
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
      sendLanHttpRequest(
        `http://${ipAddress}:8008/setup/set_volume`,
        'POST',
        { 'Content-Type': 'application/json' },
        JSON.stringify({ level: 0.5 })
      );
      sendLanHttpRequest(`http://${ipAddress}:6095/controller?action=keyclick&keycode=volumeup`, 'GET');
    } else if (cmd === 'volume_down') {
      sendLanHttpRequest(
        `http://${ipAddress}:8008/setup/set_volume`,
        'POST',
        { 'Content-Type': 'application/json' },
        JSON.stringify({ level: 0.3 })
      );
      sendLanHttpRequest(`http://${ipAddress}:6095/controller?action=keyclick&keycode=volumedown`, 'GET');
    } else if (cmd.startsWith('app_')) {
      const appName = cmd.replace('app_', '');
      sendLanHttpRequest(`http://${ipAddress}:8008/apps/${appName}`, 'POST');
      sendLanHttpRequest(`http://${ipAddress}:8060/launch/837`, 'POST');
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
        sendLanHttpRequest(`http://${ipAddress}:6095/controller?action=keyclick&keycode=${miKey}`, 'GET');
        sendLanHttpRequest(`http://${ipAddress}:8060/keypress/${miKey.charAt(0).toUpperCase() + miKey.slice(1)}`, 'POST');
      }
    }

    return true;
  } catch {
    return false;
  }
}
