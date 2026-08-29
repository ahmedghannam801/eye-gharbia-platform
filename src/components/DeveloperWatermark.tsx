import React, { useState } from 'react';
import { Code2, Sparkles, Terminal, Heart, X, Cpu, Layers, ShieldCheck } from 'lucide-react';
import { useLanguage } from '../lib/LanguageContext';

interface DeveloperWatermarkProps {
  variant?: 'sidebar' | 'footer' | 'auth' | 'floating' | 'inline';
  isCollapsed?: boolean;
}

export const DeveloperWatermark: React.FC<DeveloperWatermarkProps> = ({ 
  variant = 'sidebar',
  isCollapsed = false 
}) => {
  const { language } = useLanguage();
  const ar = language === 'ar';
  const [showModal, setShowModal] = useState(false);

  // 1. Sidebar Variant (Clean, Transparent, Just Name)
  if (variant === 'sidebar') {
    if (isCollapsed) {
      return (
        <>
          <button
            onClick={() => setShowModal(true)}
            title="Ahmed Ebrahim"
            className="w-full flex items-center justify-center py-2 bg-transparent text-slate-400 hover:text-amber-500 transition-colors cursor-pointer"
          >
            <span className="text-[10px] font-black tracking-widest uppercase">AE</span>
          </button>
          {showModal && <DeveloperModal onClose={() => setShowModal(false)} ar={ar} />}
        </>
      );
    }

    return (
      <>
        <div className="mt-1 pt-1.5 border-t border-slate-100 dark:border-slate-800/40 text-center">
          <button
            onClick={() => setShowModal(true)}
            className="w-full py-1 px-2 bg-transparent text-center group cursor-pointer transition-opacity hover:opacity-100 opacity-75"
            title="Developed by Ahmed Ebrahim"
          >
            <p className="text-[11px] font-extrabold tracking-wide text-slate-500 dark:text-slate-400 group-hover:text-amber-500 dark:group-hover:text-amber-400 transition-colors inline-flex items-center gap-1.5 justify-center">
              <span>Ahmed Ebrahim</span>
              <span className="text-[9px] text-amber-500/70">⚡</span>
            </p>
          </button>
        </div>
        {showModal && <DeveloperModal onClose={() => setShowModal(false)} ar={ar} />}
      </>
    );
  }

  // 2. Auth / Login Variant (Transparent, Name Only)
  if (variant === 'auth') {
    return (
      <>
        <div className="text-center pt-3 pb-1 bg-transparent">
          <button
            onClick={() => setShowModal(true)}
            className="bg-transparent text-slate-400 dark:text-slate-400 hover:text-amber-500 dark:hover:text-amber-400 text-[11px] font-extrabold tracking-wider transition-colors cursor-pointer inline-flex items-center gap-1.5 opacity-80 hover:opacity-100"
          >
            <span>Ahmed Ebrahim</span>
            <span className="text-[9px] text-amber-500">⚡</span>
          </button>
        </div>
        {showModal && <DeveloperModal onClose={() => setShowModal(false)} ar={ar} />}
      </>
    );
  }

  // 3. Footer Variant (Transparent, Just the name)
  if (variant === 'footer') {
    return (
      <>
        <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-2 pt-3 border-t border-slate-200/50 dark:border-slate-800/50 text-[11px] text-slate-400 dark:text-slate-400 bg-transparent">
          <p className="font-medium text-center sm:text-start">
            &copy; {new Date().getFullYear()} {ar ? 'كيان EYE الغربية. جميع الحقوق محفوظة.' : 'EYE Gharbia. All rights reserved.'}
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="bg-transparent hover:text-amber-500 dark:hover:text-amber-400 font-extrabold text-slate-500 dark:text-slate-400 transition-colors cursor-pointer inline-flex items-center gap-1"
          >
            <span>Ahmed Ebrahim</span>
            <span className="text-[9px] text-amber-500">⚡</span>
          </button>
        </div>
        {showModal && <DeveloperModal onClose={() => setShowModal(false)} ar={ar} />}
      </>
    );
  }

  // 4. Floating / Corner Variant (Transparent, Pure Name)
  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="fixed bottom-3 start-4 z-40 hidden sm:flex items-center gap-1.5 bg-transparent text-slate-400/80 hover:text-amber-400 text-[11px] font-extrabold tracking-wider transition-all select-none cursor-pointer opacity-70 hover:opacity-100 hover:drop-shadow-md"
        title="Ahmed Ebrahim"
      >
        <span className="text-amber-500/80 text-[10px]">&lt;/&gt;</span>
        <span>Ahmed Ebrahim</span>
      </button>
      {showModal && <DeveloperModal onClose={() => setShowModal(false)} ar={ar} />}
    </>
  );
};

// Developer Info Tribute Modal
const DeveloperModal: React.FC<{ onClose: () => void; ar: boolean }> = ({ onClose, ar }) => {
  return (
    <div 
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 select-none animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-5 relative text-start overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 end-4 p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header Profile Badge */}
        <div className="flex items-center gap-3.5 pt-1">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 text-white flex items-center justify-center shadow-md shadow-amber-500/20 shrink-0 font-mono font-bold text-sm">
            AE
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white">Ahmed Ebrahim</h3>
            <p className="text-xs font-bold text-amber-600 dark:text-amber-400">
              {ar ? 'مطور ومهندس المنصة' : 'Software Engineer'}
            </p>
          </div>
        </div>

        {/* Message */}
        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
          {ar 
            ? 'تم تطوير وبرمجة المنصة الذكية لكيان EYE الغربية بأحدث التقنيات البرمجية لتنظيم وإدارة العمل المؤسسي.'
            : 'Engineered for EYE Gharbia using modern web technologies to empower youth workflow.'}
        </p>

        {/* Footer */}
        <div className="pt-2 flex items-center justify-between border-t border-slate-100 dark:border-slate-800 text-xs">
          <div className="flex items-center gap-1 text-slate-400 text-[11px] font-semibold">
            <Heart className="w-3 h-3 text-red-500 fill-red-500" />
            <span>EYE Gharbia</span>
          </div>
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-bold text-xs cursor-pointer"
          >
            {ar ? 'إغلاق' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
