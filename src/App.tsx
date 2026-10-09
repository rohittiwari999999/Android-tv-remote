import { useState, useEffect } from 'react';
import {
  Tv,
  Wifi,
  Bluetooth,
  Radio,
  Volume,
  VolumeX,
  Download,
  Zap,
} from 'lucide-react';
import { ALL_TV_BRANDS, type TVBrandInfo, type StreamingApp } from './data/tvDatabase';
import { TVScreenPreview, type TVState } from './components/TVScreenPreview';
import { RemoteControlPad } from './components/RemoteControlPad';
import { DevicePairingModal, type ConnectedDevice } from './components/DevicePairingModal';
import { VoiceAssistantModal } from './components/VoiceAssistantModal';
import { BrandQuickPicker } from './components/BrandQuickPicker';
import { InstallApkModal } from './components/InstallApkModal';
import {
  getStoredActiveDevice,
  setStoredActiveDevice,
  dispatchRealTvCommand,
  wakeTvOnLanOrHttp,
} from './utils/networkScanner';

export default function App() {
  // Default to popular Indian TV brand: Xiaomi Mi TV
  const [currentBrand, setCurrentBrand] = useState<TVBrandInfo>(ALL_TV_BRANDS[0]);
  const [activeProtocol, setActiveProtocol] = useState<'Wi-Fi' | 'Bluetooth' | 'IR Blaster'>('Wi-Fi');
  const [isPairingModalOpen, setIsPairingModalOpen] = useState(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [isApkModalOpen, setIsApkModalOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Connected device status with persistent real device loading
  const [connectedDevice, setConnectedDevice] = useState<ConnectedDevice>(() => {
    const stored = getStoredActiveDevice();
    if (stored) {
      return stored;
    }
    return {
      name: 'Connect Smart TV',
      ipAddress: 'Tap to Scan Wi-Fi',
      protocol: 'Wi-Fi',
      brandId: 'mi',
      signalStrength: 0,
      isPaired: false,
    };
  });

  // Sync active brand with stored device if exists on mount
  useEffect(() => {
    const stored = getStoredActiveDevice();
    if (stored && stored.brandId) {
      const match = ALL_TV_BRANDS.find((b) => b.id === stored.brandId);
      if (match) {
        setCurrentBrand(match);
      }
    }
  }, []);

  // Simulated TV Screen State
  const [tvState, setTvState] = useState<TVState>({
    isPoweredOn: true,
    currentApp: null,
    volume: 32,
    isMuted: false,
    channel: 204,
    channelName: 'Star Sports 1 HD',
    activeInput: 'HDMI 1',
    assistantActive: false,
    assistantQuery: '',
    osdMessage: null,
    selectedBrand: ALL_TV_BRANDS[0],
  });

  // Helper to send real Wi-Fi packets if connected to a real TV
  const sendNetworkCommand = (command: string) => {
    if (connectedDevice.isPaired && connectedDevice.protocol === 'Wi-Fi' && connectedDevice.ipAddress.includes('.')) {
      dispatchRealTvCommand(connectedDevice.ipAddress, command, connectedDevice.brandId);
    }
  };

  // Toast / OSD helper
  const showTvMessage = (msg: string) => {
    setTvState((prev) => ({ ...prev, osdMessage: msg }));
    setTimeout(() => {
      setTvState((prev) => (prev.osdMessage === msg ? { ...prev, osdMessage: null } : prev));
    }, 2500);
  };

  // Remote Control Handlers
  const handlePowerToggle = () => {
    sendNetworkCommand('power');
    setTvState((prev) => {
      const nextPower = !prev.isPoweredOn;
      return {
        ...prev,
        isPoweredOn: nextPower,
        osdMessage: nextPower ? 'TV Powered On' : 'TV Entering Standby...',
      };
    });
    setTimeout(() => {
      setTvState((prev) => ({ ...prev, osdMessage: null }));
    }, 2000);
  };

  const handleVolumeChange = (delta: number) => {
    if (!tvState.isPoweredOn) return;
    sendNetworkCommand(delta > 0 ? 'volume_up' : 'volume_down');
    setTvState((prev) => {
      const newVol = Math.max(0, Math.min(100, prev.volume + delta));
      return {
        ...prev,
        volume: newVol,
        isMuted: false,
        osdMessage: `Volume: ${newVol}`,
      };
    });
    setTimeout(() => {
      setTvState((prev) => ({ ...prev, osdMessage: null }));
    }, 2000);
  };

  const handleMuteToggle = () => {
    if (!tvState.isPoweredOn) return;
    sendNetworkCommand('mute');
    setTvState((prev) => ({
      ...prev,
      isMuted: !prev.isMuted,
      osdMessage: !prev.isMuted ? 'Sound Muted' : `Volume: ${prev.volume}`,
    }));
  };

  const handleChannelChange = (delta: number) => {
    if (!tvState.isPoweredOn) return;
    const channels = [
      { num: 101, name: 'DD National' },
      { num: 204, name: 'Star Sports 1 HD' },
      { num: 301, name: 'Colors HD' },
      { num: 405, name: 'Sony MAX' },
      { num: 512, name: 'Discovery HD' },
      { num: 620, name: 'Aaj Tak' },
      { num: 701, name: 'Cartoon Network' },
    ];
    setTvState((prev) => {
      const newCh = Math.max(1, prev.channel + delta);
      const match = channels.find((c) => c.num === newCh) || { num: newCh, name: `Channel ${newCh}` };
      return {
        ...prev,
        channel: match.num,
        channelName: match.name,
        currentApp: null, // Switch from app to TV channel
        osdMessage: `Switched to ${match.num}: ${match.name}`,
      };
    });
  };

  const handleDirectChannel = (chNum: number) => {
    if (!tvState.isPoweredOn) return;
    setTvState((prev) => ({
      ...prev,
      channel: chNum,
      channelName: `Channel ${chNum}`,
      currentApp: null,
      osdMessage: `Tuned to Channel ${chNum}`,
    }));
  };

  const handleLaunchApp = (app: StreamingApp) => {
    sendNetworkCommand(`app_${app.name}`);
    if (!tvState.isPoweredOn) {
      setTvState((prev) => ({ ...prev, isPoweredOn: true }));
    }
    setTvState((prev) => ({
      ...prev,
      currentApp: app,
      osdMessage: `Launching ${app.name}...`,
    }));
    setTimeout(() => {
      setTvState((prev) => ({ ...prev, osdMessage: null }));
    }, 2500);
  };

  const handleTriggerVoice = (query?: string) => {
    if (!query) {
      setIsVoiceModalOpen(true);
      return;
    }
    setTvState((prev) => ({
      ...prev,
      assistantActive: true,
      assistantQuery: query,
      osdMessage: `Google Assistant: "${query}"`,
    }));

    setTimeout(() => {
      setTvState((prev) => ({ ...prev, assistantActive: false, assistantQuery: '' }));
    }, 3500);
  };

  const handleInputChange = () => {
    const inputs = ['HDMI 1', 'HDMI 2 (eARC)', 'HDMI 3', 'AV Input', 'DTH Cable TV'];
    setTvState((prev) => {
      const currentIndex = inputs.indexOf(prev.activeInput);
      const nextInput = inputs[(currentIndex + 1) % inputs.length];
      return {
        ...prev,
        activeInput: nextInput,
        osdMessage: `Input Switched to: ${nextInput}`,
      };
    });
  };

  const handleSpecialMode = (modeName: string) => {
    showTvMessage(modeName);
  };

  const handleSendTextToTv = (text: string) => {
    showTvMessage(`Searched on TV: "${text}"`);
  };

  const handleSelectBrand = (brand: TVBrandInfo) => {
    setCurrentBrand(brand);
    setTvState((prev) => ({
      ...prev,
      selectedBrand: brand,
      osdMessage: `Configured Remote for ${brand.name}`,
    }));
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500/30 flex flex-col justify-between">
      {/* Top Bar Contract (1 Row, 3 Zones) */}
      <header className="sticky top-0 z-40 bg-slate-950/85 backdrop-blur-md border-b border-slate-800/80 px-6 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Zone 1: Brand Wordmark */}
          <div className="flex items-center gap-3">
            <span className="text-base font-bold tracking-tight text-white flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              Android TV Remote
            </span>
            <span className="hidden sm:inline text-xs text-slate-400">
              India &amp; Global Universal TV Controller
            </span>
          </div>

          {/* Zone 2: Navigation Links / Sub-actions */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-300">
            <button
              onClick={() => setIsPairingModalOpen(true)}
              className="hover:text-white transition-colors flex items-center gap-1.5"
            >
              <Tv className="w-3.5 h-3.5 text-indigo-400" />
              <span>TV Directory (30+ Brands)</span>
            </button>
            <button
              onClick={() => setIsVoiceModalOpen(true)}
              className="hover:text-white transition-colors"
            >
              Voice Assistant
            </button>
            <button
              onClick={() => handleSpecialMode('Audio Click Toggled')}
              className="hover:text-white transition-colors"
            >
              Haptic Feedback
            </button>
          </nav>

          {/* Zone 3: Primary Action / Connection Status Pill */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPairingModalOpen(true)}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 flex items-center gap-2 transition-colors shadow-sm"
              title="Change Connected TV"
            >
              {connectedDevice.protocol === 'Wi-Fi' && <Wifi className="w-3.5 h-3.5 text-emerald-400" />}
              {connectedDevice.protocol === 'Bluetooth' && <Bluetooth className="w-3.5 h-3.5 text-blue-400" />}
              {connectedDevice.protocol === 'IR Blaster' && <Radio className="w-3.5 h-3.5 text-amber-400" />}
              <span className="truncate max-w-[150px]">{connectedDevice.name}</span>
            </button>

            {/* Quick Wake / Turn On TV button if connected to Wi-Fi */}
            {connectedDevice.isPaired && connectedDevice.ipAddress.includes('.') && (
              <button
                onClick={() => {
                  wakeTvOnLanOrHttp(connectedDevice.ipAddress, connectedDevice.brandId);
                  setTvState((prev) => ({
                    ...prev,
                    isPoweredOn: true,
                    osdMessage: 'TV Turn ON Signal Sent ⚡',
                  }));
                }}
                className="px-2.5 py-1.5 text-xs font-semibold rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 flex items-center gap-1 transition-all shadow-sm"
                title="Send Wake-on-LAN / Power ON signal to TV"
              >
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Turn ON</span>
              </button>
            )}

            {/* Install / Get APK Button */}
            <button
              onClick={() => setIsApkModalOpen(true)}
              className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 transition-all shadow-sm"
              title="Install App on Phone / Download APK"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Install / APK</span>
            </button>

            {/* Sound Toggle */}
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="w-8 h-8 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
              title="Toggle Click Sound"
            >
              {soundEnabled ? <Volume className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Workbench */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 w-full flex-1">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* LEFT COLUMN: Simulated TV Screen & Brand Compatibility Suite */}
          <div className="lg:col-span-7 space-y-6">
            {/* Live TV Screen Mockup Display */}
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Live TV Screen Display
                </span>
                <span className="text-xs text-slate-400">
                  Responds to your remote button clicks in real time
                </span>
              </div>

              <TVScreenPreview
                tvState={tvState}
                onPowerToggle={handlePowerToggle}
              />
            </div>

            {/* Quick Brand Switcher & Compatibility Catalog */}
            <BrandQuickPicker
              currentBrand={currentBrand}
              onSelectBrand={handleSelectBrand}
              onOpenFullModal={() => setIsPairingModalOpen(true)}
            />

            {/* Features & Protocol Info Box */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-300">
              <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
                <div className="flex items-center gap-1.5 text-amber-400 font-bold">
                  <Radio className="w-4 h-4" />
                  <span>Universal IR Blaster</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Controls traditional CRT, LCD, and non-smart TVs via NEC 38kHz &amp; Philips RC5 carrier pulses.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
                <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                  <Wifi className="w-4 h-4" />
                  <span>Wi-Fi LAN Smart Remote</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Fast Android TV Remote v2 (TLS 6467), Samsung Tizen WebSocket &amp; LG webOS SSAP.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
                <div className="flex items-center gap-1.5 text-blue-400 font-bold">
                  <Bluetooth className="w-4 h-4" />
                  <span>Bluetooth Low Energy</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Direct pairing with Xiaomi Mi TV, OnePlus TV, Google TV Streamer &amp; Fire TV sticks.
                </p>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: The Interactive Universal Mobile Remote Control */}
          <div className="lg:col-span-5 flex flex-col items-center">
            <RemoteControlPad
              currentBrand={currentBrand}
              isPoweredOn={tvState.isPoweredOn}
              onPowerToggle={handlePowerToggle}
              onVolumeChange={handleVolumeChange}
              onMuteToggle={handleMuteToggle}
              onChannelChange={handleChannelChange}
              onDirectChannel={handleDirectChannel}
              onLaunchApp={handleLaunchApp}
              onTriggerVoice={() => setIsVoiceModalOpen(true)}
              onInputChange={handleInputChange}
              onTriggerSpecialMode={handleSpecialMode}
              onSendTextToTv={handleSendTextToTv}
              activeProtocol={activeProtocol}
              onChangeProtocol={setActiveProtocol}
            />
          </div>
        </div>
      </main>

      {/* Device Pairing & TV Brands Catalog Modal */}
      <DevicePairingModal
        isOpen={isPairingModalOpen}
        onClose={() => setIsPairingModalOpen(false)}
        currentBrand={currentBrand}
        onSelectBrand={handleSelectBrand}
        connectedDevice={connectedDevice}
        onConnectDevice={(dev) => {
          setConnectedDevice(dev);
          setActiveProtocol(dev.protocol);
          setStoredActiveDevice({
            id: `dev-${dev.ipAddress}`,
            name: dev.name,
            ipAddress: dev.ipAddress,
            port: dev.port || 8008,
            protocol: dev.protocol,
            brandId: dev.brandId,
            signalStrength: dev.signalStrength,
            latencyMs: dev.latencyMs || 18,
            serviceType: dev.serviceType || 'Smart TV',
            isPaired: true,
            isDemo: dev.isDemo,
          });
          // Ensure TV power state is active and send wake-up signal immediately
          setTvState((prev) => ({
            ...prev,
            isPoweredOn: true,
            osdMessage: `Connected to ${dev.name} · TV Active ⚡`,
          }));
          if (dev.ipAddress && dev.ipAddress.includes('.')) {
            wakeTvOnLanOrHttp(dev.ipAddress, dev.brandId);
          }
          showTvMessage(`Connected to ${dev.name}`);
        }}
      />

      {/* Voice Assistant Modal */}
      <VoiceAssistantModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
        onExecuteVoiceCommand={handleTriggerVoice}
        brandName={currentBrand.name}
      />

      {/* Android Install & APK Guide Modal */}
      <InstallApkModal
        isOpen={isApkModalOpen}
        onClose={() => setIsApkModalOpen(false)}
        appUrl={typeof window !== 'undefined' ? window.location.href : 'https://ais-pre-4lav654jhfe26ukjlqm4yd-751137797858.asia-east1.run.app'}
      />

      {/* Footer */}
      <footer className="mt-8 border-t border-slate-900 py-4 px-6 text-center text-xs text-slate-500">
        <p>Universal Android TV Remote · Compatible with all Indian &amp; Global Televisions</p>
      </footer>
    </div>
  );
}
