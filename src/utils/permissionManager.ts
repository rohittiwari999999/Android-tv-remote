/**
 * Android & Web Device Permission Manager
 * Handles Location, Wi-Fi Nearby Devices, and Bluetooth permissions
 * for both Android native app (Capacitor / WebView) and standard browsers.
 */

export interface PermissionStatusResult {
  hasLocationPermission: boolean;
  hasBluetoothPermission: boolean;
  hasNetworkPermission: boolean;
  isNativeAndroid: boolean;
  message?: string;
}

/**
 * Check if running inside Android Capacitor / native wrapper
 */
export function isCapacitorAndroid(): boolean {
  if (typeof window === 'undefined') return false;
  const win = window as unknown as {
    Capacitor?: {
      isNativePlatform?: () => boolean;
      getPlatform?: () => string;
    };
  };
  return !!(
    win.Capacitor?.isNativePlatform?.() ||
    win.Capacitor?.getPlatform?.() === 'android' ||
    /Android/i.test(navigator.userAgent)
  );
}

/**
 * Request real Android / Browser Permissions
 * Prompt user for Location (required by Android for Wi-Fi SSID / local devices scanning)
 * and Bluetooth / Network permissions.
 */
export async function requestAndroidDevicePermissions(): Promise<{
  granted: boolean;
  location: boolean;
  bluetooth: boolean;
  reason?: string;
}> {
  let locationGranted = false;
  let bluetoothGranted = false;

  // 1. Request Geolocation (Triggers native Android "Allow Universal TV Remote to access this device's location" dialog)
  // Android OS requires Location permission to permit Wi-Fi scanning and identifying the local network subnet.
  if (navigator.geolocation) {
    try {
      await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 6000,
          maximumAge: 60000,
        });
      });
      locationGranted = true;
    } catch (err: unknown) {
      const geoErr = err as { code?: number; message?: string };
      // User dismissed or denied
      if (geoErr?.code === 1) {
        locationGranted = false;
      } else {
        // Timeout or network location, still consider permitted if not explicitly denied
        locationGranted = false;
      }
    }
  }

  // 2. Request Web Bluetooth permission if user clicks Bluetooth pair
  const nav = navigator as unknown as {
    bluetooth?: {
      getAvailability?: () => Promise<boolean>;
    };
    permissions?: {
      query: (options: { name: string }) => Promise<{ state: string }>;
    };
  };

  if (nav.bluetooth?.getAvailability) {
    try {
      const avail = await nav.bluetooth.getAvailability();
      bluetoothGranted = avail;
    } catch {
      bluetoothGranted = false;
    }
  }

  return {
    granted: locationGranted || bluetoothGranted,
    location: locationGranted,
    bluetooth: bluetoothGranted,
  };
}

/**
 * Query current permission status without prompting
 */
export async function checkPermissionsStatus(): Promise<PermissionStatusResult> {
  const isAndroid = isCapacitorAndroid();
  let hasLocation = false;
  let hasBluetooth = false;

  if (navigator.permissions && navigator.permissions.query) {
    try {
      const locRes = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
      hasLocation = locRes.state === 'granted';
    } catch {
      // ignore
    }

    try {
      const btRes = await navigator.permissions.query({ name: 'bluetooth' as unknown as PermissionName });
      hasBluetooth = btRes.state === 'granted';
    } catch {
      // ignore
    }
  }

  return {
    hasLocationPermission: hasLocation,
    hasBluetoothPermission: hasBluetooth,
    hasNetworkPermission: true,
    isNativeAndroid: isAndroid,
  };
}
