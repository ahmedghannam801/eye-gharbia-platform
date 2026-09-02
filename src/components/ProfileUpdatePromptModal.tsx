import React, { useState, useEffect } from 'react';
import { UserProfile, COMMITTEE_STRUCTURE, HRM_SUB_COMMITTEES, UpdatableProfileField } from '../types';
import { db } from '../db/localDb';
import {
  User, Phone, Building2, Mail, Layers, CheckCircle2,
  AlertCircle, Sparkles, X, ShieldCheck, ArrowLeft, Send
} from 'lucide-react';
import { useLanguage } from '../lib/LanguageContext';

interface ProfileUpdatePromptModalProps {
  currentUser: UserProfile | null;
  onUpdated?: (updatedUser: UserProfile) => void;
}

const COMMITTEE_LABELS: Record<string, string> = {
  HR: 'الموارد البشرية (HR)',
  PR: 'العلاقات العامة (PR)',
  SM: 'السوشيال ميديا والتسويق (SM)',
  OR: 'التنظيم واللوجستيات (OR)',
};

const DEPARTMENT_LABELS: Record<string, string> = {
  HRM: 'إدارة الموارد البشرية (HRM)',
  HRD: 'التطوير والتدريب (HRD)',
  HRS: 'الدعم والمساندة (HRS)',
  HRIS: 'نظم المعلومات وإدارة البيانات (HRIS)',
  EPR: 'العلاقات العامة الخارجية (EPR)',
  IPR: 'العلاقات العامة الداخلية (IPR)',
  Content: 'كتابة وصناعة المحتوى (Content)',
  'Graphic Design': 'التصميم الجرافيكي (Graphic Design)',
  Photography: 'التصوير الفني والتوثيق (Photography)',
  'Video Editing': 'المونتاج وصناعة الفيديو (Video Editing)',
  VIP: 'إدارة كبار الشخصيات والبروتوكول (VIP)',
  Planning: 'التخطيط وإدارة الفعاليات (Planning)',
  Coordination: 'التنسيق والاتصال (Coordination)',
  Logistics: 'الدعم اللوجستي والميداني (Logistics)',
};

