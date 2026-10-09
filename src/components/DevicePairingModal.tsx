import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Search,
  Wifi,
  Bluetooth,
  RefreshCw,
  Tv,
  Globe,
  KeyRound,
  ShieldCheck,
  Activity,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Sliders,
  Shield,
  Zap,
} from 'lucide-react';
import { ALL_TV_BRANDS, type TVBrandInfo } from '../data/tvDatabase';
import {
  type DiscoveredSmartTV,
  COMMON_SUBNETS,
  getSavedDevices,
  saveDevicesList,
  scanWifiSubnet,
  scanRealBluetoothDevice,
  testTvReachability,
  wakeTvOnLanOrHttp,
} from '../utils/networkScanner';
import {
  requestAndroidDevicePermissions,
  checkPermissionsStatus,
  type PermissionStatusResult,
} from '../utils/permissionManager';

export interface ConnectedDevice {
  name: string;
  ipAddress: string;
  protocol: 'Wi-Fi' | 'Bluetooth' | 'IR Blaster';
  brandId: string;
  signalStrength: number;
  isPaired: boolean;
  port?: number;
  latencyMs?: number;
  serviceType?: string;
  isDemo?: boolean;
}

interface DevicePairingModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentBrand: TVBrandInfo;
  onSelectBrand: (brand: TVBrandInfo) => void;
  connectedDevice: ConnectedDevice;
  onConnectDevice: (device: ConnectedDevice) => void;
}

