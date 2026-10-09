import React from 'react';
import { Volume2, VolumeX, Mic, CheckCircle2, Tv } from 'lucide-react';
import type { TVBrandInfo, StreamingApp } from '../data/tvDatabase';

export interface TVState {
  isPoweredOn: boolean;
  currentApp: StreamingApp | null;
  volume: number;
  isMuted: boolean;
  channel: number;
  channelName: string;
  activeInput: string;
  assistantActive: boolean;
  assistantQuery: string;
  osdMessage: string | null;
  selectedBrand: TVBrandInfo;
}

interface TVScreenPreviewProps {
  tvState: TVState;
  onPowerToggle: () => void;
}

export const TVScreenPreview: React.FC<TVScreenPreviewProps> = ({
  tvState,
  onPowerToggle,
}) => {
  return (
    <div className="flex flex-col items-center w-full">
      {/* TV Casing */}
      <div className="relative w-full max-w-xl aspect-video bg-black rounded-2xl border-[6px] border-slate-800 shadow-2xl overflow-hidden flex flex-col justify-between">
        {/* TV Screen Glass */}
        {tvState.isPoweredOn ? (
          <div className="relative w-full h-full bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/80 p-4 flex flex-col justify-between text-white select-none overflow-hidden">
            {/* Ambient TV Background Glow */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.15),_transparent_70%)] pointer-events-none" />

            {/* Top Bar of TV UI */}
            <div className="relative z-10 flex items-center justify-between text-xs text-slate-300">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-white tracking-wide text-xs">
                  {tvState.selectedBrand.name}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {tvState.selectedBrand.operatingSystem}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
                <span>{tvState.activeInput}</span>
                <span>·</span>
                <span>1080p 60Hz</span>
              </div>
            </div>

            {/* Main Center TV Content Area */}
            <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center my-2">
              {tvState.currentApp ? (
                <div className="space-y-2 animate-in fade-in zoom-in-95 duration-200">
                  <div className={`w-14 h-14 mx-auto rounded-2xl ${tvState.currentApp.iconColor} flex items-center justify-center shadow-lg shadow-black/40 ring-2 ring-white/20`}>
                    <Tv className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">{tvState.currentApp.name}</h3>
                    <p className="text-xs text-slate-400">Now Streaming · {tvState.selectedBrand.name} Smart TV</p>
                  </div>
                </div>
              ) : (
                /* Default Android TV / Google TV Home */
                <div className="space-y-3 w-full max-w-md">
                  <div className="flex items-center justify-center gap-2 text-slate-400 text-xs">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span>Android TV Home</span>
                    <span>·</span>
                    <span>Channel: {tvState.channel} ({tvState.channelName})</span>
                  </div>

                  {/* App Shortcut Rail Preview */}
                  <div className="flex items-center justify-center gap-2 py-1">
                    {['YouTube', 'Netflix', 'Hotstar', 'JioCinema', 'Prime'].map((app, i) => (
                      <div
                        key={app}
                        className={`px-2.5 py-1.5 rounded-lg text-[10px] font-medium border border-slate-700/60 ${
                          i === 0 ? 'bg-indigo-600/80 text-white ring-1 ring-indigo-400' : 'bg-slate-800/60 text-slate-300'
                        }`}
                      >
                        {app}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ON SCREEN DISPLAY (OSD) OVERLAYS */}

            {/* 1. Volume Bar HUD Overlay */}
            <div className="relative z-20 flex items-center justify-between bg-slate-900/90 backdrop-blur-md border border-slate-700/60 rounded-xl px-3 py-2 shadow-2xl">
              <div className="flex items-center gap-2 text-xs">
                {tvState.isMuted ? (
                  <VolumeX className="w-4 h-4 text-rose-400 animate-pulse" />
                ) : (
                  <Volume2 className="w-4 h-4 text-indigo-400" />
                )}
                <span className="font-mono text-xs font-semibold">
                  {tvState.isMuted ? 'MUTED' : `VOL: ${tvState.volume}`}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="flex-1 mx-3 h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                <div
                  className={`h-full transition-all duration-150 ${
                    tvState.isMuted ? 'bg-rose-500' : 'bg-indigo-500'
                  }`}
                  style={{ width: `${tvState.isMuted ? 0 : tvState.volume}%` }}
                />
              </div>

              <span className="text-[10px] font-mono text-slate-400">100 max</span>
            </div>

            {/* 2. Notification OSD Toast (Channel switch, Input change, Cricket Mode) */}
            {tvState.osdMessage && (
              <div className="absolute top-10 left-1/2 -translate-x-1/2 z-30 bg-indigo-950/95 border border-indigo-500/50 text-indigo-200 px-4 py-1.5 rounded-full text-xs font-medium shadow-xl flex items-center gap-2 animate-in slide-in-from-top-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>{tvState.osdMessage}</span>
              </div>
            )}

            {/* 3. Google Assistant Active Overlay */}
            {tvState.assistantActive && (
              <div className="absolute inset-x-4 bottom-14 z-30 bg-slate-900/95 border border-indigo-500 rounded-2xl p-3 shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-2">
                <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center animate-pulse">
                  <Mic className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1">
                  <span className="text-[11px] text-indigo-300 font-semibold block">Google Assistant</span>
                  <p className="text-xs text-white italic truncate">
                    {tvState.assistantQuery || 'Listening for TV command...'}
                  </p>
                </div>
                <div className="flex items-center gap-0.5">
                  <span className="w-1 h-3 bg-red-400 rounded-full animate-bounce" />
                  <span className="w-1 h-4 bg-yellow-400 rounded-full animate-bounce delay-75" />
                  <span className="w-1 h-5 bg-green-400 rounded-full animate-bounce delay-150" />
                  <span className="w-1 h-3 bg-blue-400 rounded-full animate-bounce delay-200" />
                </div>
              </div>
            )}
          </div>
        ) : (
          /* TV IS OFF (STANDBY SCREEN) */
          <div className="w-full h-full bg-slate-950 flex flex-col items-center justify-center text-slate-600 select-none">
            <Tv className="w-10 h-10 mb-2 opacity-30" />
            <span className="text-xs font-medium">TV Standby Mode</span>
            <span className="text-[10px] text-slate-700 mt-0.5">Press Power button on remote to turn on</span>
            <button
              onClick={onPowerToggle}
              className="mt-3 px-3 py-1 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg text-xs font-medium border border-slate-800 transition-colors"
            >
              Turn TV On
            </button>
          </div>
        )}

        {/* TV Bottom Bezel & Brand Logo */}
        <div className="h-4 bg-slate-900 flex items-center justify-center px-4">
          <span className="text-[9px] font-bold tracking-widest text-slate-400 uppercase">
            {tvState.selectedBrand.name.split(' ')[0]}
          </span>
          {/* Standby LED */}
          <div
            className={`absolute bottom-0.5 right-4 w-1.5 h-1.5 rounded-full transition-colors ${
              tvState.isPoweredOn ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]' : 'bg-red-500 shadow-[0_0_4px_rgba(239,68,68,0.8)]'
            }`}
          />
        </div>
      </div>

      {/* TV Legs Stand Stand */}
      <div className="w-32 h-1.5 bg-slate-800 rounded-b-md shadow-md mx-auto" />
    </div>
  );
};
