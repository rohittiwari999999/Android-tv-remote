import React, { useState } from 'react';
import {
  X,
  Smartphone,
  Download,
  Copy,
  Check,
  ExternalLink,
  Terminal,
  Layers,
  Sparkles,
} from 'lucide-react';

interface InstallApkModalProps {
  isOpen: boolean;
  onClose: () => void;
  appUrl: string;
}

export const InstallApkModal: React.FC<InstallApkModalProps> = ({
  isOpen,
  onClose,
  appUrl,
}) => {
  const [activeTab, setActiveTab] = useState<'pwa' | 'pwabuilder' | 'github' | 'capacitor'>('pwa');
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedYaml, setCopiedYaml] = useState(false);
  const [copiedCapCmd, setCopiedCapCmd] = useState(false);

  if (!isOpen) return null;

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(appUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const githubWorkflowYaml = `name: Build Android APK and AAB

on:
  push:
    branches: [ main, master ]
  pull_request:
    branches: [ main, master ]
  workflow_dispatch:

jobs:
  build:
    name: Build Android APK & AAB
    runs-on: ubuntu-latest

    steps:
      - name: 1. Checkout Code
        uses: actions/checkout@v4

      - name: 2. Setup Node.js (v20)
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: 3. Install NPM Dependencies
        run: npm install --legacy-peer-deps

      - name: 4. Build Web Application
        run: npm run build

      - name: 5. Prepare Capacitor Android Project
        run: |
          npm install --legacy-peer-deps @capacitor/core @capacitor/cli @capacitor/android
          if [ ! -d "android" ]; then
            npx cap add android
          fi
          npx cap sync android

      - name: 6. Setup Java JDK 17
        uses: actions/setup-java@v4
        with:
          distribution: 'zulu'
          java-version: '17'

      - name: 7. Build Android APK
        run: |
          cd android
          chmod +x gradlew
          ./gradlew assembleDebug --no-daemon
          ./gradlew assembleRelease --no-daemon || true

      - name: 8. Build Android AAB (Google Play Store Bundle)
        run: |
          cd android
          ./gradlew bundleRelease --no-daemon || ./gradlew bundleDebug --no-daemon

      - name: 9. Upload APK Artifact
        uses: actions/upload-artifact@v4
        with:
          name: Universal-TV-Remote-APK
          path: android/app/build/outputs/apk/**/*.apk

      - name: 10. Upload AAB (Play Store) Artifact
        uses: actions/upload-artifact@v4
        with:
          name: Universal-TV-Remote-AAB
          path: android/app/build/outputs/bundle/**/*.aab
`;

  const capacitorCommands = `npm install @capacitor/core @capacitor/cli @capacitor/android
npm run build
npx cap init "TV Remote" com.androidtv.universalremote --web-dir dist
npx cap add android
npx cap open android`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Android APK &amp; Installation Guide</h2>
              <p className="text-xs text-slate-400">APK kaise banegi aur phone par direct kaise chalegi?</p>
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
        <div className="p-3 bg-slate-950/70 border-b border-slate-800 flex items-center gap-1.5 overflow-x-auto">
          <button
            onClick={() => setActiveTab('pwa')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              activeTab === 'pwa'
                ? 'bg-emerald-600 text-white shadow'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>1. Direct Phone Install (PWA)</span>
          </button>

          <button
            onClick={() => setActiveTab('pwabuilder')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              activeTab === 'pwabuilder'
                ? 'bg-indigo-600 text-white shadow'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>2. Free 1-Click APK (PWABuilder)</span>
          </button>

          <button
            onClick={() => setActiveTab('github')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              activeTab === 'github'
                ? 'bg-indigo-600 text-white shadow'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>3. GitHub Actions (Auto APK)</span>
          </button>

          <button
            onClick={() => setActiveTab('capacitor')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              activeTab === 'capacitor'
                ? 'bg-indigo-600 text-white shadow'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>4. Local Android Studio</span>
          </button>
        </div>

        {/* Tab 1: Direct Phone Install (PWA) */}
        {activeTab === 'pwa' && (
          <div className="p-6 overflow-y-auto space-y-4 flex-1">
            <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 space-y-2">
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider block">
                Sabse Aasaan Tareeqa (No APK Download Needed)
              </span>
              <h3 className="text-sm font-bold text-white">Direct Android Phone par App Install Karein</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Aapko koi bhi alag APK file install karne ki zaroorat nahi hai. Yeh app <strong>PWA (Progressive Web App)</strong> format me fully configured hai:
              </p>
            </div>

            <div className="space-y-3 text-xs text-slate-300">
              <div className="flex items-start gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                  1
                </span>
                <div>
                  <strong className="text-white block">Apne Android phone ke Chrome Browser me ye URL kholein:</strong>
                  <div className="flex items-center gap-2 mt-1.5">
                    <input
                      type="text"
                      readOnly
                      value={appUrl}
                      className="flex-1 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-[11px] font-mono text-emerald-400 truncate"
                    />
                    <button
                      onClick={handleCopyUrl}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium flex items-center gap-1 shrink-0"
                    >
                      {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedUrl ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                  2
                </span>
                <div>
                  <strong className="text-white block">Chrome ke top-right 3 dots (&vellip;) par tap karein:</strong>
                  <p className="text-slate-400 mt-0.5">
                    Menu me <strong>&ldquo;Install app&rdquo;</strong> ya <strong>&ldquo;Add to Home screen&rdquo;</strong> ka option dikhega.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                  3
                </span>
                <div>
                  <strong className="text-white block">&ldquo;Install&rdquo; par click karein:</strong>
                  <p className="text-slate-400 mt-0.5">
                    Yeh app aapke phone ke app drawer me as an Android app save ho jayegi (app icon ke saath, bina address bar ke full screen chalegi aur offline bhi load hogi!).
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: 1-Click Free APK via PWABuilder */}
        {activeTab === 'pwabuilder' && (
          <div className="p-6 overflow-y-auto space-y-4 flex-1">
            <div className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 space-y-1.5">
              <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider block">
                Microsoft Official Tool (100% Free &amp; Instant)
              </span>
              <h3 className="text-sm font-bold text-white">PWABuilder se 1-Click me .APK / .AAB File Generate Karein</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Agar aapko kisi ko WhatsApp par <strong>.apk</strong> file bhejni hai ya Google Play Store par daalni hai, toh PWABuilder best tareeqa hai:
              </p>
            </div>

            <ol className="space-y-3 text-xs text-slate-300 list-decimal list-inside">
              <li className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                Apne app ka URL copy karein:
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="text"
                    readOnly
                    value={appUrl}
                    className="flex-1 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-[11px] font-mono text-indigo-400 truncate"
                  />
                  <button
                    onClick={handleCopyUrl}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium flex items-center gap-1 shrink-0"
                  >
                    {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedUrl ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </li>

              <li className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                Browser me <a href="https://www.pwabuilder.com" target="_blank" rel="noreferrer" className="text-indigo-400 font-bold underline inline-flex items-center gap-1">PWABuilder.com <ExternalLink className="w-3 h-3" /></a> kholein.
              </li>

              <li className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                Apna URL paste karein aur <strong>&ldquo;Start&rdquo;</strong> button dabayein.
              </li>

              <li className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <strong>&ldquo;Package for Stores&rdquo; &rarr; &ldquo;Android&rdquo;</strong> select karein aur <strong>&ldquo;Generate APK&rdquo;</strong> par click karein! Ready <code>.apk</code> download ho jayegi.
              </li>
            </ol>
          </div>
        )}

        {/* Tab 3: GitHub Actions Auto APK Build */}
        {activeTab === 'github' && (
          <div className="p-6 overflow-y-auto space-y-4 flex-1">
            <div className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 space-y-1.5">
              <h3 className="text-sm font-bold text-white">GitHub Actions se Automatic APK aur AAB Build</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                GitHub ke free cloud runners se automatic APK (Direct Install) aur AAB (Play Store Bundle) banane ke liye yeh workflow file add kar di gayi hai:
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-mono text-[11px]">.github/workflows/build-android.yml</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(githubWorkflowYaml);
                    setCopiedYaml(true);
                    setTimeout(() => setCopiedYaml(false), 2000);
                  }}
                  className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200"
                >
                  {copiedYaml ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedYaml ? 'Copied YAML' : 'Copy Workflow'}</span>
                </button>
              </div>

              <pre className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 font-mono text-[11px] text-emerald-400 overflow-x-auto max-h-56 leading-relaxed">
                {githubWorkflowYaml}
              </pre>
            </div>

            <p className="text-xs text-slate-400">
              Jab bhi aap GitHub par code push/sync karenge, GitHub Actions automatically dono files build karega aur <strong>Actions &rarr; Artifacts</strong> me downloadable <code>Universal-TV-Remote-APK</code> aur <code>Universal-TV-Remote-AAB</code> de dega!
            </p>
          </div>
        )}

        {/* Tab 4: Local Android Studio Build */}
        {activeTab === 'capacitor' && (
          <div className="p-6 overflow-y-auto space-y-4 flex-1">
            <div className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 space-y-1.5">
              <h3 className="text-sm font-bold text-white">Apne Computer / Laptop par APK Banana</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Agar aapke PC me Android Studio installed hai, toh Capacitor ke zariye sirf 4 commands me native Android project generate kar sakte hain:
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-mono text-[11px]">Terminal Commands</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(capacitorCommands);
                    setCopiedCapCmd(true);
                    setTimeout(() => setCopiedCapCmd(false), 2000);
                  }}
                  className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200"
                >
                  {copiedCapCmd ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCapCmd ? 'Copied' : 'Copy Commands'}</span>
                </button>
              </div>

              <pre className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs text-indigo-300 overflow-x-auto leading-relaxed">
                {capacitorCommands}
              </pre>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Yeh commands chalate hi <strong>Android Studio</strong> open ho jayega. Wahan top menu me <strong>Build &gt; Build Bundle(s) / APK(s) &gt; Build APK(s)</strong> par click karein aur aapki APK ready ho jayegi!
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
