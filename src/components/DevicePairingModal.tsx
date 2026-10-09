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
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Sliders,
  Laptop,
  Shield,
  HelpCircle,
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
  const [activeTab, setActiveTab] = useState<'scan' | 'brands' | 'manual'>('scan');
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
  const [permStatus, setPermStatus] = useState<PermissionStatusResult>({
    hasLocationPermission: false,
    hasBluetoothPermission: false,
    hasNetworkPermission: true,
    isNativeAndroid: false,
  });
  const [showPermissionBanner, setShowPermissionBanner] = useState(false);

  // Manual IP Connect state
  const [manualIp, setManualIp] = useState('192.168.1.100');
  const [manualPort, setManualPort] = useState('8008');
  const [manualName, setManualName] = useState('My Smart TV');
  const [manualBrandId, setManualBrandId] = useState(currentBrand.id);
  const [pingStatus, setPingStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');
  const [pingMessage, setPingMessage] = useState<string | null>(null);
  const [pingLatency, setPingLatency] = useState<number | null>(null);

  // PIN pairing overlay
  const [pinModalDevice, setPinModalDevice] = useState<ConnectedDevice | null>(null);
  const [enteredPin, setEnteredPin] = useState('');

  // Notification / Alert message
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

  // Load saved devices and check permissions on open
  useEffect(() => {
    if (isOpen) {
      const saved = getSavedDevices();
      setDiscoveredList(saved);
      setBleError(null);
      setNoticeMessage(null);

      checkPermissionsStatus().then((status) => {
        setPermStatus(status);
        if (!status.hasLocationPermission) {
          setShowPermissionBanner(true);
        }
      });
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
    const updated = await checkPermissionsStatus();
    setPermStatus(updated);
    if (res.granted || updated.hasLocationPermission) {
      setNoticeMessage('Permissions granted! You can now scan your Wi-Fi and Bluetooth devices.');
      setShowPermissionBanner(false);
    } else {
      setNoticeMessage(
        'Location permission prompt shown. On Android, please tap "Allow while using the app" to permit Wi-Fi scanning.'
      );
    }
  };

  // Real Wi-Fi Subnet Scanner Trigger
  const handleStartRealScan = async () => {
    if (isScanning) {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      setIsScanning(false);
      return;
    }

    // Proactively trigger Android permission request if not granted yet
    if (!permStatus.hasLocationPermission) {
      requestAndroidDevicePermissions().then((r) => {
        if (r.location) {
          setPermStatus((p) => ({ ...p, hasLocationPermission: true }));
        }
      });
    }

    setIsScanning(true);
    setScanProgress(0);
    setCurrentScanningIp('');
    setNoticeMessage(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const prefix = selectedSubnet === 'custom' ? customSubnetInput : selectedSubnet;

    try {
      const results = await scanWifiSubnet(
        prefix,
        (ip, pct) => {
          setCurrentScanningIp(ip);
          setScanProgress(pct);
        },
        (foundDevice) => {
          setDiscoveredList((prev) => {
            const exists = prev.some((d) => d.ipAddress === foundDevice.ipAddress);
            if (!exists) {
              const updated = [foundDevice, ...prev];
              saveDevicesList(updated);
              return updated;
            }
            return prev;
          });
        },
        controller.signal
      );

      if (!controller.signal.aborted) {
        if (results.length === 0) {
          setNoticeMessage(
            `No new TV found on ${prefix}x. Check your TV's IP in TV Settings > Network, or enter it in 'Manual IP'.`
          );
        } else {
          setNoticeMessage(`Scan completed: Found ${results.length} smart device(s) on your Wi-Fi.`);
        }
      }
    } catch {
      // scan interrupted
    } finally {
      setIsScanning(false);
      setCurrentScanningIp('');
    }
  };

  // Real Web Bluetooth Scanner Trigger
  const handleStartBluetoothScan = async () => {
    setIsBleScanning(true);
    setBleError(null);
    try {
      const bleDevice = await scanRealBluetoothDevice();
      if (bleDevice) {
        setDiscoveredList((prev) => {
          const updated = [bleDevice, ...prev.filter((d) => d.id !== bleDevice.id)];
          saveDevicesList(updated);
          return updated;
        });

        const brand = ALL_TV_BRANDS.find((b) => b.id === bleDevice.brandId) || currentBrand;
        onSelectBrand(brand);
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
    setPingMessage('Pinging Smart TV on local Wi-Fi...');
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
          `No response from ${manualIp}. Make sure your TV is turned on and both phone and TV are connected to the same Wi-Fi router.`
        );
      }
    } catch {
      setPingStatus('failed');
      setPingMessage('Network ping failed. Check IP format.');
    }
  };

  // Connect Manual IP TV
  const handleConnectManual = () => {
    if (!manualIp.trim()) return;
    const matchedBrand = ALL_TV_BRANDS.find((b) => b.id === manualBrandId) || currentBrand;

    const newDev: DiscoveredSmartTV = {
      id: `manual-${manualIp}`,
      name: manualName.trim() || `${matchedBrand.name} TV`,
      ipAddress: manualIp.trim(),
      port: parseInt(manualPort, 10) || 8008,
      protocol: 'Wi-Fi',
      brandId: matchedBrand.id,
      signalStrength: pingLatency ? Math.max(60, 100 - Math.round(pingLatency / 10)) : 92,
      latencyMs: pingLatency || 20,
      serviceType: 'Manual Wi-Fi IP Connection',
      isPaired: true,
    };

    setDiscoveredList((prev) => {
      const updated = [newDev, ...prev.filter((d) => d.ipAddress !== newDev.ipAddress)];
      saveDevicesList(updated);
      return updated;
    });

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

  // Handle device card click
  const handleDeviceClick = (device: DiscoveredSmartTV) => {
    if (!device.isPaired) {
      setPinModalDevice({
        name: device.name,
        ipAddress: device.ipAddress,
        protocol: device.protocol,
        brandId: device.brandId,
        signalStrength: device.signalStrength,
        isPaired: false,
        port: device.port,
        latencyMs: device.latencyMs,
      });
      setEnteredPin('');
    } else {
      const brand = ALL_TV_BRANDS.find((b) => b.id === device.brandId) || currentBrand;
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
      });
      onClose();
    }
  };

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
                  Real LAN Discovery
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Discover live Smart TVs on your Wi-Fi, scan Bluetooth, or connect directly
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

        {/* Android / Device Permissions Banner */}
        {showPermissionBanner && (
          <div className="px-5 py-2.5 bg-gradient-to-r from-indigo-950/90 to-purple-950/90 border-b border-indigo-800/50 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-indigo-200">
              <Shield className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>
                <strong>Android Permission:</strong> Grant Location &amp; Nearby Device permission so this app
                can detect your TV on local Wi-Fi.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRequestPermissions}
                className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-semibold text-xs transition-colors shadow"
              >
                Allow Permission
              </button>
              <button
                onClick={() => setShowPermissionBanner(false)}
                className="text-slate-400 hover:text-white p-1"
                title="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="p-3 bg-slate-950/60 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 p-1 bg-slate-900 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab('scan')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                activeTab === 'scan' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Wifi className="w-3.5 h-3.5" />
              <span>Real Wi-Fi Scan</span>
            </button>
            <button
              onClick={() => setActiveTab('manual')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                activeTab === 'manual' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Laptop className="w-3.5 h-3.5" />
              <span>Direct IP Connect</span>
            </button>
            <button
              onClick={() => setActiveTab('brands')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                activeTab === 'brands' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>TV Brands ({ALL_TV_BRANDS.length})</span>
            </button>
          </div>

          {activeTab === 'scan' && (
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
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl transition-colors shadow ${
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

        {/* TAB 1: REAL WI-FI SCANNER */}
        {activeTab === 'scan' && (
          <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
            {/* Subnet Selector Bar */}
            <div className="p-3 bg-slate-950/80 rounded-2xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                  Select Wi-Fi Router Subnet to Scan:
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
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow transition-colors flex items-center gap-1"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>{isScanning ? 'Scanning...' : 'Scan Selected Subnet'}</span>
                </button>
              </div>
            </div>

            {/* Live Scanning Progress HUD */}
            {isScanning && (
              <div className="p-3.5 bg-indigo-950/40 border border-indigo-500/40 rounded-2xl space-y-2 animate-in fade-in">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-indigo-300 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    Probing Local Wi-Fi Network...
                  </span>
                  <span className="font-mono text-emerald-400 text-xs">{scanProgress}%</span>
                </div>

                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-indigo-500 to-emerald-400 h-full transition-all duration-150"
                    style={{ width: `${scanProgress}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                  <span>Current IP: {currentScanningIp || 'Initializing...'}</span>
                  <span>Target Ports: 8008, 6467, 8001</span>
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

            {/* TV Devices Header */}
            <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
              <span className="font-medium text-slate-300">
                Discovered &amp; Saved Devices ({discoveredList.length})
              </span>
              <div className="flex items-center gap-3">
                {discoveredList.length > 0 && (
                  <button
                    onClick={handleClearAllDevices}
                    className="text-rose-400 hover:text-rose-300 flex items-center gap-1 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear List</span>
                  </button>
                )}
                <button
                  onClick={() => setActiveTab('manual')}
                  className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add TV by IP</span>
                </button>
              </div>
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
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                        isCurrent
                          ? 'bg-emerald-950/40 border-emerald-500/50 shadow-md ring-1 ring-emerald-500/40'
                          : 'bg-slate-950/70 border-slate-800/80 hover:bg-slate-800/60 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-300 shrink-0">
                          {device.protocol === 'Wi-Fi' ? (
                            <Wifi className="w-5 h-5 text-indigo-400" />
                          ) : (
                            <Bluetooth className="w-5 h-5 text-blue-400" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-white">{device.name}</span>
                            {device.isPaired && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-mono">
                                Paired
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 font-mono mt-0.5 flex items-center gap-2">
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

                      <div className="flex items-center gap-2">
                        <button
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                            isCurrent
                              ? 'bg-emerald-600 text-white'
                              : device.isPaired
                              ? 'bg-slate-800 text-slate-200 hover:bg-indigo-600 hover:text-white'
                              : 'bg-indigo-600 text-white hover:bg-indigo-500'
                          }`}
                        >
                          {isCurrent ? 'Active' : device.isPaired ? 'Connect' : 'Pair'}
                        </button>
                        <button
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
              /* Clean Empty State: Prompt real scan or manual entry */
              <div className="p-8 text-center bg-slate-950/50 border border-dashed border-slate-800 rounded-3xl space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center text-slate-400 mx-auto">
                  <Wifi className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">No Smart TV Connected Yet</h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 leading-relaxed">
                    Make sure your TV and phone are connected to the same Wi-Fi router. Click{' '}
                    <strong className="text-indigo-400">Scan Wi-Fi</strong> or enter your TV&apos;s IP address
                    directly in <strong className="text-indigo-400">Direct IP Connect</strong>.
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                  <button
                    onClick={handleStartRealScan}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow transition-all flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Start Real Wi-Fi Scan</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('manual')}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Enter TV IP Directly</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: MANUAL IP CONNECT WITH REAL PING TEST */}
        {activeTab === 'manual' && (
          <div className="p-5 sm:p-6 space-y-4 flex-1 overflow-y-auto">
            <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Laptop className="w-4 h-4 text-indigo-400" />
                  <span>Direct Smart TV Wi-Fi Connection</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Enter your TV&apos;s local IP address. Find this on your TV screen under{' '}
                  <span className="text-slate-300 font-medium">
                    Settings &gt; Network &amp; Internet &gt; Wi-Fi Status &gt; IP Address
                  </span>.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-[11px] font-medium text-slate-300 block">TV IP Address</label>
                  <input
                    type="text"
                    value={manualIp}
                    onChange={(e) => {
                      setManualIp(e.target.value);
                      setPingStatus('idle');
                    }}
                    placeholder="192.168.1.105 or 192.168.29.102"
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-300 block">Smart TV Port</label>
                  <input
                    type="text"
                    value={manualPort}
                    onChange={(e) => setManualPort(e.target.value)}
                    placeholder="8008 or 6467"
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-300 block">Friendly Device Name</label>
                  <input
                    type="text"
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                    placeholder="e.g. Living Room TV"
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-300 block">TV Brand Match</label>
                  <select
                    value={manualBrandId}
                    onChange={(e) => setManualBrandId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                  >
                    {ALL_TV_BRANDS.map((brand) => (
                      <option key={brand.id} value={brand.id}>
                        {brand.name} ({brand.region})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Ping Test Button & Result Box */}
              <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleTestPing}
                  disabled={pingStatus === 'testing'}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-2 border border-slate-700"
                >
                  <Activity className={`w-3.5 h-3.5 ${pingStatus === 'testing' ? 'animate-pulse text-indigo-400' : ''}`} />
                  <span>{pingStatus === 'testing' ? 'Testing Connection...' : 'Test Connection (Ping)'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleConnectManual}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow transition-colors flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Save &amp; Connect TV</span>
                </button>
              </div>

              {pingMessage && (
                <div
                  className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                    pingStatus === 'success'
                      ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                      : pingStatus === 'failed'
                      ? 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                      : 'bg-indigo-950/40 border-indigo-500/40 text-indigo-300'
                  }`}
                >
                  {pingStatus === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                  {pingStatus === 'failed' && <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
                  {pingStatus === 'testing' && <Activity className="w-4 h-4 text-indigo-400 shrink-0 animate-spin" />}
                  <span>{pingMessage}</span>
                </div>
              )}
            </div>

            {/* Quick Helper */}
            <div className="p-4 bg-slate-950/50 rounded-2xl border border-slate-800/80 text-xs text-slate-400 space-y-1.5">
              <div className="font-semibold text-slate-300 flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4 text-indigo-400" />
                <span>How to find your TV&apos;s IP Address:</span>
              </div>
              <ul className="list-disc list-inside space-y-1 pl-1 text-[11px] text-slate-400">
                <li>
                  <strong className="text-slate-300">Android TV / Google TV:</strong> Settings &gt; Network &gt; Advanced &gt; IP Address
                </li>
                <li>
                  <strong className="text-slate-300">Samsung TV (Tizen):</strong> Settings &gt; General &gt; Network &gt; Network Status &gt; IP Settings
                </li>
                <li>
                  <strong className="text-slate-300">LG webOS:</strong> Settings &gt; Connection &gt; Wi-Fi Connection &gt; Advanced Wi-Fi Settings
                </li>
              </ul>
            </div>
          </div>
        )}

        {/* TAB 3: BRAND SELECTOR */}
        {activeTab === 'brands' && (
          <div className="p-4 sm:p-5 flex-1 overflow-y-auto space-y-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-500" />
                <input
                  type="text"
                  value={brandSearch}
                  onChange={(e) => setBrandSearch(e.target.value)}
                  placeholder="Search brand (Sony, Samsung, Mi, LG, Vu, OnePlus)..."
                  className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
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

        {/* PIN PAIRING MODAL OVERLAY */}
        {pinModalDevice && (
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 z-50">
            <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-3xl p-6 space-y-4 shadow-2xl">
              <div className="text-center space-y-1">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mx-auto">
                  <KeyRound className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-white">Enter Pairing PIN</h3>
                <p className="text-xs text-slate-400">
                  A 4 or 6-digit code may appear on <strong className="text-white">{pinModalDevice.name}</strong>
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

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPinModalDevice(null)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmPin}
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow transition-colors"
                >
                  Pair &amp; Connect
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
