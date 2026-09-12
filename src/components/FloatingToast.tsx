import React, { useState, useEffect, useRef } from 'react';
import { Check, AlertTriangle, Bell, X, ArrowLeft, ArrowRight, Sparkles } from 'lucide-react';
import { SystemNotification } from '../types';

interface FloatingToastProps {
  toast: SystemNotification;
  language: 'ar' | 'en';
  isRtl: boolean;
  onDismiss: (id: string) => void;
  onClick: (toast: SystemNotification) => void;
  duration?: number; // ms, default 3500ms
}

export const FloatingToast: React.FC<FloatingToastProps> = ({
  toast,
  language,
  isRtl,
  onDismiss,
  onClick,
  duration = 3500,
}) => {
  const [isExiting, setIsExiting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const remainingTimeRef = useRef(duration);
  const startTimeRef = useRef(Date.now());
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startTimer = () => {
    startTimeRef.current = Date.now();
    timerRef.current = setTimeout(() => {
      triggerDismiss();
    }, remainingTimeRef.current);
  };

  const clearCurrentTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => {
    startTimer();
    return () => {
      clearCurrentTimer();
    };
  }, []);

  const handleMouseEnter = () => {
    setIsPaused(true);
    clearCurrentTimer();
    const elapsed = Date.now() - startTimeRef.current;
    remainingTimeRef.current = Math.max(remainingTimeRef.current - elapsed, 1000);
  };

  const handleMouseLeave = () => {
    setIsPaused(false);
    startTimer();
  };

  const triggerDismiss = () => {
    if (isExiting) return;
    setIsExiting(true);
    clearCurrentTimer();
    setTimeout(() => {
      onDismiss(toast.id);
    }, 220);
  };

  // Type styling configuration
  const getTypeConfig = () => {
    switch (toast.type) {
      case 'success':
        return {
          borderAccent: 'border-s-4 border-s-emerald-500',
          iconBg: 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30',
          icon: <Check className="w-4 h-4 text-white stroke-[2.5]" />,
          badgeBg: 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-800',
          badgeText: language === 'ar' ? 'نجاح' : 'Success',
          progressBar: 'bg-emerald-500',
        };
      case 'warning':
        return {
          borderAccent: 'border-s-4 border-s-amber-500',
          iconBg: 'bg-amber-500 text-white shadow-md shadow-amber-500/30',
          icon: <AlertTriangle className="w-4 h-4 text-white stroke-[2.5]" />,
          badgeBg: 'bg-amber-50 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border-amber-200/80 dark:border-amber-800',
          badgeText: language === 'ar' ? 'تنبيه' : 'Warning',
          progressBar: 'bg-amber-500',
        };
      case 'error':
        return {
          borderAccent: 'border-s-4 border-s-rose-500',
          iconBg: 'bg-rose-500 text-white shadow-md shadow-rose-500/30',
          icon: <AlertTriangle className="w-4 h-4 text-white stroke-[2.5]" />,
          badgeBg: 'bg-rose-50 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 border-rose-200/80 dark:border-rose-800',
          badgeText: language === 'ar' ? 'هام جداً' : 'Urgent',
          progressBar: 'bg-rose-500',
        };
      default:
        return {
          borderAccent: 'border-s-4 border-s-blue-600',
          iconBg: 'bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/30',
          icon: <Bell className="w-4 h-4 text-white stroke-[2.5]" />,
          badgeBg: 'bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border-blue-200/80 dark:border-blue-800',
          badgeText: language === 'ar' ? 'إشعار جديد' : 'Notification',
          progressBar: 'bg-blue-600',
        };
    }
  };

  const config = getTypeConfig();

  // Simple translation helper for toast display
  const getLocalizedContent = () => {
    if (language !== 'ar') return { title: toast.title, message: toast.message };
    let t = toast.title;
    let m = toast.message;
    if (t === 'New Task Assigned') t = 'تم تعيين مهمة جديدة 📝';
    else if (t === 'New Task Published') t = 'تم نشر مهمة جديدة 📢';
    else if (t === 'New Announcement Published') t = 'تم نشر إعلان جديد 📢';
    else if (t === 'Task Submission Accepted!') t = 'تم قبول تسليم المهمة! 🎉';
    else if (t === 'Submission Reviewed') t = 'تمت مراجعة التسليم';
    else if (t === 'Submission Rejected') t = 'تم رفض تسليم المهمة ⚠️';
    else if (t === 'Resubmission Requested') t = 'مطلوب إعادة تسليم المهمة';
    else if (t === 'New Submission Received') t = 'تم استلام تسليم جديد 📥';
    else if (t === 'New Registration Request') t = 'طلب تسجيل جديد 👤';
    else if (t === 'Account Approved!') t = 'تم تفعيل الحساب بنجاح! ✨';
    else if (t === 'Account Status Changed') t = 'تغيرت حالة الحساب';
    else if (t === 'Congratulations! Promoted to Leader') t = 'تهانينا! تمت ترقيتك إلى قائد 👑';

    return { title: t, message: m };
  };

  const content = getLocalizedContent();

  const animationClass = isExiting
    ? isRtl
      ? 'animate-slide-out-left'
      : 'animate-slide-out-right'
    : isRtl
      ? 'animate-slide-in-left'
      : 'animate-slide-in-right';

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={() => onClick(toast)}
      dir={isRtl ? 'rtl' : 'ltr'}
      className={`pointer-events-auto w-full relative overflow-hidden bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-200 cursor-pointer group select-none ${config.borderAccent} ${animationClass}`}
      style={{
        boxShadow: '0 12px 30px -6px rgba(0, 0, 0, 0.18), 0 6px 12px -4px rgba(0, 0, 0, 0.08)',
      }}
    >
      <div className="p-3.5 sm:p-4 flex items-start gap-3">
        {/* Type Icon Badge */}
        <div className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${config.iconBg} transition-transform group-hover:scale-105`}>
          {config.icon}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className={`text-[10px] font-black px-2 py-0.5 rounded-md border tracking-wide uppercase ${config.badgeBg}`}>
              {config.badgeText}
            </span>
            <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 font-mono">
              {language === 'ar' ? 'الآن' : 'Now'}
            </span>
          </div>

          <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white mt-1 leading-tight line-clamp-1 group-hover:text-eye-brand dark:group-hover:text-emerald-400 transition-colors">
            {content.title}
          </h4>

          <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed line-clamp-2 font-medium">
            {content.message}
          </p>

          <div className="flex items-center gap-1 mt-2 text-[10px] font-bold text-slate-400 group-hover:text-eye-brand dark:group-hover:text-emerald-400 transition-colors">
            <span>{language === 'ar' ? 'انقر للانتقال' : 'Click to view'}</span>
            {isRtl ? <ArrowLeft className="w-3 h-3" /> : <ArrowRight className="w-3 h-3" />}
          </div>
        </div>

        {/* Dismiss Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            triggerDismiss();
          }}
          className="shrink-0 p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          title={language === 'ar' ? 'إغلاق الإشعار' : 'Dismiss'}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Countdown Progress Bar */}
      <div className="w-full h-1 bg-slate-100 dark:bg-slate-800/80 overflow-hidden">
        <div
          className={`h-full ${config.progressBar} animate-toast-progress`}
          style={{
            animationDuration: `${duration}ms`,
            animationPlayState: isPaused ? 'paused' : 'running',
          }}
        />
      </div>
    </div>
  );
};