export const DevicePairingModal: React.FC<DevicePairingModalProps> = ({
  isOpen,
  onClose,
  currentBrand,
  onSelectBrand,
  connectedDevice,
  onConnectDevice,
}) => {
  // Only 2 main tabs: Single unified "wifi" and "brands"
  const [activeTab, setActiveTab] = useState<'wifi' | 'brands'>('wifi');
  const [brandSearch, setBrandSearch] = useState('');
  const [brandRegion, setBrandRegion] = useState<'All' | 'India' | 'Global'>('All');

  // Wi-Fi Scanner state
  const [selectedSubnet, setSelectedSubnet] = useState('192.168.1.');
  const [customSubnetInput, setCustomSubnetInput] = useState('192.168.1.');
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [currentScanningIp, setCurrentScanningIp] = useState('');
  const [discoveredList, setDiscoveredList] = useState<DiscoveredSmartTV[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Bluetooth scanning state
  const [isBleScanning, setIsBleScanning] = useState(false);
  const [bleError, setBleError] = useState<string | null>(null);

  // Permissions state
  const [, setPermStatus] = useState<PermissionStatusResult>({
    hasLocationPermission: false,
    hasBluetoothPermission: false,
    hasNetworkPermission: true,
    isNativeAndroid: false,
  });
  const [showPermissionBanner, setShowPermissionBanner] = useState(false);

  // Direct IP section state (integrated into same Wi-Fi screen)
  const [manualIp, setManualIp] = useState('192.168.1.100');
  const [manualName, setManualName] = useState('Smart TV');
  const [pingStatus, setPingStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');
  const [pingMessage, setPingMessage] = useState<string | null>(null);
  const [pingLatency, setPingLatency] = useState<number | null>(null);

  // Optional PIN pairing overlay
  const [pinModalDevice, setPinModalDevice] = useState<ConnectedDevice | null>(null);
  const [enteredPin, setEnteredPin] = useState('');

  // Notification / Alert message
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

  // Load saved devices on open
  useEffect(() => {
    if (isOpen) {
      const saved = getSavedDevices();
      setDiscoveredList(saved);
      setBleError(null);
      setNoticeMessage(null);
    }
  }, [isOpen]);

  // Clean up scanner on unmount or close
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  if (!isOpen) return null;

  // Handle requesting Android/Browser permissions explicitly
  const handleRequestPermissions = async () => {
    const res = await requestAndroidDevicePermissions();
    setPermStatus({
      hasLocationPermission: res.location,
      hasBluetoothPermission: res.bluetooth,
      hasNetworkPermission: true,
      isNativeAndroid: true,
    });
    if (res.location) {
      setShowPermissionBanner(false);
      setNoticeMessage('Permissions granted! Scanning Wi-Fi network...');
      handleStartRealScan();
    } else {
      setNoticeMessage('Permission was dismissed or not granted.');
    }
  };

  // Start Real Wi-Fi Network Scan
  const handleStartRealScan = async () => {
    if (isScanning) {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      setIsScanning(false);
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsScanning(true);
    setScanProgress(0);
    setCurrentScanningIp('');
    setNoticeMessage(null);
    setBleError(null);

    const prefix = selectedSubnet === 'custom' ? customSubnetInput : selectedSubnet;

    try {
      const found = await scanWifiSubnet(
        prefix,
        (currentIp, percent) => {
          setCurrentScanningIp(currentIp);
          setScanProgress(percent);
        },
        (newDevice) => {
          setDiscoveredList((prev) => {
            const exists = prev.some((d) => d.ipAddress === newDevice.ipAddress);
            if (exists) return prev;
            const updated = [newDevice, ...prev];
            saveDevicesList(updated);
            return updated;
          });
        },
        controller.signal
      );

      if (found.length === 0) {
        setNoticeMessage(
          `Scan completed on ${prefix}0/24. If your TV didn't appear, ensure it is powered on or enter its IP below directly.`
        );
      } else {
        setNoticeMessage(`Found ${found.length} device(s) on Wi-Fi! Tap any TV to connect instantly.`);
      }
    } catch (err: unknown) {
      const e = err as { name?: string };
      if (e?.name !== 'AbortError') {
        setNoticeMessage('Network scan interrupted.');
      }
    } finally {
      setIsScanning(false);
      abortControllerRef.current = null;
    }
  };

  // Bluetooth scanning
  const handleStartBluetoothScan = async () => {
    setIsBleScanning(true);
    setBleError(null);
    setNoticeMessage(null);

    try {
      const bleDevice = await scanRealBluetoothDevice();
      if (bleDevice) {
        setDiscoveredList((prev) => {
          const updated = [bleDevice, ...prev.filter((d) => d.ipAddress !== bleDevice.ipAddress)];
          saveDevicesList(updated);
          return updated;
        });

        const matchedBrand = ALL_TV_BRANDS.find((b) => b.id === bleDevice.brandId) || currentBrand;
        onSelectBrand(matchedBrand);
        onConnectDevice({
          name: bleDevice.name,
          ipAddress: bleDevice.ipAddress,
          protocol: 'Bluetooth',
          brandId: bleDevice.brandId,
          signalStrength: bleDevice.signalStrength,
          isPaired: true,
          serviceType: bleDevice.serviceType,
        });
        onClose();
      }
    } catch (err: unknown) {
      const e = err as { message?: string };
      setBleError(e.message || 'Bluetooth connection failed or permission not granted.');
    } finally {
      setIsBleScanning(false);
    }
  };

  // Test reachability for manual IP
  const handleTestPing = async () => {
    if (!manualIp.trim()) return;
    setPingStatus('testing');
    setPingMessage('Testing connection to TV...');
    setPingLatency(null);

    try {
      const res = await testTvReachability(manualIp.trim());
      if (res.reachable) {
        setPingStatus('success');
        setPingLatency(res.latency);
        setPingMessage(
          `TV is REACHABLE (${res.latency}ms latency)! Service: ${res.detectedService || 'Port ' + res.matchedPort}`
        );
      } else {
        setPingStatus('failed');
        setPingMessage(
          `No response from ${manualIp}. Make sure TV is turned on and both phone and TV are on the same Wi-Fi.`
        );
      }
    } catch {
      setPingStatus('failed');
      setPingMessage('Network ping failed. Check IP format.');
    }
  };

  // Connect & Wake Direct IP TV
  const handleConnectDirectIp = () => {
    if (!manualIp.trim()) return;
    const ip = manualIp.trim();
    const matchedBrand = currentBrand;

    const newDev: DiscoveredSmartTV = {
      id: `manual-${ip}`,
      name: manualName.trim() || `${matchedBrand.name} TV`,
      ipAddress: ip,
      port: 8008,
      protocol: 'Wi-Fi',
      brandId: matchedBrand.id,
      signalStrength: pingLatency ? Math.max(60, 100 - Math.round(pingLatency / 10)) : 95,
      latencyMs: pingLatency || 18,
      serviceType: 'Wi-Fi Direct Connection',
      isPaired: true,
    };

    setDiscoveredList((prev) => {
      const updated = [newDev, ...prev.filter((d) => d.ipAddress !== newDev.ipAddress)];
      saveDevicesList(updated);
      return updated;
    });

    // Send wake / turn-on packet
    wakeTvOnLanOrHttp(ip, matchedBrand.id);

    onSelectBrand(matchedBrand);
    onConnectDevice({
      name: newDev.name,
      ipAddress: newDev.ipAddress,
      protocol: 'Wi-Fi',
      brandId: matchedBrand.id,
      signalStrength: newDev.signalStrength,
      isPaired: true,
      port: newDev.port,
      latencyMs: newDev.latencyMs,
    });
    onClose();
  };

  // Delete saved device
  const handleDeleteDevice = (ip: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDiscoveredList((prev) => {
      const updated = prev.filter((d) => d.ipAddress !== ip);
      saveDevicesList(updated);
      return updated;
    });
  };

  // Clear all discovered devices
  const handleClearAllDevices = () => {
    setDiscoveredList([]);
    saveDevicesList([]);
    setNoticeMessage('Cleared discovered device list.');
  };

  /**
   * 1-TAP INSTANT CONNECT:
   * Directly connects & wakes the TV immediately! Zero blocking on PIN dialog!
   */
  const handleDeviceClick = (device: DiscoveredSmartTV) => {
    const brand = ALL_TV_BRANDS.find((b) => b.id === device.brandId) || currentBrand;

    // Mark as paired in state
    setDiscoveredList((prev) => {
      const updated = prev.map((d) =>
        d.ipAddress === device.ipAddress ? { ...d, isPaired: true } : d
      );
      saveDevicesList(updated);
      return updated;
    });

    // Send wake / power on signal to TV right away
    if (device.ipAddress && device.ipAddress.includes('.')) {
      wakeTvOnLanOrHttp(device.ipAddress, device.brandId);
    }

    onSelectBrand(brand);
    onConnectDevice({
      name: device.name,
      ipAddress: device.ipAddress,
      protocol: device.protocol,
      brandId: device.brandId,
      signalStrength: device.signalStrength,
      isPaired: true,
      port: device.port,
      latencyMs: device.latencyMs,
      serviceType: device.serviceType,
    });
    onClose();
  };

  // Send Wake packet directly to a TV
  const handleWakeDevice = (device: DiscoveredSmartTV, e: React.MouseEvent) => {
    e.stopPropagation();
    wakeTvOnLanOrHttp(device.ipAddress, device.brandId);
    setNoticeMessage(`Sent Wake / Power ON signal to ${device.name} (${device.ipAddress})`);
  };

  // Explicit PIN Confirmation (Optional)
  const handleConfirmPin = () => {
    if (pinModalDevice) {
      const brand = ALL_TV_BRANDS.find((b) => b.id === pinModalDevice.brandId) || currentBrand;
      setDiscoveredList((prev) => {
        const updated = prev.map((d) =>
          d.ipAddress === pinModalDevice.ipAddress ? { ...d, isPaired: true } : d
        );
        saveDevicesList(updated);
        return updated;
      });

      if (pinModalDevice.ipAddress && pinModalDevice.ipAddress.includes('.')) {
        wakeTvOnLanOrHttp(pinModalDevice.ipAddress, pinModalDevice.brandId);
      }

      onSelectBrand(brand);
      onConnectDevice({ ...pinModalDevice, isPaired: true });
      setPinModalDevice(null);
      onClose();
    }
  };

  // Skip PIN and Connect directly from the PIN modal
  const handleDirectConnectSkipPin = () => {
    if (pinModalDevice) {
      const brand = ALL_TV_BRANDS.find((b) => b.id === pinModalDevice.brandId) || currentBrand;
      setDiscoveredList((prev) => {
        const updated = prev.map((d) =>
          d.ipAddress === pinModalDevice.ipAddress ? { ...d, isPaired: true } : d
        );
        saveDevicesList(updated);
        return updated;
      });

      if (pinModalDevice.ipAddress && pinModalDevice.ipAddress.includes('.')) {
        wakeTvOnLanOrHttp(pinModalDevice.ipAddress, pinModalDevice.brandId);
      }

      onSelectBrand(brand);
      onConnectDevice({ ...pinModalDevice, isPaired: true });
      setPinModalDevice(null);
      onClose();
    }
  };

  const filteredBrands = ALL_TV_BRANDS.filter((brand) => {
    const matchesRegion =
      brandRegion === 'All' || brand.region === brandRegion || brand.region === 'Both';
    const matchesQuery =
      brand.name.toLowerCase().includes(brandSearch.toLowerCase()) ||
      brand.operatingSystem.toLowerCase().includes(brandSearch.toLowerCase()) ||
      brand.popularModels.some((m) => m.toLowerCase().includes(brandSearch.toLowerCase()));
    return matchesRegion && matchesQuery;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Tv className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <span>Connect Your Smart TV</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Wi-Fi &amp; Bluetooth
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                1-Tap connection to control and turn on any Smart TV
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs - ONLY 2 OPTIONS: SINGLE WI-FI & BRANDS */}
        <div className="p-3 bg-slate-950/60 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 p-1 bg-slate-900 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab('wifi')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
                activeTab === 'wifi' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Wifi className="w-3.5 h-3.5" />
              <span>Wi-Fi Discovery</span>
            </button>
            <button
              onClick={() => setActiveTab('brands')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
                activeTab === 'brands' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>TV Brands ({ALL_TV_BRANDS.length})</span>
            </button>
          </div>

          {activeTab === 'wifi' && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleStartBluetoothScan}
                disabled={isBleScanning}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl bg-slate-800 hover:bg-slate-700 text-blue-300 transition-colors border border-blue-500/20"
                title="Scan for Bluetooth TV or Remote"
              >
                <Bluetooth className={`w-3.5 h-3.5 ${isBleScanning ? 'animate-pulse text-blue-400' : ''}`} />
                <span>{isBleScanning ? 'Searching BLE...' : 'Bluetooth'}</span>
              </button>
              <button
                onClick={handleStartRealScan}
                className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-xl transition-colors shadow ${
                  isScanning
                    ? 'bg-rose-600 hover:bg-rose-500 text-white'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                }`}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
                <span>{isScanning ? 'Stop Scan' : 'Scan Wi-Fi'}</span>
              </button>
            </div>
          )}
        </div>

        {/* SINGLE UNIFIED WI-FI TAB */}
        {activeTab === 'wifi' && (
          <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
            {/* Router Subnet Bar */}
            <div className="p-3 bg-slate-950/80 rounded-2xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                  Router Wi-Fi Subnet:
                </span>
                <span className="text-[11px] text-slate-500">Phone &amp; TV must be on same Wi-Fi</span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={selectedSubnet}
                  onChange={(e) => setSelectedSubnet(e.target.value)}
                  className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                >
                  {COMMON_SUBNETS.map((sub) => (
                    <option key={sub.prefix} value={sub.prefix}>
                      {sub.label}
                    </option>
                  ))}
                  <option value="custom">Custom IP Subnet Range...</option>
                </select>

                {selectedSubnet === 'custom' && (
                  <input
                    type="text"
                    value={customSubnetInput}
                    onChange={(e) => setCustomSubnetInput(e.target.value)}
                    placeholder="192.168.1."
                    className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono w-32 focus:outline-none focus:border-indigo-500"
                  />
                )}

                <button
                  onClick={handleStartRealScan}
                  disabled={isScanning}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow transition-colors flex items-center gap-1"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>{isScanning ? 'Scanning...' : 'Scan Subnet'}</span>
                </button>
              </div>
            </div>

            {/* Live Scanning Progress HUD */}
            {isScanning && (
              <div className="p-3.5 bg-indigo-950/40 border border-indigo-500/40 rounded-2xl space-y-2 animate-in fade-in">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-indigo-300 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    Probing Wi-Fi Network for Smart TVs...
                  </span>
                  <span className="font-mono text-emerald-400 text-xs font-bold">{scanProgress}%</span>
                </div>

                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-indigo-500 to-emerald-400 h-full transition-all duration-150"
                    style={{ width: `${scanProgress}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                  <span>Scanning IP: {currentScanningIp || 'Initializing...'}</span>
                  <span>Target Ports: 8008, 8060, 8001, 3000</span>
                </div>
              </div>
            )}

            {/* Bluetooth Error Toast */}
            {bleError && (
              <div className="p-3 bg-amber-950/40 border border-amber-600/40 rounded-2xl flex items-center gap-2 text-xs text-amber-200">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>{bleError}</span>
              </div>
            )}

            {/* Notification / Info Toast */}
            {noticeMessage && (
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-2xl flex items-center gap-2 text-xs text-slate-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{noticeMessage}</span>
              </div>
            )}

            {/* TV Devices Section Header */}
            <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
              <span className="font-medium text-slate-300">
                Discovered Smart TVs ({discoveredList.length})
              </span>
              {discoveredList.length > 0 && (
                <button
                  onClick={handleClearAllDevices}
                  className="text-rose-400 hover:text-rose-300 flex items-center gap-1 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear List</span>
                </button>
              )}
            </div>

            {/* List of Discovered / Saved Devices */}
            {discoveredList.length > 0 ? (
              <div className="space-y-2.5">
                {discoveredList.map((device) => {
                  const isCurrent = connectedDevice.ipAddress === device.ipAddress;
                  return (
                    <div
                      key={device.ipAddress}
                      onClick={() => handleDeviceClick(device)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        isCurrent
                          ? 'bg-emerald-950/40 border-emerald-500/50 shadow-md ring-1 ring-emerald-500/40'
                          : 'bg-slate-950/70 border-slate-800/80 hover:bg-slate-800/60 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-300 shrink-0">
                          {device.protocol === 'Wi-Fi' ? (
                            <Wifi className="w-5 h-5 text-indigo-400" />
                          ) : (
                            <Bluetooth className="w-5 h-5 text-blue-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-white truncate">{device.name}</span>
                            {isCurrent && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-mono">
                                Connected
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 font-mono mt-0.5 flex items-center gap-2 flex-wrap">
                            <span>{device.ipAddress}</span>
                            <span>·</span>
                            <span className="text-emerald-400 flex items-center gap-1">
                              <Activity className="w-3 h-3" />
                              {device.latencyMs ? `${device.latencyMs}ms` : `${device.signalStrength}%`}
                            </span>
                            {device.serviceType && (
                              <>
                                <span>·</span>
                                <span className="text-slate-500 truncate max-w-[140px]">
                                  {device.serviceType}
                                </span>
                              </>
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {/* Wake / Turn On Button */}
                        <button
                          type="button"
                          onClick={(e) => handleWakeDevice(device, e)}
                          className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1 transition-all"
                          title="Send Wake-on-LAN / Power ON signal to TV"
                        >
                          <Zap className="w-3.5 h-3.5 text-amber-400" />
                          <span className="hidden sm:inline">Turn ON</span>
                        </button>

                        {/* 1-Tap Connect Button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeviceClick(device);
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shadow ${
                            isCurrent
                              ? 'bg-emerald-600 text-white'
                              : 'bg-indigo-600 text-white hover:bg-indigo-500'
                          }`}
                        >
                          {isCurrent ? 'Active' : 'Connect'}
                        </button>

                        <button
                          type="button"
                          onClick={(e) => handleDeleteDevice(device.ipAddress, e)}
                          className="w-8 h-8 rounded-xl bg-slate-900 hover:bg-rose-950 text-slate-500 hover:text-rose-400 flex items-center justify-center transition-colors"
                          title="Remove device"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Empty State */
              <div className="p-6 text-center bg-slate-950/50 border border-dashed border-slate-800 rounded-3xl space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center text-slate-400 mx-auto">
                  <Wifi className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">No Smart TV Detected Yet</h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 leading-relaxed">
                    Make sure your TV is connected to the same Wi-Fi router. Click{' '}
                    <strong className="text-indigo-400">Scan Wi-Fi</strong> or enter your TV&apos;s IP address below.
                  </p>
                </div>
                <div className="pt-2">
                  <button
                    onClick={handleStartRealScan}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow transition-all inline-flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Start Wi-Fi Scan</span>
                  </button>
                </div>
              </div>
            )}

            {/* INTEGRATED DIRECT IP CONNECT (IN THE SAME SCREEN) */}
            <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 space-y-3 pt-4 mt-2">
              <div>
                <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Tv className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Connect TV Directly by IP Address</span>
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Find your TV&apos;s IP on screen: <em>Settings &gt; Network / Wi-Fi &gt; IP Address</em>
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="sm:col-span-2 space-y-1">
                  <input
                    type="text"
                    value={manualIp}
                    onChange={(e) => {
                      setManualIp(e.target.value);
                      setPingStatus('idle');
                    }}
                    placeholder="e.g. 192.168.1.100"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="space-y-1">
                  <input
                    type="text"
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                    placeholder="Device Name"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {pingMessage && (
                <div
                  className={`p-2.5 rounded-xl text-xs flex items-center gap-2 ${
                    pingStatus === 'success'
                      ? 'bg-emerald-950/60 border border-emerald-600 text-emerald-200'
                      : pingStatus === 'failed'
                      ? 'bg-rose-950/60 border border-rose-800 text-rose-200'
                      : 'bg-slate-900 border border-slate-700 text-slate-300'
                  }`}
                >
                  {pingStatus === 'testing' && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  {pingStatus === 'success' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                  {pingStatus === 'failed' && <AlertCircle className="w-3.5 h-3.5 text-rose-400" />}
                  <span>{pingMessage}</span>
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleTestPing}
                  disabled={pingStatus === 'testing' || !manualIp.trim()}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors border border-slate-700 flex items-center gap-1.5"
                >
                  <Activity className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Test Ping</span>
                </button>
                <button
                  type="button"
                  onClick={handleConnectDirectIp}
                  disabled={!manualIp.trim()}
                  className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow transition-colors flex items-center gap-1.5"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Connect &amp; Turn On TV</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: TV BRANDS CATALOG */}
        {activeTab === 'brands' && (
          <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={brandSearch}
                  onChange={(e) => setBrandSearch(e.target.value)}
                  placeholder="Search brand (Xiaomi, Samsung, Sony, LG, OnePlus, Vu, TCL...)"
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 self-start">
                {(['All', 'India', 'Global'] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setBrandRegion(r)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                      brandRegion === r ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {filteredBrands.map((brand) => {
                const isSelected = brand.id === currentBrand.id;
                return (
                  <div
                    key={brand.id}
                    onClick={() => {
                      onSelectBrand(brand);
                      onConnectDevice({
                        name: `${brand.name} Smart TV`,
                        ipAddress: connectedDevice.ipAddress || '192.168.1.100',
                        protocol: 'Wi-Fi',
                        brandId: brand.id,
                        signalStrength: 95,
                        isPaired: true,
                      });
                      onClose();
                    }}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'bg-indigo-950/60 border-indigo-500 shadow-md ring-1 ring-indigo-500/50'
                        : 'bg-slate-950/70 border-slate-800 hover:bg-slate-800/60 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-white truncate">{brand.name}</span>
                      {isSelected && <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />}
                    </div>
                    <span className="text-[10px] text-slate-400 truncate">{brand.operatingSystem}</span>
                    <span className="text-[9px] text-slate-500 mt-1">{brand.region} Market</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* PIN PAIRING MODAL OVERLAY (WITH 1-CLICK DIRECT CONNECT / SKIP PIN) */}
        {pinModalDevice && (
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in">
            <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-3xl p-6 space-y-4 shadow-2xl">
              <div className="text-center space-y-1">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mx-auto">
                  <KeyRound className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-white">Pairing PIN (Optional)</h3>
                <p className="text-xs text-slate-400">
                  If your TV (<strong className="text-white">{pinModalDevice.name}</strong>) shows a PIN code, enter it below.
                  Otherwise click <strong className="text-emerald-400">Connect Without PIN</strong>.
                </p>
              </div>

              <div>
                <input
                  type="text"
                  maxLength={6}
                  value={enteredPin}
                  onChange={(e) => setEnteredPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="e.g. 1 2 3 4"
                  className="w-full py-3 text-center text-2xl font-mono tracking-widest bg-slate-950 border border-slate-700 rounded-2xl text-white focus:outline-none focus:border-indigo-500"
                  autoFocus
                />
              </div>

              {/* Instant direct connect button */}
              <button
                type="button"
                onClick={handleDirectConnectSkipPin}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow transition-colors flex items-center justify-center gap-1.5"
              >
                <Zap className="w-4 h-4" />
                <span>Connect Directly (Skip PIN)</span>
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPinModalDevice(null)}
                  className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmPin}
                  className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow transition-colors"
                >
                  Pair with PIN
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
