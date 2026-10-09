import React from 'react';
import { ALL_TV_BRANDS, type TVBrandInfo } from '../data/tvDatabase';
import { Globe, MapPin, Search } from 'lucide-react';

interface BrandQuickPickerProps {
  currentBrand: TVBrandInfo;
  onSelectBrand: (brand: TVBrandInfo) => void;
  onOpenFullModal: () => void;
}

export const BrandQuickPicker: React.FC<BrandQuickPickerProps> = ({
  currentBrand,
  onSelectBrand,
  onOpenFullModal,
}) => {
  // Top 10 Indian and Global popular brands
  const popularBrands = [
    'mi', 'oneplus', 'coocaa', 'samsung', 'lg', 'sony',
    'vu', 'realme', 'tcl_global', 'onida', 'thomson',
    'lloyd', 'bpl', 'micromax', 'google_tv', 'hisense'
  ];

  const quickList = popularBrands
    .map((id) => ALL_TV_BRANDS.find((b) => b.id === id))
    .filter(Boolean) as TVBrandInfo[];

  return (
    <div className="w-full bg-slate-900 border border-slate-800 rounded-3xl p-4 shadow-xl space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-1.5">
            <span>Universal TV Compatibility</span>
          </h3>
          <p className="text-xs text-slate-400">All India &amp; Worldwide Television Models Supported</p>
        </div>
        <button
          onClick={onOpenFullModal}
          className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 bg-indigo-500/10 hover:bg-indigo-500/20 px-3 py-1.5 rounded-xl border border-indigo-500/20 transition-colors"
        >
          <Search className="w-3.5 h-3.5" />
          <span>All 30+ Brands</span>
        </button>
      </div>

      {/* Horizontal Brand Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        {quickList.map((brand) => {
          const isSelected = brand.id === currentBrand.id;
          return (
            <button
              key={brand.id}
              onClick={() => onSelectBrand(brand)}
              className={`px-3 py-2 rounded-2xl whitespace-nowrap transition-all border flex items-center gap-1.5 ${
                isSelected
                  ? 'bg-indigo-600 border-indigo-500 text-white font-bold shadow-md ring-2 ring-indigo-400/30'
                  : 'bg-slate-950/80 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              {brand.region === 'India' ? (
                <MapPin className="w-3 h-3 text-orange-400 shrink-0" />
              ) : (
                <Globe className="w-3 h-3 text-blue-400 shrink-0" />
              )}
              <span>{brand.name.split('/')[0].split(' ')[0]}</span>
            </button>
          );
        })}
      </div>

      {/* Active Brand Specs Pill */}
      <div className="p-3 bg-slate-950/80 rounded-2xl border border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 text-slate-300">
          <span className="font-bold text-white">{currentBrand.name}</span>
          <span className="text-slate-500">·</span>
          <span className="text-slate-400">{currentBrand.operatingSystem}</span>
        </div>
        <div className="flex items-center gap-2 font-mono text-[11px] text-slate-400">
          <span>IR: {currentBrand.irModulation} ({currentBrand.carrierKhz}kHz)</span>
          <span>·</span>
          <span className="text-emerald-400">Codes Verified</span>
        </div>
      </div>
    </div>
  );
};
