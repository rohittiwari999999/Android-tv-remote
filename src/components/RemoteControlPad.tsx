import React, { useState, useRef } from 'react';
import {
  Power,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Home,
  ArrowLeft,
  Volume2,
  Volume1,
  VolumeX,
  ChevronsUp,
  ChevronsDown,
  Settings,
  Tv,
  Mic,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Trophy,
  Zap,
  Layers,
  Send,
  MousePointer,
  Grid,
  Hash,
  Keyboard as KeyboardIcon,
  Disc,
  Eye,
} from 'lucide-react';
import type { TVBrandInfo, StreamingApp } from '../data/tvDatabase';
import { STREAMING_APPS } from '../data/tvDatabase';
import { playTactileClick } from '../utils/audioFeedback';

interface RemoteControlPadProps {
  currentBrand: TVBrandInfo;
  isPoweredOn: boolean;
  onPowerToggle: () => void;
  onVolumeChange: (delta: number) => void;
  onMuteToggle: () => void;
  onChannelChange: (delta: number) => void;
  onDirectChannel: (ch: number) => void;
  onLaunchApp: (app: StreamingApp) => void;
  onTriggerVoice: (query?: string) => void;
  onInputChange: () => void;
  onTriggerSpecialMode: (modeName: string) => void;
  onSendTextToTv: (text: string) => void;
  activeProtocol: 'Wi-Fi' | 'Bluetooth' | 'IR Blaster';
  onChangeProtocol: (protocol: 'Wi-Fi' | 'Bluetooth' | 'IR Blaster') => void;
}

