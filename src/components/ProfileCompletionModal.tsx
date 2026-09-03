import React, { useState, useEffect } from 'react';
import { UserProfile, getActiveGovernorate, formatGovernorateWelcomeAr, COMMITTEE_STRUCTURE } from '../types';
import { db } from '../db/localDb';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { User, Phone, Briefcase, Building2, CheckCircle2, AlertTriangle, Loader2, Sparkles, ShieldCheck, X } from 'lucide-react';

interface Props {
  currentUser: UserProfile | null;
  onComplete: (updated: UserProfile) => void;
}

const COMMITTEE_LABELS: Record<string, string> = {
  HR: '👥 لجنة الموارد البشرية (HR)',
  PR: '🤝 لجنة العلاقات العامة (PR)',
  SM: '📱 لجنة السوشيال ميديا والتسويق (SM)',
  OR: '🎪 لجنة التنظيم واللوجستيات (OR)',
};

const DEPARTMENT_LABELS: Record<string, string> = {
  // HR Departments
  'HRM': 'إدارة الموارد البشرية (HRM)',
  'HRD': 'التطوير والتدريب (HRD)',
  'HRS': 'الدعم والمساندة (HRS)',
  'HRIS': 'نظم المعلومات وإدارة البيانات (HRIS)',
  // PR Departments
  'EPR': 'العلاقات العامة الخارجية (EPR)',
  'IPR': 'العلاقات العامة الداخلية (IPR)',
  // SM Departments
  'Content': 'كتابة وصناعة المحتوى (Content)',
  'Graphic Design': 'التصميم الجرافيكي والبصري (Graphic Design)',
  'Photography': 'التصوير الفني والتوثيق (Photography)',
  'Video Editing': 'المونتاج وصناعة الفيديو (Video Editing)',
  // OR Departments
  'VIP': 'إدارة كبار الشخصيات والبروتوكول (VIP)',
  'Planning': 'التخطيط وإدارة الفعاليات (Planning)',
  'Coordination': 'التنسيق والاتصال (Coordination)',
  'Logistics': 'الدعم اللوجستي والميداني (Logistics)',
};

const HRM_SUBS = ['HR OF PR', 'HR OF SM', 'HR OF OR', 'HR OF HR', 'HRM General'];
const COMMITTEES = ['HR', 'PR', 'SM', 'OR'];
const DEPARTMENTS = COMMITTEE_STRUCTURE;

const STORAGE_KEY = 'eye_profile_completed_v3';

/** Returns true if the profile is missing critical fields or has legacy generic values (Members only) */
export function isProfileIncomplete(user: UserProfile): boolean {
  // Leaders and executive roles are strictly exempt from profile completion prompts
  if (!user || user.role !== 'Member') return false;

  // 1. Name Check: Must have at least two parts and no digits
  const trimmedName = (user.fullName || '').trim();
  const nameBad = !trimmedName || !trimmedName.includes(' ') || /\d/.test(trimmedName);

  // 2. Phone Check: Must not be placeholder or empty
  const phone = (user.phoneNumber || '').trim();
  const phoneBad = !phone || phone === '+201000000000' || phone.length < 8;

  // 3. Committee Check: Must be one of the official 4 committees
  const comm = user.committee || '';
  const committeeBad = !comm || comm === 'None' || comm === 'General' || !COMMITTEES.includes(comm);

  // 4. Department Check: Must be valid
  const validDepts = DEPARTMENTS[comm] || [];
  const dept = (user.department || '').trim();
  const deptBad = !dept || dept === 'None' || dept === 'Events';

  return nameBad || phoneBad || committeeBad || deptBad;
}

