import React, { useState } from 'react';
import { X, Mic, Send } from 'lucide-react';

interface VoiceAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExecuteVoiceCommand: (query: string) => void;
  brandName: string;
}

export const VoiceAssistantModal: React.FC<VoiceAssistantModalProps> = ({
  isOpen,
  onClose,
  onExecuteVoiceCommand,
  brandName,
}) => {
  const [customVoiceInput, setCustomVoiceInput] = useState('');

  if (!isOpen) return null;

  const quickCommands = [
    'Open YouTube and play Hindi Retro Songs',
    'Launch JioCinema Live Cricket Match',
    'Open Netflix',
    'Set TV Volume to 40',
    'Mute TV Sound',
    'Switch TV input to HDMI 2',
    'Turn Off TV in 30 minutes',
  ];

  const handleSelectCommand = (cmd: string) => {
    onExecuteVoiceCommand(cmd);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col items-center text-center">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Animated Mic Sphere */}
        <div className="relative my-2">
          <div className="w-20 h-20 rounded-full bg-indigo-600/20 border-2 border-indigo-500/40 flex items-center justify-center animate-pulse">
            <div className="w-14 h-14 rounded-full bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/50">
              <Mic className="w-7 h-7" />
            </div>
          </div>
          {/* Animated Wave Rings */}
          <span className="absolute inset-0 rounded-full border border-indigo-400/40 animate-ping pointer-events-none" />
        </div>

        <h3 className="text-base font-bold text-white mt-2">Google Assistant for {brandName}</h3>
        <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed">
          Listening... Speak clearly or choose one of the smart voice commands below:
        </p>

        {/* Voice Audio Wave bars */}
        <div className="flex items-center gap-1.5 my-4 h-6">
          <span className="w-1 h-3 bg-red-400 rounded-full animate-bounce" />
          <span className="w-1 h-5 bg-yellow-400 rounded-full animate-bounce delay-75" />
          <span className="w-1 h-6 bg-green-400 rounded-full animate-bounce delay-150" />
          <span className="w-1 h-4 bg-blue-400 rounded-full animate-bounce delay-200" />
          <span className="w-1 h-5 bg-indigo-400 rounded-full animate-bounce delay-300" />
        </div>

        {/* Custom Input */}
        <div className="w-full relative mb-4">
          <input
            type="text"
            value={customVoiceInput}
            onChange={(e) => setCustomVoiceInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && customVoiceInput) {
                handleSelectCommand(customVoiceInput);
              }
            }}
            placeholder="Type voice command (e.g. Play Arijit Singh songs)..."
            className="w-full pl-3 pr-10 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
          <button
            onClick={() => {
              if (customVoiceInput) handleSelectCommand(customVoiceInput);
            }}
            disabled={!customVoiceInput}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Quick Voice Suggestions */}
        <div className="w-full space-y-1.5 text-left">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
            Suggested Voice Commands:
          </span>
          <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
            {quickCommands.map((cmd) => (
              <button
                key={cmd}
                onClick={() => handleSelectCommand(cmd)}
                className="w-full py-2 px-3 rounded-xl bg-slate-950/70 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 hover:text-white text-left transition-colors truncate"
              >
                &ldquo;{cmd}&rdquo;
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
