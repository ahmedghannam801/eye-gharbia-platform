import React, { useState } from 'react';
import { Code2, Sparkles, Terminal, ShieldCheck, Heart, ExternalLink, X, Cpu, Layers } from 'lucide-react';
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

  // 1. Sidebar Variant (Inside Desktop & Mobile Sidebar)
  if (variant === 'sidebar') {
    if (isCollapsed) {
      return (
        <>
          <button
            onClick={() => setShowModal(true)}
            title="Developed by Ahmed Ebrahim"
            className="w-full flex items-center justify-center py-2.5 my-1 rounded-xl bg-slate-100/80 dark:bg-slate-800/80 hover:bg-amber-500/10 text-slate-500 dark:text-slate-400 hover:text-amber-500 border border-slate-200/60 dark:border-slate-700/60 transition-all group"
          >
            <Code2 className="w-4 h-4 text-amber-500 group-hover:scale-110 transition-transform" />
          </button>
          {showModal && <DeveloperModal onClose={() => setShowModal(false)} ar={ar} />}
        </>
      );
    }

    return (
      <>
        <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/70">
          <button
            onClick={() => setShowModal(true)}
            className="w-full text-start p-2.5 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900/90 dark:to-slate-800/80 border border-slate-200/70 dark:border-slate-700/50 hover:border-amber-500/50 dark:hover:border-amber-500/40 shadow-xs hover:shadow-md transition-all group relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-16 h-16 bg-amber-500/5 rounded-full blur-xl pointer-events-none group-hover:bg-amber-500/15 transition-all"></div>
            
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 text-white flex items-center justify-center shadow-xs shadow-amber-500/30 group-hover:scale-105 transition-transform shrink-0">
                <Code2 className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">
                    {ar ? 'تطوير وهندسة' : 'Engineered By'}
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                </div>
                <p className="text-xs font-black text-slate-800 dark:text-slate-100 group-hover:text-amber-500 dark:group-hover:text-amber-400 transition-colors truncate">
                  Ahmed Ebrahim
                </p>
              </div>
            </div>
            
            <div className="mt-1.5 pt-1.5 border-t border-slate-200/50 dark:border-slate-800/50 flex items-center justify-between text-[9px] text-slate-400 dark:text-slate-400 font-bold">
              <span>EYE Platform v2.5</span>
              <span className="text-amber-600 dark:text-amber-400 font-extrabold group-hover:underline">
                {ar ? 'تفاصيل المطور ✦' : 'Dev Info ✦'}
              </span>
            </div>
          </button>
        </div>
        {showModal && <DeveloperModal onClose={() => setShowModal(false)} ar={ar} />}
      </>
    );
  }

  // 2. Auth / Login Variant (Subtle & Elegant)
  if (variant === 'auth') {
    return (
      <>
        <div className="text-center pt-4 pb-2">
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-100/90 dark:bg-slate-800/90 hover:bg-amber-50 dark:hover:bg-amber-950/40 border border-slate-200/80 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 text-xs font-bold transition-all shadow-xs group"
          >
            <Code2 className="w-3.5 h-3.5 text-amber-500 group-hover:rotate-12 transition-transform" />
            <span>{ar ? 'تطوير وبرمجة:' : 'Engineered by:'}</span>
            <span className="font-extrabold text-slate-800 dark:text-slate-200 group-hover:text-amber-500 dark:group-hover:text-amber-400">
              Ahmed Ebrahim
            </span>
            <Sparkles className="w-3 h-3 text-amber-400 animate-pulse" />
          </button>
        </div>
        {showModal && <DeveloperModal onClose={() => setShowModal(false)} ar={ar} />}
      </>
    );
  }

  // 3. Footer Variant (For Landing Page & Workspace Views)
  if (variant === 'footer') {
    return (
      <>
        <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-200/60 dark:border-slate-800/60 text-xs text-slate-500 dark:text-slate-400">
          <p className="font-semibold text-center sm:text-start">
            &copy; {new Date().getFullYear()} {ar ? 'كيان EYE الغربية. جميع الحقوق محفوظة.' : 'EYE Gharbia Entity. All rights reserved.'}
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-amber-950/30 border border-slate-200 dark:border-slate-700/80 text-slate-600 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-400 font-bold transition-all group cursor-pointer"
          >
            <Code2 className="w-3.5 h-3.5 text-amber-500 group-hover:scale-110 transition-transform" />
            <span>{ar ? 'تصميم وتطوير المنصة:' : 'Designed & Developed by:'}</span>
            <span className="font-black text-slate-800 dark:text-white group-hover:text-amber-500 dark:group-hover:text-amber-400 underline decoration-amber-500/50 underline-offset-2">
              Ahmed Ebrahim
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 font-black">
              Lead Architect
            </span>
          </button>
        </div>
        {showModal && <DeveloperModal onClose={() => setShowModal(false)} ar={ar} />}
      </>
    );
  }

  // 4. Floating / Corner Variant
  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="fixed bottom-4 left-4 z-40 hidden sm:flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-slate-900/90 hover:bg-slate-900 text-white backdrop-blur-md border border-white/15 shadow-xl hover:border-amber-500/50 hover:shadow-amber-500/10 transition-all duration-300 group select-none cursor-pointer"
        title="Software Engineering & Development Credits"
      >
        <div className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-mono font-bold text-xs group-hover:bg-amber-500 group-hover:text-white transition-colors">
          &lt;/&gt;
        </div>
        <div className="text-start">
          <div className="text-[9px] text-slate-400 font-bold leading-none">{ar ? 'تطوير المنصة' : 'Engineered by'}</div>
          <div className="text-xs font-black text-amber-400 group-hover:text-amber-300 leading-tight">Ahmed Ebrahim</div>
        </div>
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ms-1"></span>
      </button>
      {showModal && <DeveloperModal onClose={() => setShowModal(false)} ar={ar} />}
    </>
  );
};