export const ProfileUpdatePromptModal: React.FC<ProfileUpdatePromptModalProps> = ({
  currentUser,
  onUpdated,
}) => {
  const { language, isRtl } = useLanguage();
  const ar = language === 'ar';

  const pending = currentUser?.pendingProfileUpdate;
  const [isDismissed, setIsDismissed] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [committee, setCommittee] = useState('HR');
  const [department, setDepartment] = useState('HRM');
  const [subCommittee, setSubCommittee] = useState('HR OF PR');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    if (!currentUser || !pending) return;

    setFullName(currentUser.fullName || '');
    setPhone(currentUser.phoneNumber && currentUser.phoneNumber !== '+201000000000' ? currentUser.phoneNumber : '');
    setEmail(currentUser.email || '');

    const comm = COMMITTEE_STRUCTURE[currentUser.committee] ? currentUser.committee : 'HR';
    setCommittee(comm);

    const depts = COMMITTEE_STRUCTURE[comm] || [];
    setDepartment(depts.includes(currentUser.department) ? currentUser.department : depts[0] || 'HRM');
    setSubCommittee(currentUser.subCommittee || 'HR OF PR');
  }, [currentUser, pending]);

  if (!currentUser || !pending || isDismissed) {
    return null;
  }

  const requestedFields = pending.requestedFields || [];

  const handleCommitteeChange = (newComm: string) => {
    setCommittee(newComm);
    const depts = COMMITTEE_STRUCTURE[newComm] || [];
    setDepartment(depts[0] || 'General');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    // Field-specific validation
    if (requestedFields.includes('fullName')) {
      const cleanName = fullName.trim();
      if (!cleanName || !cleanName.includes(' ') || /\d/.test(cleanName)) {
        setErrorMsg(ar ? 'يرجى كتابة الاسم الثلاثي أو الثنائي بشكل صحيح بدون أرقام.' : 'Please enter a valid full name without digits.');
        return;
      }
    }

    if (requestedFields.includes('phoneNumber')) {
      const cleanPhone = phone.trim();
      if (!cleanPhone || cleanPhone.length < 10) {
        setErrorMsg(ar ? 'يرجى كتابة رقم هاتف مصري صحيح يبدأ بـ 01 يتكون من 11 رقماً.' : 'Please enter a valid 11-digit phone number.');
        return;
      }
    }

    if (requestedFields.includes('email')) {
      const cleanEmail = email.trim();
      if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
        setErrorMsg(ar ? 'يرجى كتابة بريد إلكتروني صالح.' : 'Please enter a valid email address.');
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const updates: Partial<UserProfile> = {};
      if (requestedFields.includes('fullName')) updates.fullName = fullName.trim();
      if (requestedFields.includes('phoneNumber')) updates.phoneNumber = phone.trim();
      if (requestedFields.includes('email')) updates.email = email.trim();
      if (requestedFields.includes('committee')) updates.committee = committee;
      if (requestedFields.includes('department')) {
        updates.department = department;
        if (committee === 'HR' || department === 'HRM') {
          updates.subCommittee = subCommittee;
        }
      }

      db.submitProfileUpdate(currentUser.id, updates, pending.requestId);

      const refreshed = db.getUsers().find(u => u.id === currentUser.id) || {
        ...currentUser,
        ...updates,
      };

      if (onUpdated) {
        onUpdated(refreshed);
      }

      setIsDone(true);
      setTimeout(() => {
        setIsDismissed(true);
      }, 2000);
    } catch (err: any) {
      setErrorMsg(err?.message || (ar ? 'حدث خطأ أثناء حفظ البيانات' : 'Failed to save changes'));
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="bg-white dark:bg-slate-900 border-2 border-indigo-500/40 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-6 animate-scale-in relative my-auto">
        
        {/* Close / Dismiss button */}
        <button
          onClick={() => setIsDismissed(true)}
          className="absolute top-5 left-5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title={ar ? 'تذكيري لاحقاً' : 'Remind me later'}
        >
          <X className="w-5 h-5" />
        </button>

        {isDone ? (
          <div className="py-8 text-center space-y-3 animate-fade-in">
            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-md">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white">
              {ar ? 'تم حفظ وتأكيد بياناتك بنجاح! 🎉' : 'Profile Updated Successfully! 🎉'}
            </h3>
            <p className="text-xs text-slate-500 font-semibold">
              {ar ? 'شكرًا لتعاونك وسرعة استجابتك مع إدارة الكيان.' : 'Thank you for your prompt response.'}
            </p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-black text-xs uppercase tracking-widest">
                <Sparkles className="w-4 h-4" />
                <span>{ar ? 'طلب تحديث بيانات العضوية 📝' : 'Membership Data Update Request 📝'}</span>
              </div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white leading-snug">
                {ar ? 'يرجى مراجعة وتحديث بياناتك بالمنصة' : 'Please Review & Complete Your Information'}
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                {ar
                  ? `أرسلت لك الإدارة (${pending.requestedByName || 'الموارد البشرية'}) طلبًا لتحديث بعض بياناتك الرسمية لضمان دقة التواصل وسجلات الكيان.`
                  : `Administration (${pending.requestedByName || 'HR'}) requested you to update your profile fields.`}
              </p>

              {/* Admin Note if provided */}
              {pending.message && (
                <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 p-3 rounded-2xl text-xs text-amber-900 dark:text-amber-200 font-bold flex items-start gap-2 mt-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                  <div>
                    <span className="font-black text-amber-800 dark:text-amber-300 block mb-0.5">
                      {ar ? 'ملاحظة الإدارة:' : 'Admin Note:'}
                    </span>
                    <p className="text-[11px] font-medium leading-relaxed">{pending.message}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Error banner */}
            {errorMsg && (
              <div className="p-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-2xl text-xs font-bold text-red-600 dark:text-red-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Full Name Field */}
              {requestedFields.includes('fullName') && (
                <div className="space-y-1">
                  <label className="text-xs font-black text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                    <User className="w-4 h-4 text-indigo-500" />
                    <span>{ar ? 'الاسم الكامل الثلاثي *' : 'Full Name *'}</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder={ar ? 'مثال: أحمد محمد علي' : 'e.g. Ahmed Mohamed Ali'}
                    className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-2.5 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-indigo-600 transition-colors"
                  />
                </div>
              )}

              {/* Phone Number Field */}
              {requestedFields.includes('phoneNumber') && (
                <div className="space-y-1">
                  <label className="text-xs font-black text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                    <Phone className="w-4 h-4 text-indigo-500" />
                    <span>{ar ? 'رقم الهاتف / الواتساب *' : 'Phone / WhatsApp *'}</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="01XXXXXXXXX"
                    dir="ltr"
                    className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-2.5 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:border-indigo-600 transition-colors text-right sm:text-left"
                  />
                </div>
              )}

              {/* Email Address Field */}
              {requestedFields.includes('email') && (
                <div className="space-y-1">
                  <label className="text-xs font-black text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                    <Mail className="w-4 h-4 text-indigo-500" />
                    <span>{ar ? 'البريد الإلكتروني *' : 'Email Address *'}</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="user@example.com"
                    dir="ltr"
                    className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-2.5 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:border-indigo-600 transition-colors"
                  />
                </div>
              )}

              {/* Committee Field */}
              {requestedFields.includes('committee') && (
                <div className="space-y-1">
                  <label className="text-xs font-black text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-indigo-500" />
                    <span>{ar ? 'اللجنة التابع لها *' : 'Assigned Committee *'}</span>
                  </label>
                  <select
                    value={committee}
                    onChange={e => handleCommitteeChange(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-2.5 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-indigo-600 transition-colors"
                  >
                    {['HR', 'PR', 'SM', 'OR'].map(c => (
                      <option key={c} value={c}>
                        {COMMITTEE_LABELS[c] || c}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Sub-committee / Department Field */}
              {requestedFields.includes('department') && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-black text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-indigo-500" />
                      <span>{ar ? 'القسم / التخصص داخل اللجنة *' : 'Department / Specialization *'}</span>
                    </label>
                    <select
                      value={department}
                      onChange={e => setDepartment(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-2.5 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-indigo-600 transition-colors"
                    >
                      {(COMMITTEE_STRUCTURE[committee] || ['HRM', 'HRD', 'HRS', 'HRIS']).map(d => (
                        <option key={d} value={d}>
                          {DEPARTMENT_LABELS[d] || d}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Sub-committee for HRM specifically */}
                  {(committee === 'HR' || department === 'HRM') && (
                    <div className="space-y-1 bg-indigo-50/50 dark:bg-indigo-950/30 p-3 rounded-2xl border border-indigo-200/60 dark:border-indigo-800/40">
                      <label className="text-[11px] font-black text-indigo-900 dark:text-indigo-200 block mb-1">
                        {ar ? 'اللجنة الفرعية المسئول عنها (HRM Sub-committee):' : 'HRM Sub-committee:'}
                      </label>
                      <select
                        value={subCommittee}
                        onChange={e => setSubCommittee(e.target.value)}
                        className="w-full bg-white dark:bg-slate-800 border border-indigo-300 dark:border-indigo-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-indigo-600"
                      >
                        {HRM_SUB_COMMITTEES.map(sub => (
                          <option key={sub} value={sub}>
                            {sub}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsDismissed(true)}
                  className="flex-1 py-3 px-4 rounded-2xl border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  {ar ? 'تذكيري لاحقاً' : 'Later'}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-2 py-3 px-6 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs transition-all shadow-lg shadow-indigo-600/30 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  <span>{isSubmitting ? (ar ? 'جاري الحفظ...' : 'Saving...') : (ar ? 'تأكيد وحفظ البيانات ✅' : 'Save & Confirm ✅')}</span>
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
};
