import React, { useState, useEffect } from 'react';
import { db } from '../db/localDb';
import { Announcement, UserProfile, COMMITTEE_STRUCTURE, AnnouncementCategory } from '../types';
import { Megaphone, Pin, Plus, Trash2, Calendar, User, X, Sparkles, Rocket, ExternalLink, AlertTriangle, PartyPopper } from 'lucide-react';

interface AnnouncementsProps {
  currentUser: UserProfile;
  onNavigateToView?: (view: string, targetId?: string) => void;
}

const FEATURE_TARGET_OPTIONS = [
  { id: 'ideas', name: 'بنك الأفكار والمقترحات 💡 (Idea Bank)' },
  { id: 'career', name: 'بوصلة الشغف والمسار الوظيفي 🧭 (Career Compass)' },
  { id: 'certificates', name: 'منصة الشهادات الإلكترونية 🎓 (Certificate Generator)' },
  { id: 'work-plans', name: 'خطط العمل والأهداف OKRs 📊 (Work Plans)' },
  { id: 'academy', name: 'أكاديمية التدريب الداخلي 📚 (Internal Academy)' },
  { id: 'leaderboard', name: 'لوحة الصدارة والتميز 🏆 (Leaderboard)' },
  { id: 'templates', name: 'مركز النماذج والخطابات 📄 (Templates Hub)' },
  { id: 'trivia', name: 'الفوازير والمسابقات الأسبوعية 🧩 (Weekly Trivia)' },
  { id: 'rewards', name: 'متجر الجوائز والتحفيز 🎁 (Rewards Shop)' },
  { id: 'tasks', name: 'لوحة المهام والأرباح 📋 (Task Board)' },
  { id: 'chat', name: 'شات اللجان والفرق 💬 (Committee Chat)' },
];

