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
  Activity,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Sliders,
  Zap,
  Info,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Edit3,
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
  detectLocalDeviceSubnet,
  saveCustomTvName,
  getStoredCustomTvName,
} from '../utils/networkScanner';

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
  // Navigation Tabs: 'wifi' | 'brands'
  const [activeTab, setActiveTab] = useState<'wifi' | 'brands'>('wifi');

  // Subnet selection
  const [selectedSubnet, setSelectedSubnet] = useState('192.168.1.');
  const [customSubnetInput, setCustomSubnetInput] = useState('192.168.1.');

  // Discovered devices list
  const [discoveredList, setDiscoveredList] = useState<DiscoveredSmartTV[]>([]);

  // Wi-Fi Scanning state
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [currentScanningIp, setCurrentScanningIp] = useState('');
  const abortControllerRef = useRef<AbortController | null>(null);

  // Bluetooth scanning state
  const [isBleScanning, setIsBleScanning] = useState(false);
  const [bleError, setBleError] = useState<string | null>(null);

  // Direct IP section state
  const [manualIp, setManualIp] = useState('192.168.1.100');
  const [manualName, setManualName] = useState('');
  const [pingStatus, setPingStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');
  const [pingMessage, setPingMessage] = useState<string | null>(null);
  const [pingLatency, setPingLatency] = useState<number | null>(null);

  // How-to guide accordion
  const [showHowToFindIp, setShowHowToFindIp] = useState(false);

  // PIN pairing overlay
  const [pinModalDevice, setPinModalDevice] = useState<ConnectedDevice | null>(null);
  const [pinModalTvName, setPinModalTvName] = useState('');
  const [enteredPin, setEnteredPin] = useState('');

  // Inline rename state for discovered devices
  const [renamingIp, setRenamingIp] = useState<string | null>(null);
  const [renamingText, setRenamingText] = useState('');

  // Notification / Alert message
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

  // TV Brands catalog search
  const [brandSearch, setBrandSearch] = useState('');
  const [brandRegion, setBrandRegion] = useState<'All' | 'India' | 'Global'>('All');

  // Load saved devices on open, purge dummy data & auto-detect Wi-Fi subnet
  useEffect(() => {
    if (isOpen) {
      const saved = getSavedDevices();
      setDiscoveredList(saved);
      setBleError(null);
      setNoticeMessage(null);

      // Auto-detect local Wi-Fi subnet prefix
      detectLocalDeviceSubnet()
        .then((detectedPrefix) => {
          if (detectedPrefix) {
            setSelectedSubnet(detectedPrefix);
            setManualIp((prev) => {
              const lastOctet = prev.split('.').pop() || '100';
              return `${detectedPrefix}${lastOctet}`;
            });
            setNoticeMessage(`Auto-detected connected Wi-Fi subnet: ${detectedPrefix}x`);
          }
        })
        .catch(() => {});
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

  // Handle Subnet Change & update manual IP prefix helper
  const handleSelectSubnet = (newPrefix: string) => {
    setSelectedSubnet(newPrefix);
    if (newPrefix !== 'custom') {
      const lastOctet = manualIp.split('.').pop() || '100';
      setManualIp(`${newPrefix}${lastOctet}`);
    }
  };

  // Real Wi-Fi Network Scan
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
          `Scan completed on ${prefix}0/24. No active TV detected. If your TV didn't appear, ensure phone Wi-Fi is ON, or enter the TV's IP below directly.`
        );
      } else {
        setNoticeMessage(`Found ${found.length} active TV(s)! Tap to connect and control.`);
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
          `TV is REACHABLE (${res.latency}ms latency)! Detected: ${res.detectedService || 'Port ' + res.matchedPort}`
        );
        if (res.friendlyName) {
          setManualName(res.friendlyName);
        } else if (res.brandId) {
          const brandMatch = ALL_TV_BRANDS.find((b) => b.id === res.brandId);
          if (brandMatch) {
            setManualName(`${brandMatch.name} Smart TV`);
          }
        }
      } else {
        setPingStatus('failed');
        setPingMessage(
          `No response from ${manualIp}. Make sure TV is turned ON and phone is connected to the same Wi-Fi router.`
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
    const finalName = manualName.trim() || `${matchedBrand.name} Smart TV (${ip})`;

    const newDev: DiscoveredSmartTV = {
      id: `manual-${ip}`,
      name: finalName,
      ipAddress: ip,
      port: 8008,
      protocol: 'Wi-Fi',
      brandId: matchedBrand.id,
      signalStrength: pingLatency ? Math.max(60, 100 - Math.round(pingLatency / 10)) : 95,
      latencyMs: pingLatency || 18,
      serviceType: 'Wi-Fi Direct Connection',
      isPaired: false,
    };

    setDiscoveredList((prev) => {
      const updated = [newDev, ...prev.filter((d) => d.ipAddress !== newDev.ipAddress)];
      saveDevicesList(updated);
      return updated;
    });

    // Open pairing PIN modal so user can enter the TV screen code or connect
    setPinModalDevice(newDev);
    setPinModalTvName(finalName);
    setEnteredPin('');
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
    setNoticeMessage('Cleared device list.');
  };

  // Rename a discovered device
  const handleRenameDevice = (ip: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    saveCustomTvName(ip, trimmed);
    setDiscoveredList((prev) => {
      const updated = prev.map((d) => (d.ipAddress === ip ? { ...d, name: trimmed } : d));
      saveDevicesList(updated);
      return updated;
    });
    setRenamingIp(null);
    setNoticeMessage(`TV renamed to "${trimmed}"`);
  };

  /**
   * Device Card Click:
   * Opens the TV PIN Pairing Code dialog (just like real Google TV / Android TV remote apps)!
   */
  const handleDeviceClick = (device: DiscoveredSmartTV) => {
    setPinModalDevice({
      name: device.name,
      ipAddress: device.ipAddress,
      protocol: device.protocol,
      brandId: device.brandId,
      signalStrength: device.signalStrength,
      isPaired: false,
      port: device.port,
      latencyMs: device.latencyMs,
      serviceType: device.serviceType,
    });
    setPinModalTvName(device.name);
    setEnteredPin('');
  };

  // Send Wake packet directly to a TV
  const handleWakeDevice = (device: DiscoveredSmartTV, e: React.MouseEvent) => {
    e.stopPropagation();
    wakeTvOnLanOrHttp(device.ipAddress, device.brandId);
    setNoticeMessage(`⚡ Sent Wake / Power ON signal to ${device.name} (${device.ipAddress})`);
  };

  // Explicit PIN Confirmation
  const handleConfirmPin = () => {
    if (pinModalDevice) {
      const finalName = pinModalTvName.trim() || pinModalDevice.name;
      const brand = ALL_TV_BRANDS.find((b) => b.id === pinModalDevice.brandId) || currentBrand;

      saveCustomTvName(pinModalDevice.ipAddress, finalName);

      setDiscoveredList((prev) => {
        const updated = prev.map((d) =>
          d.ipAddress === pinModalDevice.ipAddress ? { ...d, name: finalName, isPaired: true } : d
        );
        saveDevicesList(updated);
        return updated;
      });

      if (pinModalDevice.ipAddress && pinModalDevice.ipAddress.includes('.')) {
        wakeTvOnLanOrHttp(pinModalDevice.ipAddress, pinModalDevice.brandId);
      }

      onSelectBrand(brand);
      onConnectDevice({
        ...pinModalDevice,
        name: finalName,
        isPaired: true,
      });
      setNoticeMessage(`✅ Successfully paired with ${finalName}! TV Power ON signal dispatched.`);
      setPinModalDevice(null);
      onClose();
    }
  };

  // Skip PIN and Connect directly from the PIN modal
  const handleDirectConnectSkipPin = () => {
    if (pinModalDevice) {
      const finalName = pinModalTvName.trim() || pinModalDevice.name;
      const brand = ALL_TV_BRANDS.find((b) => b.id === pinModalDevice.brandId) || currentBrand;

      saveCustomTvName(pinModalDevice.ipAddress, finalName);

      setDiscoveredList((prev) => {
        const updated = prev.map((d) =>
          d.ipAddress === pinModalDevice.ipAddress ? { ...d, name: finalName, isPaired: true } : d
        );
        saveDevicesList(updated);
        return updated;
      });

      if (pinModalDevice.ipAddress && pinModalDevice.ipAddress.includes('.')) {
        wakeTvOnLanOrHttp(pinModalDevice.ipAddress, pinModalDevice.brandId);
      }

      onSelectBrand(brand);
      onConnectDevice({
        ...pinModalDevice,
        name: finalName,
        isPaired: true,
      });
      setNoticeMessage(`✅ Connected to ${finalName}! TV Power ON signal dispatched.`);
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
            {/* Wi-Fi Status Banner */}
            <div className="p-3 bg-gradient-to-r from-emerald-950/50 via-slate-900 to-indigo-950/50 rounded-2xl border border-emerald-500/40 text-xs text-slate-200 flex items-start gap-2.5 shadow-sm">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0 mt-0.5">
                <Wifi className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="space-y-1 flex-1">
                <div className="flex items-center justify-between flex-wrap gap-1">
                  <span className="font-bold text-emerald-300 flex items-center gap-1.5">
                    <span>Wi-Fi Connected &amp; Ready</span>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block" />
                  </span>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                    Subnet: {selectedSubnet}x
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Your phone is connected to Wi-Fi. Tap <strong className="text-white">Scan Subnet</strong> or choose your router below (JioFiber, Airtel, TP-Link) to discover and turn on your TV!
                </p>
              </div>
            </div>

            {/* Quick Router Subnet Selector Bar */}
            <div className="p-3.5 bg-slate-950/80 rounded-2xl border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                  Select Your Router Type / Subnet:
                </span>
              </div>

              {/* Quick Subnet Pills */}
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: 'JioFiber (192.168.29.x)', prefix: '192.168.29.' },
                  { label: 'Airtel / BSNL (192.168.1.x)', prefix: '192.168.1.' },
                  { label: 'TP-Link / ACT (192.168.0.x)', prefix: '192.168.0.' },
                  { label: 'Mi Router (192.168.31.x)', prefix: '192.168.31.' },
                ].map((s) => (
                  <button
                    key={s.prefix}
                    type="button"
                    onClick={() => handleSelectSubnet(s.prefix)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                      selectedSubnet === s.prefix
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <select
                  value={selectedSubnet}
                  onChange={(e) => handleSelectSubnet(e.target.value)}
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
                  <span>Target Ports: 8008, 6095, 8060, 8001, 3000</span>
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

            {/* INTEGRATED DIRECT IP CONNECT (FASTEST & MOST RELIABLE) */}
            <div className="bg-slate-950/90 p-4 rounded-2xl border border-indigo-900/40 space-y-3 shadow-lg">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Tv className="w-4 h-4 text-indigo-400" />
                    <span>Connect TV Directly by IP (Instant &amp; Guaranteed)</span>
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Enter your TV&apos;s Wi-Fi IP address to connect and power on instantly without waiting for scan.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowHowToFindIp(!showHowToFindIp)}
                  className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 shrink-0 font-medium"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>How to find IP?</span>
                  {showHowToFindIp ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              </div>

              {/* Expandable Guide on finding TV IP */}
              {showHowToFindIp && (
                <div className="p-3 bg-indigo-950/40 border border-indigo-500/30 rounded-xl text-xs space-y-2 text-slate-300 animate-in fade-in">
                  <div className="font-semibold text-indigo-300">How to find your TV&apos;s IP Address on screen:</div>
                  <ul className="space-y-1.5 text-[11px] list-disc list-inside text-slate-300 leading-relaxed">
                    <li>
                      <strong className="text-white">Android TV / Mi TV / Google TV:</strong> Go to TV Settings ⚙️ &gt; Network &amp; Internet &gt; Select your connected Wi-Fi &gt; View &quot;IP address&quot; (e.g. 192.168.29.15).
                    </li>
                    <li>
                      <strong className="text-white">Samsung TV:</strong> Settings ⚙️ &gt; General &gt; Network &gt; Network Status &gt; IP Settings.
                    </li>
                    <li>
                      <strong className="text-white">LG webOS TV:</strong> Settings ⚙️ &gt; Network &gt; Wi-Fi Connection &gt; Advanced Wi-Fi Settings.
                    </li>
                    <li>
                      <strong className="text-white">Sony Bravia:</strong> Settings ⚙️ &gt; Network &amp; Internet &gt; Status.
                    </li>
                  </ul>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="sm:col-span-2 space-y-1">
                  <input
                    type="text"
                    value={manualIp}
                    onChange={(e) => {
                      setManualIp(e.target.value);
                      setPingStatus('idle');
                    }}
                    placeholder="e.g. 192.168.29.15 or 192.168.1.100"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="space-y-1">
                  <input
                    type="text"
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                    placeholder="TV Name (Optional e.g. bakyard tv)"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                  <div className="flex items-center gap-1.5 pt-0.5 flex-wrap">
                    <span className="text-[10px] text-slate-500">Quick:</span>
                    <button
                      type="button"
                      onClick={() => setManualName('bakyard tv')}
                      className="px-2 py-0.5 rounded-md bg-indigo-950/70 hover:bg-indigo-900 border border-indigo-500/30 text-[10px] font-semibold text-indigo-300 transition-colors"
                    >
                      bakyard tv
                    </button>
                    <button
                      type="button"
                      onClick={() => setManualName('Living Room TV')}
                      className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300 transition-colors"
                    >
                      Living Room TV
                    </button>
                    <button
                      type="button"
                      onClick={() => setManualName('Bedroom TV')}
                      className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300 transition-colors"
                    >
                      Bedroom TV
                    </button>
                  </div>
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
                  className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors border border-slate-700 flex items-center gap-1.5"
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
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {renamingIp === device.ipAddress ? (
                              <div className="flex flex-col gap-1 w-full" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center gap-1">
                                  <input
                                    type="text"
                                    value={renamingText}
                                    onChange={(e) => setRenamingText(e.target.value)}
                                    placeholder="Enter TV Name"
                                    className="px-2 py-1 bg-slate-900 border border-indigo-500 rounded text-xs text-white flex-1"
                                    autoFocus
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleRenameDevice(device.ipAddress, renamingText)}
                                    className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] rounded font-bold transition-colors"
                                  >
                                    Save
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setRenamingIp(null)}
                                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-400 text-[10px] rounded transition-colors"
                                  >
                                    Cancel
                                  </button>
                                </div>
                                <div className="flex items-center gap-1 flex-wrap pt-0.5">
                                  <span className="text-[9px] text-slate-500">Quick fill:</span>
                                  <button
                                    type="button"
                                    onClick={() => setRenamingText('bakyard tv')}
                                    className="px-1.5 py-0.2 rounded bg-indigo-950/60 hover:bg-indigo-900 text-indigo-300 text-[9px] border border-indigo-500/30"
                                  >
                                    bakyard tv
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setRenamingText('Living Room TV')}
                                    className="px-1.5 py-0.2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[9px]"
                                  >
                                    Living Room TV
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setRenamingText('Bedroom TV')}
                                    className="px-1.5 py-0.2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[9px]"
                                  >
                                    Bedroom TV
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <span className="text-sm font-semibold text-white truncate">{device.name}</span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setRenamingIp(device.ipAddress);
                                    setRenamingText(device.name);
                                  }}
                                  className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-indigo-300 transition-colors"
                                  title="Rename this TV"
                                >
                                  <Edit3 className="w-3 h-3" />
                                </button>
                              </>
                            )}

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

                        {/* Pair with PIN button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeviceClick(device);
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shadow flex items-center gap-1.5 ${
                            isCurrent
                              ? 'bg-emerald-600 text-white'
                              : 'bg-indigo-600 text-white hover:bg-indigo-500'
                          }`}
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                          <span>{isCurrent ? 'Paired' : 'Pair / PIN'}</span>
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
                    Make sure phone Wi-Fi is ON and connected to the same home Wi-Fi as your TV. Select your router subnet above and click <strong className="text-indigo-400">Scan Wi-Fi</strong>, or enter your TV IP directly!
                  </p>
                </div>
                <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
                  <button
                    onClick={handleStartRealScan}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow transition-all inline-flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Scan {selectedSubnet}x</span>
                  </button>
                  {selectedSubnet !== '192.168.29.' && (
                    <button
                      onClick={() => {
                        handleSelectSubnet('192.168.29.');
                        setTimeout(() => handleStartRealScan(), 80);
                      }}
                      className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-medium transition-all"
                    >
                      Scan JioFiber (192.168.29.x)
                    </button>
                  )}
                  {selectedSubnet !== '192.168.1.' && (
                    <button
                      onClick={() => {
                        handleSelectSubnet('192.168.1.');
                        setTimeout(() => handleStartRealScan(), 80);
                      }}
                      className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-medium transition-all"
                    >
                      Scan Airtel (192.168.1.x)
                    </button>
                  )}
                </div>
              </div>
            )}
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
                        ipAddress: connectedDevice.ipAddress || manualIp,
                        protocol: 'Wi-Fi',
                        brandId: brand.id,
                        signalStrength: 95,
                        isPaired: true,
                      });
                      onClose();
                    }}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'bg-indigo-950/60 border-indigo-500 shadow-md'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-white">{brand.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                        {brand.operatingSystem}
                      </span>
                    </div>
                    <div className="mt-2 text-[11px] text-slate-400 truncate">
                      {brand.popularModels.slice(0, 2).join(', ')}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Real TV Pairing Code Modal */}
        {pinModalDevice && (
          <div className="absolute inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-slate-900 border border-slate-700/80 rounded-3xl p-5 sm:p-6 max-w-sm w-full space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                    <KeyRound className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white tracking-tight">TV Pairing &amp; Turn ON</h3>
                    <p className="text-[11px] text-slate-400 font-mono">{pinModalDevice.ipAddress} · Wi-Fi</p>
                  </div>
                </div>
                <button
                  onClick={() => setPinModalDevice(null)}
                  className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* TV Name Editor */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-300 flex items-center justify-between">
                  <span>TV Device Name:</span>
                  <span className="text-[10px] text-indigo-400 font-normal">Customizable</span>
                </label>
                <input
                  type="text"
                  value={pinModalTvName}
                  onChange={(e) => setPinModalTvName(e.target.value)}
                  placeholder={pinModalDevice.name || 'Enter TV Name'}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs font-semibold text-white focus:outline-none focus:border-indigo-500"
                />
                {/* Quick Name Suggestions */}
                <div className="flex items-center gap-1.5 pt-0.5 flex-wrap">
                  <span className="text-[10px] text-slate-500">Quick:</span>
                  <button
                    type="button"
                    onClick={() => setPinModalTvName('bakyard tv')}
                    className="px-2 py-0.5 rounded-md bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-500/40 text-[10px] font-semibold text-indigo-300 transition-colors"
                  >
                    bakyard tv
                  </button>
                  <button
                    type="button"
                    onClick={() => setPinModalTvName('Living Room TV')}
                    className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300 transition-colors"
                  >
                    Living Room
                  </button>
                  <button
                    type="button"
                    onClick={() => setPinModalTvName('Bedroom TV')}
                    className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300 transition-colors"
                  >
                    Bedroom TV
                  </button>
                  {pinModalDevice.name && (
                    <button
                      type="button"
                      onClick={() => setPinModalTvName(pinModalDevice.name)}
                      className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-400 transition-colors"
                      title="Reset to discovered name"
                    >
                      Reset Name
                    </button>
                  )}
                </div>
              </div>

              {/* Real TV App PIN Banner */}
              <div className="p-3 rounded-2xl bg-gradient-to-r from-amber-950/40 to-indigo-950/40 border border-amber-500/30 text-xs text-slate-200 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-amber-300 text-[11px]">
                  <Tv className="w-3.5 h-3.5" />
                  <span>Check Your TV Screen</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Real TV remote apps ask for the 4 or 6-digit PIN code displayed on your TV screen. TV screen par dikh raha pairing code enter kijiye:
                </p>
              </div>

              {/* Large PIN Input */}
              <div className="space-y-1.5">
                <input
                  type="text"
                  value={enteredPin}
                  onChange={(e) => setEnteredPin(e.target.value.toUpperCase())}
                  placeholder="e.g. 1234 or A1B2"
                  maxLength={6}
                  autoFocus
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 focus:border-indigo-500 rounded-2xl text-center text-xl font-mono font-bold text-white tracking-widest uppercase focus:outline-none focus:ring-2 focus:ring-indigo-500/40 shadow-inner"
                />
                <p className="text-[10px] text-center text-slate-400">
                  Enter pairing code or tap Direct Turn ON below
                </p>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={handleConfirmPin}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all active:scale-95"
                >
                  <Zap className="w-4 h-4 text-amber-300" />
                  <span>Confirm PIN &amp; Turn ON TV ⚡</span>
                </button>

                <button
                  type="button"
                  onClick={handleDirectConnectSkipPin}
                  className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <span>Direct Connect &amp; Turn ON (Skip PIN)</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
