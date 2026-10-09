import React, { useState } from 'react';
import {
  X,
  Search,
  Wifi,
  Bluetooth,
  Radio,
  Check,
  RefreshCw,
  Tv,
  Globe,
  MapPin,
  KeyRound,
  ShieldCheck,
} from 'lucide-react';
import { ALL_TV_BRANDS, type TVBrandInfo } from '../data/tvDatabase';

export interface ConnectedDevice {
  name: string;
  ipAddress: string;
  protocol: 'Wi-Fi' | 'Bluetooth' | 'IR Blaster';
  brandId: string;
  signalStrength: number;
  isPaired: boolean;
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
  const [isScanning, setIsScanning] = useState(false);
  const [manualIp, setManualIp] = useState('192.168.1.105');
  const [manualPort, setManualPort] = useState('6467');
  const [pinModalDevice, setPinModalDevice] = useState<ConnectedDevice | null>(null);
  const [enteredPin, setEnteredPin] = useState('');

  if (!isOpen) return null;

  // Nearby discoverable devices list
  const discoveredDevices: ConnectedDevice[] = [
    { name: 'Mi TV 4X 55 (Living Room)', ipAddress: '192.168.1.104', protocol: 'Wi-Fi', brandId: 'mi', signalStrength: 95, isPaired: true },
    { name: 'Coocaa 55" Eye Care Google TV', ipAddress: '192.168.1.95', protocol: 'Wi-Fi', brandId: 'coocaa', signalStrength: 86, isPaired: false },
    { name: 'OnePlus TV Y1S Pro (Bedroom)', ipAddress: '192.168.1.88', protocol: 'Wi-Fi', brandId: 'oneplus', signalStrength: 88, isPaired: false },
    { name: 'Vu GloLED 4K Masterpiece', ipAddress: '192.168.1.91', protocol: 'Wi-Fi', brandId: 'vu', signalStrength: 78, isPaired: false },
    { name: 'Sony Bravia Google TV 4K', ipAddress: '192.168.1.72', protocol: 'Wi-Fi', brandId: 'sony', signalStrength: 90, isPaired: false },
    { name: 'Samsung Crystal 4K UHD', ipAddress: '192.168.1.60', protocol: 'Wi-Fi', brandId: 'samsung', signalStrength: 82, isPaired: false },
    { name: 'LG OLED evo webOS TV', ipAddress: '192.168.1.50', protocol: 'Wi-Fi', brandId: 'lg', signalStrength: 75, isPaired: false },
    { name: 'Android TV Bluetooth Remote (BLE)', ipAddress: 'BLE:4A:22:90', protocol: 'Bluetooth', brandId: 'google_tv', signalStrength: 92, isPaired: false },
  ];