export const RemoteControlPad: React.FC<RemoteControlPadProps> = ({
  currentBrand,
  isPoweredOn,
  onPowerToggle,
  onVolumeChange,
  onMuteToggle,
  onChannelChange,
  onDirectChannel,
  onLaunchApp,
  onTriggerVoice,
  onInputChange,
  onTriggerSpecialMode,
  onSendTextToTv,
  activeProtocol,
  onChangeProtocol,
}) => {
  const [remoteMode, setRemoteMode] = useState<'dpad' | 'touchpad' | 'numpad' | 'apps' | 'keyboard'>('dpad');
  const [pressedBtn, setPressedBtn] = useState<string | null>(null);
  const [keyboardText, setKeyboardText] = useState('');
  const [touchpadPos, setTouchpadPos] = useState({ x: 50, y: 50 });
  const [isDraggingTouchpad, setIsDraggingTouchpad] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);

  const trackpadRef = useRef<HTMLDivElement>(null);

  const handlePress = (btnId: string, action: () => void, clickSound: 'click' | 'power' | 'nav' = 'click') => {
    setPressedBtn(btnId);
    playTactileClick(clickSound);
    action();
    setTimeout(() => {
      setPressedBtn(null);
    }, 150);
  };

  // Trackpad Touch/Mouse drag handler
  const handleTrackpadMove = (clientX: number, clientY: number) => {
    if (!trackpadRef.current) return;
    const rect = trackpadRef.current.getBoundingClientRect();
    const x = Math.max(5, Math.min(95, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.max(5, Math.min(95, ((clientY - rect.top) / rect.height) * 100));
    setTouchpadPos({ x, y });
  };

  const handleTouchpadClick = () => {
    handlePress('trackpad_click', () => {
      onTriggerSpecialMode('Selected item on TV');
    }, 'nav');
  };

  return (
    <div className="relative w-full max-w-[380px] bg-slate-900 border border-slate-800 rounded-[44px] p-3 shadow-2xl flex flex-col items-center select-none">
      {/* Top IR Emitter Diode simulation */}
      <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 flex items-center gap-1">
        <div
          className={`w-3.5 h-3.5 rounded-full border border-slate-700 flex items-center justify-center transition-all ${
            pressedBtn && activeProtocol === 'IR Blaster'
              ? 'bg-purple-400 ring-4 ring-purple-500/50 scale-125'
              : 'bg-slate-950'
          }`}
        >
          <div className="w-1.5 h-1.5 rounded-full bg-slate-800" />
        </div>
      </div>

      {/* Remote Top Bar: Connection protocol selector */}
      <div className="w-full pt-2 pb-2 px-3 flex items-center justify-between border-b border-slate-800/80">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold text-white tracking-tight">{currentBrand.name}</span>
          <span className="text-[10px] text-slate-400">({currentBrand.region})</span>
        </div>

        {/* Protocol Pills */}
        <div className="flex items-center gap-1 p-0.5 bg-slate-950 rounded-lg border border-slate-800 text-[10px]">
          {(['Wi-Fi', 'Bluetooth', 'IR Blaster'] as const).map((proto) => (
            <button
              key={proto}
              onClick={() => {
                onChangeProtocol(proto);
                playTactileClick('click');
              }}
              className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
                activeProtocol === proto
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {proto === 'IR Blaster' ? 'IR' : proto}
            </button>
          ))}
        </div>
      </div>

      {/* Mode Switcher Tabs (D-Pad, Touchpad, Numpad, Apps, Keyboard) */}
      <div className="w-full my-2 px-2">
        <div className="grid grid-cols-5 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
          <button
            onClick={() => {
              setRemoteMode('dpad');
              playTactileClick('click');
            }}
            className={`py-1.5 rounded-lg flex flex-col items-center justify-center transition-all ${
              remoteMode === 'dpad' ? 'bg-indigo-600 text-white font-semibold shadow' : 'text-slate-400 hover:text-white'
            }`}
            title="D-Pad Remote"
          >
            <Disc className="w-3.5 h-3.5" />
            <span className="text-[10px] mt-0.5">D-Pad</span>
          </button>

          <button
            onClick={() => {
              setRemoteMode('touchpad');
              playTactileClick('click');
            }}
            className={`py-1.5 rounded-lg flex flex-col items-center justify-center transition-all ${
              remoteMode === 'touchpad' ? 'bg-indigo-600 text-white font-semibold shadow' : 'text-slate-400 hover:text-white'
            }`}
            title="Touchpad Mouse"
          >
            <MousePointer className="w-3.5 h-3.5" />
            <span className="text-[10px] mt-0.5">Trackpad</span>
          </button>

          <button
            onClick={() => {
              setRemoteMode('numpad');
              playTactileClick('click');
            }}
            className={`py-1.5 rounded-lg flex flex-col items-center justify-center transition-all ${
              remoteMode === 'numpad' ? 'bg-indigo-600 text-white font-semibold shadow' : 'text-slate-400 hover:text-white'
            }`}
            title="0-9 Numbers"
          >
            <Hash className="w-3.5 h-3.5" />
            <span className="text-[10px] mt-0.5">1-2-3</span>
          </button>

          <button
            onClick={() => {
              setRemoteMode('apps');
              playTactileClick('click');
            }}
            className={`py-1.5 rounded-lg flex flex-col items-center justify-center transition-all ${
              remoteMode === 'apps' ? 'bg-indigo-600 text-white font-semibold shadow' : 'text-slate-400 hover:text-white'
            }`}
            title="Streaming Apps"
          >
            <Grid className="w-3.5 h-3.5" />
            <span className="text-[10px] mt-0.5">Apps</span>
          </button>

          <button
            onClick={() => {
              setRemoteMode('keyboard');
              playTactileClick('click');
            }}
            className={`py-1.5 rounded-lg flex flex-col items-center justify-center transition-all ${
              remoteMode === 'keyboard' ? 'bg-indigo-600 text-white font-semibold shadow' : 'text-slate-400 hover:text-white'
            }`}
            title="Send Text to TV"
          >
            <KeyboardIcon className="w-3.5 h-3.5" />
            <span className="text-[10px] mt-0.5">Type</span>
          </button>
        </div>
      </div>

      {/* Main Remote Body Container */}
      <div className="w-full px-2 pb-2 space-y-3">
        {/* Top Critical Controls: Power, Mute, Source/Input, Settings */}
        <div className="flex items-center justify-between px-2">
          {/* Power Button */}
          <button
            onClick={() => handlePress('power', onPowerToggle, 'power')}
            className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all shadow-md ${
              isPoweredOn
                ? 'bg-rose-600 hover:bg-rose-500 text-white'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white ring-2 ring-emerald-400'
            } ${pressedBtn === 'power' ? 'scale-90 ring-4 ring-rose-500/50' : 'active:scale-95'}`}
            title="Power On/Off"
          >
            <Power className="w-5 h-5" />
          </button>

          {/* Special Indian TV Hotkey (Cricket Mode for Vu/Thomson, Devil Bass for Onida, PatchWall for Mi) */}
          {currentBrand.id === 'vu' && (
            <button
              onClick={() => handlePress('cricket', () => onTriggerSpecialMode('Vu Cricket Mode Activated!'))}
              className="px-2.5 py-1.5 rounded-xl bg-emerald-950/80 border border-emerald-600 text-emerald-300 text-[11px] font-bold flex items-center gap-1 active:scale-95"
            >
              <Trophy className="w-3.5 h-3.5 text-emerald-400" />
              <span>Cricket Mode</span>
            </button>
          )}

          {currentBrand.id === 'onida' && (
            <button
              onClick={() => handlePress('bass', () => onTriggerSpecialMode('Devil Bass Sound Boost On!'))}
              className="px-2.5 py-1.5 rounded-xl bg-rose-950/80 border border-rose-600 text-rose-300 text-[11px] font-bold flex items-center gap-1 active:scale-95"
            >
              <Zap className="w-3.5 h-3.5 text-rose-400" />
              <span>Devil Bass</span>
            </button>
          )}

          {currentBrand.id === 'mi' && (
            <button
              onClick={() => handlePress('patchwall', () => onTriggerSpecialMode('PatchWall Hub Opened'))}
              className="px-2.5 py-1.5 rounded-xl bg-orange-950/80 border border-orange-600 text-orange-300 text-[11px] font-bold flex items-center gap-1 active:scale-95"
            >
              <Layers className="w-3.5 h-3.5 text-orange-400" />
              <span>PatchWall</span>
            </button>
          )}

          {currentBrand.id === 'coocaa' && (
            <button
              onClick={() => handlePress('eyecare', () => onTriggerSpecialMode('Coocaa Eye Care Mode (Low Blue Light) On!'))}
              className="px-2.5 py-1.5 rounded-xl bg-cyan-950/80 border border-cyan-600 text-cyan-300 text-[11px] font-bold flex items-center gap-1 active:scale-95"
            >
              <Eye className="w-3.5 h-3.5 text-cyan-400" />
              <span>Eye Care</span>
            </button>
          )}

          <div className="flex items-center gap-2">
            {/* Input / Source Button */}
            <button
              onClick={() => handlePress('input', onInputChange)}
              className="w-10 h-10 rounded-2xl bg-slate-950 border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center transition-all active:scale-90"
              title="Change Input (HDMI/AV)"
            >
              <Tv className="w-4 h-4" />
            </button>

            {/* Mute Button */}
            <button
              onClick={() => handlePress('mute', onMuteToggle)}
              className="w-10 h-10 rounded-2xl bg-slate-950 border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center transition-all active:scale-90"
              title="Mute Volume"
            >
              <VolumeX className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ----------------- MODE 1: D-PAD CONTROL ----------------- */}
        {remoteMode === 'dpad' && (
          <div className="space-y-4">
            {/* 5-WAY ERGONOMIC D-PAD DIRECTION WHEEL */}
            <div className="relative w-52 h-52 mx-auto rounded-full bg-slate-950 border-2 border-slate-800 shadow-2xl flex items-center justify-center">
              {/* UP */}
              <button
                onClick={() => handlePress('nav_up', () => onTriggerSpecialMode('Navigated Up'), 'nav')}
                className={`absolute top-2 w-14 h-12 flex items-center justify-center text-slate-300 hover:text-white transition-all ${
                  pressedBtn === 'nav_up' ? 'scale-90 text-indigo-400' : 'active:scale-95'
                }`}
                title="Up"
              >
                <ChevronUp className="w-8 h-8" />
              </button>

              {/* DOWN */}
              <button
                onClick={() => handlePress('nav_down', () => onTriggerSpecialMode('Navigated Down'), 'nav')}
                className={`absolute bottom-2 w-14 h-12 flex items-center justify-center text-slate-300 hover:text-white transition-all ${
                  pressedBtn === 'nav_down' ? 'scale-90 text-indigo-400' : 'active:scale-95'
                }`}
                title="Down"
              >
                <ChevronDown className="w-8 h-8" />
              </button>

              {/* LEFT */}
              <button
                onClick={() => handlePress('nav_left', () => onTriggerSpecialMode('Navigated Left'), 'nav')}
                className={`absolute left-2 w-12 h-14 flex items-center justify-center text-slate-300 hover:text-white transition-all ${
                  pressedBtn === 'nav_left' ? 'scale-90 text-indigo-400' : 'active:scale-95'
                }`}
                title="Left"
              >
                <ChevronLeft className="w-8 h-8" />
              </button>

              {/* RIGHT */}
              <button
                onClick={() => handlePress('nav_right', () => onTriggerSpecialMode('Navigated Right'), 'nav')}
                className={`absolute right-2 w-12 h-14 flex items-center justify-center text-slate-300 hover:text-white transition-all ${
                  pressedBtn === 'nav_right' ? 'scale-90 text-indigo-400' : 'active:scale-95'
                }`}
                title="Right"
              >
                <ChevronRight className="w-8 h-8" />
              </button>

              {/* CENTER OK / SELECT BUTTON */}
              <button
                onClick={() => handlePress('nav_ok', () => onTriggerSpecialMode('OK Pressed (Selected Item)'), 'nav')}
                className={`w-20 h-20 rounded-full bg-slate-900 border border-slate-700 flex flex-col items-center justify-center text-xs font-bold text-white shadow-inner hover:bg-slate-800 transition-all ${
                  pressedBtn === 'nav_ok' ? 'scale-90 ring-4 ring-indigo-500/50 bg-indigo-700' : 'active:scale-95'
                }`}
              >
                <span>OK</span>
              </button>
            </div>

            {/* Back, Home, Voice Assistant Row */}
            <div className="flex items-center justify-between px-4">
              {/* Back Button */}
              <button
                onClick={() => handlePress('back', () => onTriggerSpecialMode('Back button pressed'))}
                className="w-12 h-12 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-300 hover:text-white active:scale-90 transition-all shadow"
                title="Back"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>

              {/* Google Assistant Voice Mic */}
              <button
                onClick={() => handlePress('voice', () => onTriggerVoice())}
                className={`w-14 h-14 rounded-full flex items-center justify-center text-white transition-all shadow-lg ${
                  pressedBtn === 'voice'
                    ? 'scale-90 bg-indigo-700 ring-4 ring-indigo-500/50'
                    : 'bg-indigo-600 hover:bg-indigo-500 active:scale-95'
                }`}
                title="Google Assistant Voice Command"
              >
                <Mic className="w-6 h-6 text-white" />
              </button>

              {/* Android TV Home Button */}
              <button
                onClick={() => handlePress('home', () => onTriggerSpecialMode('Returned to Android TV Home'))}
                className="w-12 h-12 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-300 hover:text-white active:scale-90 transition-all shadow"
                title="Android TV Home"
              >
                <Home className="w-5 h-5" />
              </button>
            </div>

            {/* Tactile Volume and Channel Rocker Switches */}
            <div className="grid grid-cols-2 gap-4 px-3">
              {/* Volume Rocker */}
              <div className="bg-slate-950 border border-slate-800 rounded-3xl p-1.5 flex flex-col items-center shadow">
                <button
                  onClick={() => handlePress('vol_up', () => onVolumeChange(2))}
                  className="w-full py-3 rounded-2xl text-slate-300 hover:text-white hover:bg-slate-900 flex items-center justify-center active:scale-90 transition-all"
                  title="Volume Up (+)"
                >
                  <Volume2 className="w-5 h-5" />
                </button>
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 py-1 font-bold">
                  VOL
                </span>
                <button
                  onClick={() => handlePress('vol_down', () => onVolumeChange(-2))}
                  className="w-full py-3 rounded-2xl text-slate-300 hover:text-white hover:bg-slate-900 flex items-center justify-center active:scale-90 transition-all"
                  title="Volume Down (-)"
                >
                  <Volume1 className="w-5 h-5" />
                </button>
              </div>

              {/* Channel Rocker */}
              <div className="bg-slate-950 border border-slate-800 rounded-3xl p-1.5 flex flex-col items-center shadow">
                <button
                  onClick={() => handlePress('ch_up', () => onChannelChange(1))}
                  className="w-full py-3 rounded-2xl text-slate-300 hover:text-white hover:bg-slate-900 flex items-center justify-center active:scale-90 transition-all"
                  title="Channel Up (^)"
                >
                  <ChevronsUp className="w-5 h-5" />
                </button>
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 py-1 font-bold">
                  CH
                </span>
                <button
                  onClick={() => handlePress('ch_down', () => onChannelChange(-1))}
                  className="w-full py-3 rounded-2xl text-slate-300 hover:text-white hover:bg-slate-900 flex items-center justify-center active:scale-90 transition-all"
                  title="Channel Down (v)"
                >
                  <ChevronsDown className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Quick Indian & Global App Launch Row */}
            <div className="grid grid-cols-4 gap-1.5 px-2 pt-1">
              {STREAMING_APPS.slice(0, 4).map((app) => (
                <button
                  key={app.id}
                  onClick={() => handlePress(`app_${app.id}`, () => onLaunchApp(app))}
                  className="py-2 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-[10px] font-bold text-slate-200 flex flex-col items-center gap-1 active:scale-95 transition-all truncate"
                >
                  <div className={`w-3.5 h-3.5 rounded-full ${app.iconColor}`} />
                  <span className="truncate w-full text-center px-1">{app.name.split(' ')[0]}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ----------------- MODE 2: TOUCHPAD / TRACKPAD ----------------- */}
        {remoteMode === 'touchpad' && (
          <div className="space-y-4">
            <div
              ref={trackpadRef}
              onClick={handleTouchpadClick}
              onMouseDown={() => setIsDraggingTouchpad(true)}
              onMouseUp={() => setIsDraggingTouchpad(false)}
              onMouseMove={(e) => {
                if (isDraggingTouchpad) handleTrackpadMove(e.clientX, e.clientY);
              }}
              onTouchMove={(e) => {
                const touch = e.touches[0];
                handleTrackpadMove(touch.clientX, touch.clientY);
              }}
              className="relative w-full h-64 bg-slate-950 border-2 border-indigo-500/30 rounded-3xl cursor-crosshair overflow-hidden shadow-inner flex flex-col items-center justify-center"
            >
              {/* Center Finger Guidance Grid */}
              <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b15_1px,transparent_1px),linear-gradient(to_bottom,#1e293b15_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

              {/* Cursor Dot Simulation */}
              <div
                className="absolute w-6 h-6 rounded-full bg-indigo-500/80 border-2 border-white shadow-lg pointer-events-none -translate-x-1/2 -translate-y-1/2 transition-transform duration-75"
                style={{ left: `${touchpadPos.x}%`, top: `${touchpadPos.y}%` }}
              />

              <div className="z-10 text-center pointer-events-none text-slate-500 text-xs">
                <MousePointer className="w-6 h-6 mx-auto mb-1 text-indigo-400 opacity-60" />
                <p className="font-medium text-slate-400">Swipe finger to move TV pointer</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Tap anywhere to Select / OK</p>
              </div>

              {/* Right edge scroll bar indicator */}
              <div className="absolute right-1.5 inset-y-4 w-1 bg-slate-800 rounded-full">
                <div
                  className="w-full bg-indigo-400 rounded-full"
                  style={{ height: '30%', transform: `translateY(${touchpadPos.y * 1.5}%)` }}
                />
              </div>
            </div>

            {/* Quick Touchpad Action Bar */}
            <div className="flex items-center justify-between px-4">
              <button
                onClick={() => handlePress('back', () => onTriggerSpecialMode('Back button pressed'))}
                className="w-12 h-12 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-300 hover:text-white active:scale-90 transition-all"
                title="Back"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>

              <button
                onClick={() => handlePress('click_btn', handleTouchpadClick, 'nav')}
                className="flex-1 mx-3 h-12 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow flex items-center justify-center gap-1.5 active:scale-95 transition-all"
              >
                <span>Tap to Click</span>
              </button>

              <button
                onClick={() => handlePress('home', () => onTriggerSpecialMode('Returned to Android TV Home'))}
                className="w-12 h-12 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-300 hover:text-white active:scale-90 transition-all"
                title="Home"
              >
                <Home className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* ----------------- MODE 3: NUMPAD 0-9 DIRECT CHANNELS ----------------- */}
        {remoteMode === 'numpad' && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'PREV', 0, 'ENT'].map((item) => (
                <button
                  key={String(item)}
                  onClick={() => {
                    if (typeof item === 'number') {
                      handlePress(`num_${item}`, () => onDirectChannel(item), 'click');
                    } else if (item === 'PREV') {
                      handlePress('num_prev', () => onTriggerSpecialMode('Swapped to Previous Channel'), 'click');
                    } else {
                      handlePress('num_ent', () => onTriggerSpecialMode('Channel Confirmed'), 'nav');
                    }
                  }}
                  className="h-12 rounded-2xl bg-slate-950 border border-slate-800 text-sm font-bold text-slate-100 hover:bg-slate-800 hover:border-slate-700 active:scale-90 transition-all flex items-center justify-center shadow"
                >
                  {item}
                </button>
              ))}
            </div>

            {/* 4 Colored Keys (Red, Green, Yellow, Blue for Teletext / Indian Cable DTH) */}
            <div className="grid grid-cols-4 gap-2 pt-1">
              <button
                onClick={() => handlePress('red', () => onTriggerSpecialMode('Red Key (EPG Guide)'))}
                className="h-8 rounded-xl bg-red-600 hover:bg-red-500 text-white text-[10px] font-bold active:scale-95 transition-all shadow"
              >
                RED
              </button>
              <button
                onClick={() => handlePress('green', () => onTriggerSpecialMode('Green Key (Audio Language)'))}
                className="h-8 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold active:scale-95 transition-all shadow"
              >
                GREEN
              </button>
              <button
                onClick={() => handlePress('yellow', () => onTriggerSpecialMode('Yellow Key (Favorites)'))}
                className="h-8 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-[10px] font-bold active:scale-95 transition-all shadow"
              >
                YELLOW
              </button>
              <button
                onClick={() => handlePress('blue', () => onTriggerSpecialMode('Blue Key (Subtitles)'))}
                className="h-8 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold active:scale-95 transition-all shadow"
              >
                BLUE
              </button>
            </div>
          </div>
        )}

        {/* ----------------- MODE 4: STREAMING APPS GRID ----------------- */}
        {remoteMode === 'apps' && (
          <div className="space-y-3">
            <p className="text-[11px] text-slate-400 text-center">
              Tap any app to launch directly on your TV:
            </p>
            <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
              {STREAMING_APPS.map((app) => (
                <button
                  key={app.id}
                  onClick={() => handlePress(`launch_${app.id}`, () => onLaunchApp(app))}
                  className="p-3 rounded-2xl bg-slate-950 border border-slate-800 hover:border-indigo-500 hover:bg-slate-800/80 transition-all flex items-center gap-2.5 text-left active:scale-95 shadow"
                >
                  <div className={`w-8 h-8 rounded-xl ${app.iconColor} flex items-center justify-center text-white shrink-0 shadow`}>
                    <Tv className="w-4 h-4" />
                  </div>
                  <div className="overflow-hidden">
                    <span className="text-xs font-bold text-white block truncate">{app.name}</span>
                    <span className="text-[10px] text-slate-400 block truncate">{app.badge || app.category}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ----------------- MODE 5: MOBILE KEYBOARD TYPE-SYNC ----------------- */}
        {remoteMode === 'keyboard' && (
          <div className="space-y-4">
            <div className="bg-slate-950 p-4 rounded-3xl border border-slate-800 space-y-3">
              <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold">
                <KeyboardIcon className="w-4 h-4" />
                <span>Type on Phone &rarr; Send to TV Search</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Skip typing letter-by-letter on the TV screen. Type your movie, song, or actor name here:
              </p>

              <div className="relative">
                <input
                  type="text"
                  value={keyboardText}
                  onChange={(e) => setKeyboardText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && keyboardText) {
                      onSendTextToTv(keyboardText);
                      setKeyboardText('');
                    }
                  }}
                  placeholder="e.g. Hindi Retro Songs, Mirzapur, IPL..."
                  className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <button
                onClick={() => {
                  if (keyboardText) {
                    onSendTextToTv(keyboardText);
                    setKeyboardText('');
                  }
                }}
                disabled={!keyboardText}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow flex items-center justify-center gap-1.5 transition-all"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send to TV Search</span>
              </button>
            </div>

            {/* Quick Search Chips */}
            <div className="space-y-1.5">
              <span className="text-[11px] text-slate-400 block font-medium">Quick Suggestions:</span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  'Live Cricket Match',
                  'Latest Bollywood Movies',
                  'Arijit Singh Hits',
                  '4K Nature Documentary',
                ].map((sug) => (
                  <button
                    key={sug}
                    onClick={() => onSendTextToTv(sug)}
                    className="text-[10px] px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 hover:bg-slate-800 text-slate-300 transition-colors"
                  >
                    {sug}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Media Playback Controls Bar */}
        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-center gap-4 text-slate-400">
          <button
            onClick={() => handlePress('rewind', () => onTriggerSpecialMode('Replayed 10 seconds'))}
            className="w-9 h-9 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center active:scale-90 transition-all"
            title="Rewind 10s"
          >
            <SkipBack className="w-4 h-4" />
          </button>

          <button
            onClick={() => {
              setIsPlaying(!isPlaying);
              handlePress('play_pause', () => onTriggerSpecialMode(isPlaying ? 'Playback Paused' : 'Playback Playing'));
            }}
            className="w-11 h-11 rounded-2xl bg-slate-950 border border-slate-700 hover:bg-slate-800 text-white flex items-center justify-center active:scale-90 transition-all shadow"
            title="Play / Pause"
          >
            {isPlaying ? <Pause className="w-5 h-5 text-indigo-400" /> : <Play className="w-5 h-5 text-emerald-400" />}
          </button>

          <button
            onClick={() => handlePress('forward', () => onTriggerSpecialMode('Forwarded 10 seconds'))}
            className="w-9 h-9 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center active:scale-90 transition-all"
            title="Forward 10s"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