export const ProfileCompletionModal: React.FC<Props> = ({ currentUser, onComplete }) => {
  const [visible, setVisible] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [committee, setCommittee] = useState('HR');
  const [department, setDepartment] = useState('HRM');
  const [subBranch, setSubBranch] = useState('HR OF PR');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!currentUser) return;

    // Check if profile needs completion (members only)
    if (isProfileIncomplete(currentUser)) {
      const key = `${STORAGE_KEY}_${currentUser.id}`;
      const alreadyDone = localStorage.getItem(key);
      if (alreadyDone) return;

      const sessionDismissed = sessionStorage.getItem(`eye_profile_dismissed_session_${currentUser.id}`);
      if (sessionDismissed) return;

      const defaultComm = COMMITTEES.includes(currentUser.committee) ? currentUser.committee : 'HR';
      const availableDepts = DEPARTMENTS[defaultComm] || [];
      const defaultDept = availableDepts.includes(currentUser.department)
        ? currentUser.department
        : availableDepts[0] || 'HRM';

      setFullName(currentUser.fullName && currentUser.fullName.includes(' ') ? currentUser.fullName : '');
      setPhone(currentUser.phoneNumber && currentUser.phoneNumber !== '+201000000000' ? currentUser.phoneNumber : '');
      setCommittee(defaultComm);
      setDepartment(defaultDept);
      setVisible(true);
    }
  }, [currentUser]);

  // Sync department when committee changes
  const handleCommitteeChange = (newComm: string) => {
    setCommittee(newComm);
    const available = DEPARTMENTS[newComm] || [];
    setDepartment(available[0] || '');
  };

  const handleSave = async () => {
    if (!currentUser) return;

    const cleanName = fullName.trim();
    if (!cleanName || !cleanName.includes(' ') || cleanName.split(' ').length < 2) {
      setError('يرجى كتابة اسمك الثلاثي أو الثنائي بالكامل (الاسم الأول واسم العائلة).');
      return;
    }

    const cleanPhone = phone.trim();
    if (!cleanPhone || cleanPhone.length < 8) {
      setError('يرجى إدخال رقم هاتف صحيح للتواصل والمتابعة.');
      return;
    }

    if (!committee || !COMMITTEES.includes(committee)) {
      setError('يرجى اختيار لجنتك الرسمية.');
      return;
    }

    const validDepts = DEPARTMENTS[committee] || [];
    if (!department || !validDepts.includes(department)) {
      setError('يرجى اختيار القسم أو الفرع التابع له.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const effectiveDepartment = (committee === 'HR' && department === 'HRM' && subBranch)
        ? subBranch
        : department;

      const updates = {
        full_name: cleanName,
        phone_number: cleanPhone,
        committee,
        department: effectiveDepartment,
        status: 'Active' as const,
      };

      // 1. Update Supabase if connected
      if (isSupabaseConfigured && supabase && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(currentUser.id)) {
        await supabase
          .from('profiles')
          .update(updates)
          .eq('id', currentUser.id);
      }

      // 2. Update local DB cache
      await db.updateProfile(currentUser.id, {
        fullName: cleanName,
        phoneNumber: cleanPhone,
        committee,
        department: effectiveDepartment,
        status: 'Active',
      }, currentUser);

      // 3. Mark completed
      localStorage.setItem(`${STORAGE_KEY}_${currentUser.id}`, '1');
      setDone(true);

      setTimeout(() => {
        setVisible(false);
        onComplete({
          ...currentUser,
          fullName: cleanName,
          phoneNumber: cleanPhone,
          committee,
          department: effectiveDepartment,
          status: 'Active',
        });
      }, 1500);
    } catch (e: any) {
      setError(e?.message || 'تعذر حفظ البيانات، يرجى المحاولة مرة أخرى.');
    } finally {
      setSaving(false);
    }
  };

  if (!visible) return null;

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 overflow-y-auto" 
      style={{ backdropFilter: 'blur(12px)', backgroundColor: 'rgba(5, 11, 26, 0.85)' }}
    >
      <div 
        className="relative w-full max-w-lg max-h-[90vh] flex flex-col rounded-3xl overflow-hidden shadow-2xl border border-slate-800 animate-fade-in my-auto" 
        style={{ backgroundColor: '#0f172a', color: '#ffffff' }}
        dir="rtl"
      >
        {/* Close / Dismiss Button */}
        <button
          type="button"
          onClick={() => {
            setVisible(false);
            if (currentUser) {
              sessionStorage.setItem(`eye_profile_dismissed_session_${currentUser.id}`, '1');
            }
          }}
          className="absolute top-4 left-4 z-20 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          title="تذكيري لاحقاً"
          aria-label="إغلاق وتذكيري لاحقاً"
        >
          <X size={20} />
        </button>

        {/* Glowing top header gradient */}
        <div className="h-2 bg-gradient-to-r from-blue-600 via-indigo-500 to-amber-400 shrink-0" />

        {/* Modal Header */}
        <div className="px-6 pt-6 pb-3 text-center shrink-0">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-3 bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-lg shadow-blue-600/40">
            <Sparkles size={28} />
          </div>
          <h2 className="text-xl font-black text-white" style={{ color: '#ffffff' }}>
            تحديث واستكمال البيانات الرسمية
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto" style={{ color: '#94a3b8' }}>
            يرجى تحديد اسمك الكامل ولجنتك وقسمك لضبط مهامك وصلاحياتك بدقة
          </p>
        </div>

        {/* Done / Success State */}
        {done ? (
          <div className="px-6 py-8 flex flex-col items-center gap-3 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 animate-bounce">
              <CheckCircle2 size={36} />
            </div>
            <p className="text-lg font-black text-white" style={{ color: '#ffffff' }}>
              تم حفظ وتحديث بياناتك بنجاح! 🎉
            </p>
            <p className="text-slate-400 text-xs" style={{ color: '#94a3b8' }}>
              مرحباً بك في منصة EYE {formatGovernorateWelcomeAr(getActiveGovernorate(currentUser))}
            </p>
          </div>
        ) : (
          <div className="px-6 pb-6 flex flex-col gap-4 overflow-y-auto max-h-[calc(90vh-140px)]">
            {/* 1. Full Name */}
            <div>
              <label className="block text-xs font-black text-slate-200 mb-1.5 flex items-center gap-1.5" style={{ color: '#e2e8f0' }}>
                <User size={14} className="text-blue-400" />
                <span>الاسم بالكامل (ثنائي أو ثلاثي) *</span>
              </label>
              <input
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="مثال: أحمد محمد مصطفى"
                dir="rtl"
                className="w-full px-4 py-3 rounded-xl text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder-slate-500"
                style={{ backgroundColor: '#1e293b', border: '1px solid #334155', color: '#ffffff' }}
              />
            </div>

            {/* 2. Phone Number */}
            <div>
              <label className="block text-xs font-black text-slate-200 mb-1.5 flex items-center gap-1.5" style={{ color: '#e2e8f0' }}>
                <Phone size={14} className="text-blue-400" />
                <span>رقم الهاتف / الواتساب *</span>
              </label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="01XXXXXXXXX"
                dir="ltr"
                className="w-full px-4 py-3 rounded-xl text-sm font-mono font-semibold text-white text-end focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder-slate-500"
                style={{ backgroundColor: '#1e293b', border: '1px solid #334155', color: '#ffffff' }}
              />
            </div>

            {/* 3. Official Committee */}
            <div>
              <label className="block text-xs font-black text-slate-200 mb-1.5 flex items-center gap-1.5" style={{ color: '#e2e8f0' }}>
                <Briefcase size={14} className="text-blue-400" />
                <span>اللجنة التابع لها *</span>
              </label>
              <select
                value={committee}
                onChange={e => handleCommitteeChange(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer"
                style={{ backgroundColor: '#1e293b', border: '1px solid #334155', color: '#ffffff' }}
              >
                {COMMITTEES.map(c => (
                  <option key={c} value={c} style={{ backgroundColor: '#1e293b', color: '#ffffff' }}>
                    {COMMITTEE_LABELS[c] || c}
                  </option>
                ))}
              </select>
            </div>

            {/* 4. Department / Sub-group */}
            <div>
              <label className="block text-xs font-black text-slate-200 mb-1.5 flex items-center gap-1.5" style={{ color: '#e2e8f0' }}>
                <Building2 size={14} className="text-blue-400" />
                <span>القسم / الفرع التابع له داخل اللجنة *</span>
              </label>
              <select
                value={department}
                onChange={e => {
                  setDepartment(e.target.value);
                  if (e.target.value === 'HRM') setSubBranch('HR OF PR');
                }}
                className="w-full px-4 py-3 rounded-xl text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer"
                style={{ backgroundColor: '#1e293b', border: '1px solid #334155', color: '#ffffff' }}
              >
                {(DEPARTMENTS[committee] || []).map(d => (
                  <option key={d} value={d} style={{ backgroundColor: '#1e293b', color: '#ffffff' }}>
                    {DEPARTMENT_LABELS[d] || d}
                  </option>
                ))}
              </select>
            </div>

            {/* 5. HRM Sub-Branch (when HR committee and HRM department are chosen) */}
            {committee === 'HR' && department === 'HRM' && (
              <div className="p-3.5 rounded-xl bg-blue-950/40 border border-blue-800/60 animate-fadeIn space-y-1.5">
                <label className="block text-xs font-black text-blue-300">
                  <span>فرع أو تكليف الموارد البشرية لـ HRM *</span>
                </label>
                <select
                  value={subBranch}
                  onChange={e => setSubBranch(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  style={{ backgroundColor: '#1e293b', border: '1px solid #334155', color: '#ffffff' }}
                >
                  {HRM_SUBS.map(s => (
                    <option key={s} value={s} style={{ backgroundColor: '#1e293b', color: '#ffffff' }}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-xl text-xs font-bold text-red-300 bg-red-950/60 border border-red-800">
                <AlertTriangle size={16} className="shrink-0 text-red-400" />
                <span>{error}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-2 mt-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="w-full py-3.5 rounded-xl font-black text-white text-sm flex items-center justify-center gap-2 transition-all bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-500 shadow-lg shadow-blue-600/30 cursor-pointer disabled:opacity-50 active:scale-98"
              >
                {saving ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                <span>{saving ? 'جاري حفظ وتحديث البيانات...' : 'حفظ وتأكيد البيانات 🚀'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setVisible(false);
                  if (currentUser) {
                    sessionStorage.setItem(`eye_profile_dismissed_session_${currentUser.id}`, '1');
                  }
                }}
                className="w-full py-2.5 rounded-xl font-bold text-slate-400 hover:text-white text-xs flex items-center justify-center transition-colors bg-slate-800/60 hover:bg-slate-800 cursor-pointer"
              >
                تذكيري لاحقاً وتخطي الآن
              </button>
            </div>

            <div className="flex items-center justify-center gap-1.5 text-center text-[11px] text-slate-400 pt-1" style={{ color: '#94a3b8' }}>
              <ShieldCheck size={14} className="text-emerald-400" />
              <span>يتم حفظ بياناتك وتحديث ملفك الشخصي فورياً في قاعدة البيانات</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
