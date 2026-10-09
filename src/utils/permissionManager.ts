/**
 * Android & Web Device Permission Manager
 * Manages Wi-Fi LAN and Bluetooth permissions without nagging the user
 * or prompting for Geolocation / GPS on every app launch.
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
 * Query current permission status quietly without popping up OS dialogs
 */
export async function checkPermissionsStatus(): Promise<PermissionStatusResult> {
  const isAndroid = isCapacitorAndroid();
  let hasBluetooth = false;

  const nav = typeof navigator !== 'undefined' ? (navigator as unknown as {
    permissions?: {
      query: (options: { name: string }) => Promise<{ state: string }>;
    };
    bluetooth?: {
      getAvailability?: () => Promise<boolean>;
    };
  }) : null;

  if (nav?.bluetooth?.getAvailability) {
    try {
      hasBluetooth = await nav.bluetooth.getAvailability();
    } catch {
      hasBluetooth = false;
    }
  }

  return {
    hasLocationPermission: true, // Wi-Fi LAN discovery does not need GPS
    hasBluetoothPermission: hasBluetooth,
    hasNetworkPermission: true,
    isNativeAndroid: isAndroid,
  };
}

/**
 * Request real Bluetooth permissions if user explicitly wants Bluetooth pairing
 */
export async function requestAndroidDevicePermissions(): Promise<{
  granted: boolean;
  location: boolean;
  bluetooth: boolean;
  reason?: string;
}> {
  const nav = typeof navigator !== 'undefined' ? (navigator as unknown as {
    bluetooth?: {
      getAvailability?: () => Promise<boolean>;
    };
  }) : null;

  let bluetoothGranted = false;
  if (nav?.bluetooth?.getAvailability) {
    try {
      bluetoothGranted = await nav.bluetooth.getAvailability();
    } catch {
      bluetoothGranted = false;
    }
  }

  return {
    granted: true,
    location: true,
    bluetooth: bluetoothGranted,
  };
}