  const handleStartScan = () => {
    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
    }, 1200);
  };

  const handleDeviceClick = (device: ConnectedDevice) => {
    // If not paired, ask for pairing PIN
    if (!device.isPaired) {
      setPinModalDevice(device);
      setEnteredPin('');
    } else {
      const brand = ALL_TV_BRANDS.find((b) => b.id === device.brandId) || currentBrand;
      onSelectBrand(brand);
      onConnectDevice(device);
      onClose();
    }
  };

  const handleConfirmPin = () => {
    if (pinModalDevice) {
      const brand = ALL_TV_BRANDS.find((b) => b.id === pinModalDevice.brandId) || currentBrand;
      onSelectBrand(brand);
      onConnectDevice({ ...pinModalDevice, isPaired: true });
      setPinModalDevice(null);
      onClose();
    }
  };

  const filteredBrands = ALL_TV_BRANDS.filter((brand) => {
    const matchesRegion = brandRegion === 'All' || brand.region === brandRegion || brand.region === 'Both';
    const matchesQuery =
      brand.name.toLowerCase().includes(brandSearch.toLowerCase()) ||
      brand.operatingSystem.toLowerCase().includes(brandSearch.toLowerCase()) ||
      brand.popularModels.some((m) => m.toLowerCase().includes(brandSearch.toLowerCase()));
    return matchesRegion && matchesQuery;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Tv className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Connect Your TV</h2>
              <p className="text-xs text-slate-400">Select connection method or pick from Indian & global brands</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="p-3 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-1.5 p-1 bg-slate-900 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab('scan')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                activeTab === 'scan' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Wifi className="w-3.5 h-3.5" />
              <span>Scan Nearby TVs</span>
            </button>
            <button
              onClick={() => setActiveTab('brands')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                activeTab === 'brands' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>All TV Brands ({ALL_TV_BRANDS.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('manual')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                activeTab === 'manual' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Manual IP Connect</span>
            </button>
          </div>

          {activeTab === 'scan' && (
            <button
              onClick={handleStartScan}
              disabled={isScanning}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin text-indigo-400' : ''}`} />
              <span>{isScanning ? 'Scanning...' : 'Rescan'}</span>
            </button>
          )}
        </div>

        {/* Tab Content 1: Scan Nearby Devices */}
        {activeTab === 'scan' && (
          <div className="p-5 overflow-y-auto space-y-3 flex-1">
            <div className="text-xs text-slate-400 flex items-center justify-between pb-1">
              <span>Discovered Devices on Local Wi-Fi & Bluetooth:</span>
              <span className="font-mono text-[11px] text-emerald-400">7 TVs detected</span>
            </div>

            {discoveredDevices.map((device) => {
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
                    <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-300">
                      {device.protocol === 'Wi-Fi' ? (
                        <Wifi className="w-5 h-5 text-indigo-400" />
                      ) : (
                        <Bluetooth className="w-5 h-5 text-blue-400" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-white">{device.name}</span>
                        {device.isPaired && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-mono">
                            Paired
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 font-mono mt-0.5">
                        {device.ipAddress} · Signal: {device.signalStrength}%
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                        isCurrent
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-800 text-slate-200 hover:bg-indigo-600 hover:text-white'
                      }`}
                    >
                      {isCurrent ? 'Active' : device.isPaired ? 'Connect' : 'Pair'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Tab Content 2: All TV Brands Directory */}
        {activeTab === 'brands' && (
          <div className="p-4 flex flex-col flex-1 overflow-hidden space-y-3">
            {/* Search and Filters */}
            <div className="space-y-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search Indian or global TV brand (e.g. Mi, Vu, OnePlus, Onida, Samsung...)"
                  value={brandSearch}
                  onChange={(e) => setBrandSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              {/* Region Selector */}
              <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800 w-fit">
                <button
                  onClick={() => setBrandRegion('All')}
                  className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                    brandRegion === 'All' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  All ({ALL_TV_BRANDS.length})
                </button>
                <button
                  onClick={() => setBrandRegion('India')}
                  className={`px-3 py-1 text-xs font-medium rounded-lg flex items-center gap-1 transition-colors ${
                    brandRegion === 'India' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <MapPin className="w-3 h-3 text-orange-400" /> Indian Brands ({ALL_TV_BRANDS.filter((b) => b.region === 'India').length})
                </button>
                <button
                  onClick={() => setBrandRegion('Global')}
                  className={`px-3 py-1 text-xs font-medium rounded-lg flex items-center gap-1 transition-colors ${
                    brandRegion === 'Global' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Globe className="w-3 h-3 text-blue-400" /> Global Brands ({ALL_TV_BRANDS.filter((b) => b.region === 'Global').length})
                </button>
              </div>
            </div>

            {/* Brands Scroll Area */}
            <div className="overflow-y-auto space-y-2 flex-1 pr-1">
              {filteredBrands.map((brand) => {
                const isSelected = brand.id === currentBrand.id;
                return (
                  <div
                    key={brand.id}
                    onClick={() => {
                      onSelectBrand(brand);
                      onConnectDevice({
                        name: `${brand.name} TV`,
                        ipAddress: '192.168.1.100',
                        protocol: brand.protocols[0] === 'IR Blaster' ? 'IR Blaster' : 'Wi-Fi',
                        brandId: brand.id,
                        signalStrength: 95,
                        isPaired: true,
                      });
                      onClose();
                    }}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? 'bg-indigo-950/40 border-indigo-500/50 shadow ring-1 ring-indigo-500/40'
                        : 'bg-slate-950/60 border-slate-800/80 hover:bg-slate-800/50 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">{brand.name}</span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-md font-mono ${
                            brand.region === 'India'
                              ? 'bg-orange-950/80 text-orange-300 border border-orange-800/60'
                              : 'bg-blue-950/80 text-blue-300 border border-blue-800/60'
                          }`}
                        >
                          {brand.region}
                        </span>
                        <span className="text-xs text-slate-400">· {brand.operatingSystem}</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5 truncate max-w-md">
                        Models: {brand.popularModels.slice(0, 2).join(', ')}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center border transition-all ${
                          isSelected
                            ? 'bg-indigo-600 border-indigo-500 text-white'
                            : 'border-slate-700 text-transparent'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab Content 3: Manual IP Connect */}
        {activeTab === 'manual' && (
          <div className="p-6 space-y-4 flex-1">
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
              <h3 className="text-sm font-bold text-white">Manual Android TV IP Connect</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                If your TV is not showing up in auto-scan, enter the IP address found in your Android TV settings (Settings &gt; Network &amp; Internet &gt; IP Address).
              </p>

              <div className="grid grid-cols-3 gap-3 pt-2">
                <div className="col-span-2">
                  <label className="text-[11px] text-slate-400 block mb-1">TV IP Address</label>
                  <input
                    type="text"
                    value={manualIp}
                    onChange={(e) => setManualIp(e.target.value)}
                    placeholder="192.168.1.xxx"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Port</label>
                  <input
                    type="text"
                    value={manualPort}
                    onChange={(e) => setManualPort(e.target.value)}
                    placeholder="6467"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <button
                onClick={() => {
                  onConnectDevice({
                    name: `Custom Smart TV (${manualIp})`,
                    ipAddress: manualIp,
                    protocol: 'Wi-Fi',
                    brandId: currentBrand.id,
                    signalStrength: 90,
                    isPaired: true,
                  });
                  onClose();
                }}
                className="w-full py-2.5 mt-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow transition-all"
              >
                Connect to {manualIp}
              </button>
            </div>
          </div>
        )}

        {/* PIN Pairing Modal Overlay */}
        {pinModalDevice && (
          <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-sm z-30 p-6 flex flex-col items-center justify-center text-center animate-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-3">
              <KeyRound className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white">Enter Pairing PIN Code</h3>
            <p className="text-xs text-slate-400 max-w-sm mt-1 leading-relaxed">
              A 4-character PIN code has appeared on your TV screen ({pinModalDevice.name}). Enter it below to authorize this remote.
            </p>

            <div className="my-4">
              <input
                type="text"
                maxLength={6}
                value={enteredPin}
                onChange={(e) => setEnteredPin(e.target.value.toUpperCase())}
                placeholder="ABCD or 1234"
                className="w-44 text-center tracking-widest text-lg font-mono font-bold px-4 py-2.5 bg-slate-900 border border-indigo-500 rounded-xl text-white focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setPinModalDevice(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmPin}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow flex items-center gap-1.5"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Pair &amp; Connect</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