// Developer Info Tribute Modal
const DeveloperModal: React.FC<{ onClose: () => void; ar: boolean }> = ({ onClose, ar }) => {
  return (
    <div 
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 select-none animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl space-y-6 relative text-start overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow backdrop */}
        <div className="absolute -top-12 -right-12 w-40 h-40 bg-amber-500/15 rounded-full blur-2xl pointer-events-none"></div>
        <div className="absolute -bottom-12 -left-12 w-40 h-40 bg-blue-500/10 rounded-full blur-2xl pointer-events-none"></div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Profile Badge */}
        <div className="flex items-center gap-4 pt-2">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 via-amber-600 to-amber-700 text-white flex items-center justify-center shadow-lg shadow-amber-500/25 border-2 border-white/20 shrink-0">
            <Terminal className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-black text-slate-900 dark:text-white">Ahmed Ebrahim</h3>
              <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 font-extrabold text-[10px] border border-amber-500/20">
                PRO DEV
              </span>
            </div>
            <p className="text-xs font-bold text-amber-600 dark:text-amber-400 mt-0.5">
              {ar ? 'مهندس ومطور المنصة الذكية' : 'Lead Software Architect & Developer'}
            </p>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">
              Egyptian Youth Entity (EYE) • Gharbia
            </p>
          </div>
        </div>

        {/* Tribute Message */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 space-y-2">
          <div className="flex items-center gap-2 text-xs font-extrabold text-slate-800 dark:text-slate-200">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>{ar ? 'عن هندسة وتطوير المنصة' : 'About Platform Engineering'}</span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
            {ar 
              ? 'تم تصميم وتطوير هذه المنصة الرقمية المتكاملة لكيان EYE الغربية بأحدث المعايير البرمجية لتنظيم المهام، إدارة اللجان، وتقييم الأداء بالذكاء الاصطناعي.'
              : 'Designed and engineered as a comprehensive smart ecosystem for EYE Gharbia to streamline task management, committee performance, and AI-driven growth.'}
          </p>
        </div>

        {/* Tech Stack Pillars */}
        <div className="space-y-2">
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 block">
            {ar ? 'التقنيات المستخدمة' : 'Technology Stack'}
          </span>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-100/70 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 font-bold">
              <Cpu className="w-3.5 h-3.5 text-blue-500" />
              <span>React 19 & Vite</span>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-100/70 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 font-bold">
              <Layers className="w-3.5 h-3.5 text-emerald-500" />
              <span>Supabase Cloud</span>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-100/70 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 font-bold">
              <ShieldCheck className="w-3.5 h-3.5 text-purple-500" />
              <span>Tailwind & PWA</span>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-100/70 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 font-bold">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Ozzy AI Assistant</span>
            </div>
          </div>
        </div>

        {/* Footer Credit & Close */}
        <div className="pt-2 flex items-center justify-between border-t border-slate-100 dark:border-slate-800 text-xs">
          <div className="flex items-center gap-1.5 text-slate-400 font-semibold text-[11px]">
            <span>{ar ? 'صُنعت بحب' : 'Crafted with'}</span>
            <Heart className="w-3.5 h-3.5 text-red-500 fill-red-500 animate-pulse" />
            <span>{ar ? 'لشباب الغربية' : 'for Gharbia'}</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 font-bold text-xs transition-colors cursor-pointer"
          >
            {ar ? 'إغلاق' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