export const Announcements: React.FC<AnnouncementsProps> = ({ currentUser, onNavigateToView }) => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newCommittee, setNewCommittee] = useState('All');
  const [newIsPinned, setNewIsPinned] = useState(false);
  const [newCategory, setNewCategory] = useState<AnnouncementCategory>('General');
  const [newTargetUrl, setNewTargetUrl] = useState('ideas');

  // AI Summary State
  const [summarizedAnnId, setSummarizedAnnId] = useState<string | null>(null);
  const [aiSummary, setAiSummary] = useState<string | null>(null);

  const handleAiSummarize = (ann: Announcement) => {
    if (summarizedAnnId === ann.id) {
      setSummarizedAnnId(null);
      setAiSummary(null);
      return;
    }

    const summary = `📌 **ملخص الإعلان التنفيذي (أوزي الذكي 🤖):**\n` +
      `1. **الموضوع الرئيسي:** ${ann.title}\n` +
      `2. **النوع والنطاق:** ${ann.category === 'New Feature' ? 'إطلاق ميزة جديدة 🚀' : 'إعلان تنفيذي'} - ${ann.committee === 'All' ? 'جميع الأعضاء' : `لجنة ${ann.committee}`}\n` +
      `3. **التوجيه المطلوب:** متابعة التفاصيل وتجربة الميزه المتاحة من ${ann.createdByName}.`;

    setSummarizedAnnId(ann.id);
    setAiSummary(summary);
  };

  const loadAnnouncements = () => {
    const list = db.getAnnouncements();
    if (currentUser.role === 'Member') {
      setAnnouncements(list.filter(a => a.committee === 'All' || a.committee === currentUser.committee));
    } else {
      setAnnouncements(list);
    }
  };

  useEffect(() => {
    loadAnnouncements();
  }, []);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle || !newContent) return;

    db.createAnnouncement(
      newTitle,
      newContent,
      newCommittee,
      currentUser,
      newIsPinned,
      newCategory,
      newCategory === 'New Feature' ? newTargetUrl : undefined
    );

    setShowCreateModal(false);
    setNewTitle('');
    setNewContent('');
    setNewCategory('General');
    loadAnnouncements();
  };

  const handleDelete = (id: string) => {
    if (confirm('هل أنت تأكد من حذف هذا الإعلان من جميع لوحات التحكم؟')) {
      db.deleteAnnouncement(id, currentUser);
      loadAnnouncements();
    }
  };

  const renderCategoryBadge = (cat?: AnnouncementCategory) => {
    switch (cat) {
      case 'New Feature':
        return (
          <span className="flex items-center gap-1 bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[10px] font-black px-2.5 py-0.5 rounded-full">
            <Rocket className="w-3 h-3 text-emerald-500" />
            إطلاق ميزة جديدة 🚀
          </span>
        );
      case 'Occasion':
        return (
          <span className="flex items-center gap-1 bg-amber-500/10 text-amber-600 border border-amber-500/20 text-[10px] font-black px-2.5 py-0.5 rounded-full">
            <PartyPopper className="w-3 h-3 text-amber-500" />
            تهنئة مناسبة 🎉
          </span>
        );
      case 'Urgent':
        return (
          <span className="flex items-center gap-1 bg-red-500/10 text-red-600 border border-red-500/20 text-[10px] font-black px-2.5 py-0.5 rounded-full">
            <AlertTriangle className="w-3 h-3 text-red-500" />
            تنبيه عاجل ⚠️
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full">
            إعلان عام 📢
          </span>
        );
    }
  };

  return (
    <div className="p-6 space-y-6" id="announcements-dashboard">
      
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm gap-4 relative overflow-hidden">
        <div className="space-y-1 flex-1">
          <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-amber-500 shrink-0" />
            <span>إعلانات الأمانة العامة وتحديثات الكيان</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">إشعارات التحديثات، إطلاق الميزات الجديدة، التنبيهات والقرارات الإدارية.</p>
        </div>

        {/* Ozy Announcements Mascot */}
        <div className="hidden md:block h-20 w-24 relative shrink-0">
          <img src="/mascot-announcements.png" alt="Ozy Announcements" className="h-24 object-contain absolute -bottom-5 right-0" />
        </div>

        {currentUser.role !== 'Member' && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm shrink-0"
            id="ann-publish-btn"
          >
            <Plus className="w-4 h-4" />
            <span>نشر إعلان / ميزة جديدة</span>
          </button>
        )}
      </div>

      {/* Announcements Listing Grid */}
      <div className="grid grid-cols-1 gap-4 max-h-[650px] overflow-y-auto pr-1">
        {(!announcements || announcements.length === 0) ? (
          <div className="text-center py-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl text-slate-400 dark:text-slate-500 text-xs flex flex-col items-center justify-center gap-3">
            <img src="/mascot-thinking.png" alt="Ozy thinking" className="h-28 object-contain" />
            <span className="font-bold text-slate-600 dark:text-slate-300">لا توجد إعلانات حالياً في نطاق لجنتك.</span>
          </div>
        ) : (
          (announcements || []).map((ann) => (
            <div
              key={ann.id}
              className={`p-6 rounded-3xl border transition-all ${
                ann.category === 'New Feature'
                  ? 'bg-emerald-50/70 dark:bg-slate-900 border-emerald-300 dark:border-emerald-500/40 shadow-md ring-1 ring-emerald-500/10'
                  : ann.isPinned
                  ? 'bg-amber-50/70 dark:bg-slate-900 border-amber-300 dark:border-amber-500/40 shadow-sm ring-1 ring-amber-500/10'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm'
              }`}
            >
              <div className="flex justify-between items-start gap-4 mb-3">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {renderCategoryBadge(ann.category)}
                    <span className="px-2.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-[10px] uppercase tracking-wider rounded-lg border border-slate-200 dark:border-slate-700">
                      النطاق: {ann.committee === 'All' ? 'جميع الأعضاء' : `لجنة ${ann.committee}`}
                    </span>
                    {ann.isPinned && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-amber-100/80 dark:bg-amber-950/50 px-2.5 py-0.5 rounded-lg border border-amber-300/60 dark:border-amber-800/60">
                        <Pin className="w-3 h-3 fill-amber-500" />
                        مثبّت
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white leading-snug flex items-center gap-2">
                    {ann.title}
                  </h3>
                </div>

                {currentUser.role !== 'Member' && (
                  <button
                    onClick={() => handleDelete(ann.id)}
                    className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-red-50 dark:hover:bg-red-950/40 text-slate-400 hover:text-red-500 transition-colors shadow-xs"
                    title="حذف الإعلان"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="text-xs text-slate-800 dark:text-slate-100 leading-relaxed bg-white/80 dark:bg-slate-800/90 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700 font-medium">
                {ann.content}
              </div>

              {/* Action Button for New Features */}
              {ann.category === 'New Feature' && ann.targetUrl && (
                <div className="mt-3.5">
                  <button
                    onClick={() => onNavigateToView?.(ann.targetUrl!)}
                    className="w-full md:w-auto bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs px-5 py-2.5 rounded-xl transition-all shadow-md shadow-emerald-500/20 flex items-center justify-center gap-2 group cursor-pointer"
                  >
                    <Rocket className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                    <span>🚀 تجربة الميزة الآن على المنصة!</span>
                    <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                  </button>
                </div>
              )}

              {/* AI Summary Box */}
              {summarizedAnnId === ann.id && aiSummary && (
                <div className="mt-3.5 p-3.5 bg-indigo-50/90 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 rounded-2xl text-xs text-indigo-950 dark:text-indigo-200 font-semibold space-y-1 animate-fade-in">
                  <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 font-black text-[11px]">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>ملخص أوزي الذكي (AI Summary 🤖):</span>
                  </div>
                  <p className="whitespace-pre-line leading-relaxed text-[11px]">{aiSummary}</p>
                </div>
              )}

              {/* Quick Reactions Bar */}
              <div className="mt-3.5 flex flex-wrap items-center gap-1.5 pt-3 border-t border-slate-200/60 dark:border-slate-800">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold me-1">تفاعل:</span>
                {['👍', '✅', '🔥', '❤️', '😮'].map((emoji) => {
                  const userList = ann.reactions?.[emoji] || [];
                  const hasReacted = userList.includes(currentUser.id);
                  const count = userList.length;

                  return (
                    <button
                      key={emoji}
                      onClick={() => {
                        db.toggleAnnouncementReaction(ann.id, emoji, currentUser);
                        loadAnnouncements();
                      }}
                      className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 border ${
                        hasReacted
                          ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/50 shadow-2xs scale-105'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200/70 dark:hover:bg-slate-700'
                      }`}
                      title={userList.length > 0 ? `تفاعل بواسطة ${count} أعضاء` : 'تفاعل'}
                    >
                      <span>{emoji}</span>
                      {count > 0 && <span className="text-[10px] font-mono font-extrabold">{count}</span>}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-between mt-3 border-t border-slate-200/60 dark:border-slate-800 pt-3">
                <div className="flex items-center gap-4 text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                  <span
                    className="flex items-center gap-1 cursor-pointer hover:text-amber-600 dark:hover:text-amber-400 hover:underline font-bold text-slate-700 dark:text-slate-300"
                    onClick={() => ann.createdBy && onNavigateToView?.('profile', ann.createdBy)}
                  >
                    <User className="w-3.5 h-3.5" />
                    {ann.createdByName}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {new Date(ann.createdDate).toLocaleDateString()}
                  </span>
                </div>

                <button
                  onClick={() => handleAiSummarize(ann)}
                  className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded-xl text-[10px] font-bold border border-indigo-200 dark:border-indigo-800 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Sparkles className="w-3 h-3 text-indigo-500" />
                  <span>{summarizedAnnId === ann.id ? 'إخفاء الملخص' : 'تلخيص الإعلان بالذكاء الاصطناعي 🤖'}</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ========================================== */}
      {/* MODAL: CREATE ANNOUNCEMENT / FEATURE RELEASE */}
      {/* ========================================== */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center px-4">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto text-slate-900 dark:text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Megaphone className="w-4.5 h-4.5 text-amber-500" />
                <span>نشر إعلان تنفيذي أو ميزة جديدة 🚀</span>
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">نوع الإعلان / التحديث</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as AnnouncementCategory)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 font-bold"
                >
                  <option value="General">📢 إعلان عام عادي</option>
                  <option value="New Feature">🚀 إطلاق ميزة جديدة (مع زر تجربة مباشر وإشعار فورى)</option>
                  <option value="Occasion">🎉 تهنئة مناسبة / عيد</option>
                  <option value="Urgent">⚠️ تنبيه عاجل هام جداً</option>
                </select>
              </div>

              {/* Feature URL selector if category is New Feature */}
              {newCategory === 'New Feature' && (
                <div className="space-y-1 bg-emerald-50 dark:bg-emerald-950/40 p-3 rounded-2xl border border-emerald-200 dark:border-emerald-800/60">
                  <label className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-widest flex items-center gap-1">
                    <Rocket className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    الميزة المستهدفة للتجربة المباشرة:
                  </label>
                  <select
                    value={newTargetUrl}
                    onChange={(e) => setNewTargetUrl(e.target.value)}
                    className="w-full bg-white dark:bg-slate-800 border border-emerald-300 dark:border-emerald-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold"
                  >
                    {FEATURE_TARGET_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-emerald-700 dark:text-emerald-400 mt-1">
                    سيتم إضافة زر "🚀 تجربة الميزة الآن" على الإعلان وينقل العضو تلقائياً لهذه الصفحة.
                  </p>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">عنوان الإعلان</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="مثال: تم إطلاق ميزة بوصلة المسار الوظيفي 🧭"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">تفاصيل الإعلان والتعليمات</label>
                <textarea
                  required
                  rows={4}
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="اكتب التوجيهات أو وصف الميزة الجديدة ودعوة الأعضاء لتجربتها..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">نطاق الاستهداف</label>
                  <select
                    value={newCommittee}
                    onChange={(e) => setNewCommittee(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 font-bold"
                  >
                    <option value="All">جميع الأعضاء واللجان (Global)</option>
                    {Object.keys(COMMITTEE_STRUCTURE).map(comm => (
                      <option key={comm} value={comm}>{comm === 'HR' ? 'لجنة الموارد البشرية (HRM)' : `لجنة ${comm}`}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2 pt-2 sm:pt-5">
                  <input
                    type="checkbox"
                    id="chk-pin-ann"
                    checked={newIsPinned}
                    onChange={(e) => setNewIsPinned(e.target.checked)}
                    className="rounded text-amber-500 bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 cursor-pointer"
                  />
                  <label htmlFor="chk-pin-ann" className="text-xs text-slate-700 dark:text-slate-300 font-semibold cursor-pointer">تثبيت الإعلان بأعلى الصفحة</label>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-5 py-2.5 rounded-xl text-xs shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Megaphone className="w-4 h-4" />
                  <span>نشر الإعلان وبث الإشعارات</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
