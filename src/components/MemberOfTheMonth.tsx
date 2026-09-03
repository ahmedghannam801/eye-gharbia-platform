import React, { useState, useMemo, useEffect } from 'react';
import { UserProfile } from '../types';
import { db, calculateMemberAVG } from '../db/localDb';
import { useLanguage } from '../lib/LanguageContext';
import { Trophy, Star, CheckCircle2, Flame, Crown, X, ShieldCheck, AlertCircle, Sparkles, Send, RotateCcw, UserCheck } from 'lucide-react';

interface MemberOfTheMonthProps {
  currentUser: UserProfile;
  forceShow?: boolean;
}

export const MemberOfTheMonth: React.FC<MemberOfTheMonthProps> = ({ currentUser, forceShow = false }) => {
  const { language, isRtl, translateCommittee } = useLanguage();
  const isAr = language === 'ar';

  const isSuperAdmin = currentUser.role === 'Super Admin' || currentUser.email === 'ahmedghannam801@gmail.com';

  const today = new Date();
  const monthKey = `${today.getFullYear()}_${today.getMonth() + 1}`;
  const monthNamesAr = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  const monthNamesEn = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const monthLabel = isAr ? `${monthNamesAr[today.getMonth()]} ${today.getFullYear()}` : `${monthNamesEn[today.getMonth()]} ${today.getFullYear()}`;

  const dismissKey = `eye_motm_dismissed_${monthKey}_${currentUser.id}`;
  const [isDismissed, setIsDismissed] = useState(() => {
    return localStorage.getItem(dismissKey) === 'true';
  });

  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Check announcements & localStorage for official Super Admin approval
  const motmAnnouncement = useMemo(() => {
    const allAnnouncements = db.getAnnouncements();
    return allAnnouncements.find(a => 
      (a.targetUrl === `motm:${monthKey}` || a.title.includes('[عضو الشهر المعتمد]')) &&
      a.content.includes(monthKey)
    );
  }, [monthKey, refreshTrigger]);

  const approvalData = useMemo(() => {
    if (motmAnnouncement) {
      try {
        const parsed = JSON.parse(motmAnnouncement.content);
        if (parsed && parsed.approved) return parsed;
      } catch {}
    }
    try {
      const raw = localStorage.getItem(`eye_motm_approval_${monthKey}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.approved) return parsed;
      }
    } catch {}
    return null;
  }, [motmAnnouncement, monthKey, refreshTrigger]);

  const isApproved = !!approvalData?.approved;

  // Compute candidates and top performers ONLY when Super Admin is reviewing approval
  const userGov = currentUser.governorate || 'الغربية';
  const govUsers = useMemo(() => {
    if (!isSuperAdmin) return [];
    return db.getUsers().filter(u => u.status === 'Active' && u.role === 'Member' && (u.governorate === userGov || !u.governorate));
  }, [userGov, refreshTrigger, isSuperAdmin]);

  const rankedMembers = useMemo(() => {
    if (!isSuperAdmin || govUsers.length === 0) return [];
    const meetings = db.getMeetings();
    const attendance = db.getAllAttendance();
    const tasks = db.getTasks();
    const submissions = db.getSubmissions();
    const excuses = db.getExcuseRequests();
    const evaluations = db.getMemberEvaluations();

    return govUsers.map(m => {
      const avgBreakdown = calculateMemberAVG(
        m.id,
        meetings,
        attendance,
        tasks,
        submissions,
        excuses,
        evaluations,
        m.bonusPoints || 0
      );
      return {
        member: m,
        avg: avgBreakdown.avgScore,
        bonus: avgBreakdown.bonusPoints,
        completedTasks: avgBreakdown.completedTasksCount,
      };
    }).sort((a, b) => b.avg - a.avg || b.bonus - a.bonus);
  }, [isSuperAdmin, govUsers]);

  const topCandidate = rankedMembers[0] || null;

  // Selected member override for Super Admin approval
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>('');

  useEffect(() => {
    if (topCandidate && !selectedCandidateId) {
      setSelectedCandidateId(topCandidate.member.id);
    }
  }, [topCandidate]);

  const currentChosenCandidate = useMemo(() => {
    if (!selectedCandidateId) return topCandidate;
    return rankedMembers.find(r => r.member.id === selectedCandidateId) || topCandidate;
  }, [rankedMembers, selectedCandidateId, topCandidate]);

  // Approved Member record - calculated ONLY for the single approved member
  const displayApprovedMemberData = useMemo(() => {
    if (!isApproved || !approvalData?.memberId) return null;
    const targetUser = db.getUsers().find(u => u.id === approvalData.memberId);
    if (!targetUser) return null;

    const meetings = db.getMeetings();
    const attendance = db.getAllAttendance();
    const tasks = db.getTasks();
    const submissions = db.getSubmissions();
    const excuses = db.getExcuseRequests();
    const evaluations = db.getMemberEvaluations();

    const avgBreakdown = calculateMemberAVG(
      targetUser.id,
      meetings,
      attendance,
      tasks,
      submissions,
      excuses,
      evaluations,
      targetUser.bonusPoints || 0
    );

    return {
      member: targetUser,
      avg: approvalData.avg || avgBreakdown.avgScore,
      bonus: avgBreakdown.bonusPoints,
      completedTasks: avgBreakdown.completedTasksCount,
      approvedBy: approvalData.approvedBy || 'أحمد الغنام',
      approvedAt: approvalData.approvedAt,
    };
  }, [isApproved, approvalData, refreshTrigger]);

  // Approve and Publish Handler (Super Admin Only)
  const handleApproveAndPublish = () => {
    if (!isSuperAdmin || !currentChosenCandidate) return;

    const chosen = currentChosenCandidate.member;
    const chosenAvg = currentChosenCandidate.avg;

    const dataToSave = {
      approved: true,
      memberId: chosen.id,
      memberName: chosen.fullName,
      monthKey,
      avg: chosenAvg,
      approvedBy: currentUser.fullName || 'أحمد الغنام (Super Admin)',
      approvedAt: new Date().toISOString(),
    };

    // 1. Save to LocalStorage
    try {
      localStorage.setItem(`eye_motm_approval_${monthKey}`, JSON.stringify(dataToSave));
    } catch {}

    // 2. Post Persistent Official Announcement synced with Realtime
    try {
      db.createAnnouncement(
        `🏆 [عضو الشهر المعتمد] ${chosen.fullName} — ${monthLabel}`,
        JSON.stringify(dataToSave),
        'All',
        currentUser,
        true,
        'Occasion',
        `motm:${monthKey}`
      );
    } catch (e) {
      console.warn('[MOTM Publish Announce Warn]:', e);
    }

    // 3. Dispatch official congratulatory notification to all governorate members
    try {
      const targetUserIds = govUsers.map(u => u.id);
      db.addNotificationsBulk(
        targetUserIds,
        '🏆 إعلان عضو الشهر المعتمد رسميـاً',
        `تهانينا للعضو المتميز "${chosen.fullName}" لحصوله على لقب عضو الشهر (${monthLabel}) رسمياً بعد اعتماده بأعلى تقييم (AVG: ${chosenAvg}%)!`,
        'success'
      );
    } catch {}

    setRefreshTrigger(prev => prev + 1);
  };

  // Unpublish and Retract Handler (Super Admin Only)
  const handleUnpublish = () => {
    if (!isSuperAdmin) return;

    // Remove from LocalStorage
    try {
      localStorage.removeItem(`eye_motm_approval_${monthKey}`);
    } catch {}

    // Delete announcement if present
    if (motmAnnouncement) {
      try {
        db.deleteAnnouncement(motmAnnouncement.id, currentUser);
      } catch {}
    }

    setRefreshTrigger(prev => prev + 1);
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      localStorage.setItem(dismissKey, 'true');
    } catch {}
  };

  // --- RENDERING CONDITIONS ---

  // 1. If NOT approved:
  if (!isApproved) {
    // For non-Super Admins: completely hidden
    if (!isSuperAdmin) {
      if (forceShow) {
        return (
          <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 text-center space-y-3 my-4">
            <Trophy className="w-12 h-12 text-amber-500/40 mx-auto animate-pulse" />
            <h3 className="text-lg font-black text-white">
              {isAr ? `عضو الشهر المتميز (${monthLabel})` : `Member of the Month (${monthLabel})`}
            </h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              {isAr
                ? 'عضو الشهر قيد المراجعة والاعتماد الرسمي من إدارة الكيان — سيتم نشره وإعلانه لكافة الأعضاء فور اعتماده.'
                : 'Member of the month is currently pending official review and approval from administration.'}
            </p>
          </div>
        );
      }
      return null;
    }

    // For Super Admin (Ahmed Ghannam): Show Approval & Review Command Card
    if (!currentChosenCandidate) return null;

    return (
      <div className="relative overflow-hidden rounded-3xl p-5 sm:p-7 bg-gradient-to-r from-[#0d1630] via-[#151c3d] to-[#0d1630] border-2 border-amber-500/60 text-white shadow-2xl animate-fade-in my-4" dir={isRtl ? 'rtl' : 'ltr'}>
        {/* Glow Effects */}
        <div className="absolute -top-20 -right-20 w-60 h-60 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-5">
          {/* Header Badge */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/50 text-amber-300 text-xs font-black">
                <Crown className="w-3.5 h-3.5 text-amber-400" />
                <span>{isAr ? 'لوحة اعتماد عضو الشهر (صلاحية المسؤول الأول فقط 👑)' : 'Super Admin MOTM Approval'}</span>
              </div>
              <h2 className="text-lg sm:text-xl font-black text-white">
                {isAr ? `مراجعة واعتماد عضو شهر ${monthLabel}` : `Review & Approve Member of the Month (${monthLabel})`}
              </h2>
              <p className="text-xs text-amber-200/80 font-semibold">
                {isAr
                  ? '⚠️ تنبيه: لن يظهر عضو الشهر على المنصة لأي عضو أو قائد إلا بموافقتك واعتمادك الرسمي هنا.'
                  : 'Notice: Best Member will NOT appear on the platform for anyone until you approve it here.'}
              </p>
            </div>

            <div className="shrink-0 flex items-center gap-2">
              <button
                onClick={handleApproveAndPublish}
                className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-700 text-white rounded-2xl text-xs font-black shadow-lg shadow-emerald-900/40 transition-all flex items-center gap-2 cursor-pointer border border-emerald-400/40 transform hover:scale-[1.02]"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                <span>{isAr ? '👑 موافقة واعتماد ونشر على المنصة الآن' : 'Approve & Publish'}</span>
              </button>
            </div>
          </div>

          {/* Candidate Card and Selector */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-center bg-white/5 border border-white/10 rounded-2xl p-4">
            {/* Candidate Info */}
            <div className="lg:col-span-2 flex items-center gap-4">
              <div className="relative shrink-0">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl p-0.5 bg-gradient-to-tr from-amber-400 to-yellow-300 shadow-md flex items-center justify-center">
                  <img
                    src={currentChosenCandidate.member.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(currentChosenCandidate.member.fullName)}`}
                    alt=""
                    className="w-full h-full rounded-2xl object-cover bg-slate-900"
                  />
                </div>
                <div className="absolute -top-2 -left-2 w-6 h-6 rounded-lg bg-amber-400 text-slate-950 flex items-center justify-center shadow font-black text-xs">
                  ★
                </div>
              </div>

              <div className="space-y-1 min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm sm:text-base font-black text-white">{currentChosenCandidate.member.fullName}</span>
                  <span className="text-[10px] font-mono text-amber-300 px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/30">
                    {currentChosenCandidate.member.membershipCode}
                  </span>
                </div>
                <p className="text-xs text-slate-300 font-medium">
                  {translateCommittee(currentChosenCandidate.member.committee)} {currentChosenCandidate.member.department ? `• ${currentChosenCandidate.member.department}` : ''}
                </p>
                <div className="flex items-center gap-3 pt-1 text-xs">
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    <Star className="w-3 h-3 fill-emerald-400" /> AVG: {currentChosenCandidate.avg}%
                  </span>
                  <span className="text-slate-400">•</span>
                  <span className="text-blue-300 font-bold">
                    {currentChosenCandidate.completedTasks} مهام مكتملة
                  </span>
                  <span className="text-slate-400">•</span>
                  <span className="text-orange-400 font-bold">
                    ⚡ {currentChosenCandidate.member.streakCount || 1} التزام
                  </span>
                </div>
              </div>
            </div>

            {/* Candidate Selector (Allows Super Admin to choose anyone else) */}
            <div className="space-y-1.5 border-t lg:border-t-0 lg:border-s border-white/10 lg:ps-4 pt-3 lg:pt-0">
              <label className="text-[11px] font-bold text-amber-300 block">
                {isAr ? '🔄 تغيير أو اختيار عضو آخر يدوياً:' : 'Override Candidate:'}
              </label>
              <select
                value={selectedCandidateId}
                onChange={(e) => setSelectedCandidateId(e.target.value)}
                className="w-full bg-slate-900 border border-amber-500/40 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-amber-400 cursor-pointer"
              >
                {rankedMembers.map((rm, idx) => (
                  <option key={rm.member.id} value={rm.member.id}>
                    {idx === 0 ? '👑 [الأعلى تقييماً] ' : ''}{rm.member.fullName} ({rm.avg}%)
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-slate-400">
                {isAr ? 'يمكنك ترقية أي عضو بناءً على التزامه ومساهماته الاستثنائية.' : 'You can promote any active member.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 2. If APPROVED: Render the Luxury Golden Spotlight Banner for everyone
  if (!displayApprovedMemberData) return null;

  const { member, avg, completedTasks, approvedBy } = displayApprovedMemberData;

  if (!forceShow && isDismissed) {
    return null;
  }

  return (
    <div className="relative overflow-hidden rounded-3xl p-4 sm:p-8 bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-950 border-2 border-amber-400/60 text-white shadow-2xl animate-fade-in my-4 group" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Dismiss Button */}
      {!forceShow && (
        <button
          onClick={handleDismiss}
          className="absolute top-3 left-3 sm:top-4 sm:left-4 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-all z-20 cursor-pointer"
          title={isAr ? 'إغلاق' : 'Dismiss'}
        >
          <X className="w-4 h-4" />
        </button>
      )}

      {/* Background Decorative Gold Lights */}
      <div className="absolute -top-24 -right-24 w-72 h-72 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />

      <div className="space-y-4 relative z-10">
        <div className="flex flex-col md:flex-row items-center justify-between gap-5">
          {/* Left: Member Avatar & Gold Crown */}
          <div className="flex items-center gap-4 sm:gap-5 w-full md:w-auto">
            <div className="relative shrink-0">
              <div className="w-20 h-20 sm:w-28 sm:h-28 rounded-3xl p-1 bg-gradient-to-tr from-amber-400 via-yellow-200 to-amber-500 shadow-xl flex items-center justify-center">
                <img
                  src={member.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(member.fullName)}`}
                  alt={member.fullName}
                  className="w-full h-full rounded-2xl object-cover bg-slate-900"
                />
              </div>
              {/* Gold Crown Badge */}
              <div className="absolute -top-2.5 -left-2.5 sm:-top-3.5 sm:-left-3.5 w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-gradient-to-br from-amber-300 to-amber-600 border-2 border-amber-100 flex items-center justify-center shadow-lg transform -rotate-12">
                <Crown className="w-4 h-4 sm:w-5 sm:h-5 text-slate-950" />
              </div>
            </div>

            <div className="space-y-1 text-start min-w-0 flex-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-300 text-[9px] sm:text-[10px] font-black tracking-wider uppercase max-w-full truncate">
                <Trophy className="w-3 h-3 shrink-0" />
                <span className="truncate">{isAr ? `عضو الشهر المعتمد — ${monthLabel} 🏆` : `Member of the Month — ${monthLabel}`}</span>
              </div>
              <h2 className="text-lg sm:text-2xl font-black text-white truncate">{member.fullName}</h2>
              <p className="text-xs text-amber-200/90 font-bold flex items-center gap-1.5 flex-wrap">
                <span>{member.role}</span>
                <span>•</span>
                <span>{translateCommittee(member.committee)}</span>
                {member.department && member.department !== 'None' && (
                  <>
                    <span>•</span>
                    <span>{member.department}</span>
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Right: Performance Stats */}
          <div className="grid grid-cols-3 gap-2 sm:gap-4 w-full md:w-auto bg-white/5 border border-white/10 p-3 sm:p-4 rounded-2xl backdrop-blur-md">
            <div className="text-center px-1 sm:px-3 border-e border-white/10">
              <span className="text-[9px] sm:text-[10px] text-amber-300/80 font-bold block truncate">{isAr ? 'معدل الـ AVG' : 'AVG Score'}</span>
              <div className="flex items-center justify-center gap-1 mt-0.5">
                <Star className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-400 fill-amber-400 shrink-0" />
                <span className="text-sm sm:text-lg font-black font-mono text-white">{avg}%</span>
              </div>
            </div>

            <div className="text-center px-1 sm:px-3 border-e border-white/10">
              <span className="text-[9px] sm:text-[10px] text-amber-300/80 font-bold block truncate">{isAr ? 'المهام' : 'Tasks'}</span>
              <div className="flex items-center justify-center gap-1 mt-0.5">
                <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-400 shrink-0" />
                <span className="text-sm sm:text-lg font-black font-mono text-white">{completedTasks}</span>
              </div>
            </div>

            <div className="text-center px-1 sm:px-3">
              <span className="text-[9px] sm:text-[10px] text-amber-300/80 font-bold block truncate">{isAr ? 'التزام ⚡' : 'Streak'}</span>
              <div className="flex items-center justify-center gap-1 mt-0.5">
                <Flame className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-orange-400 fill-orange-400 shrink-0" />
                <span className="text-sm sm:text-lg font-black font-mono text-white">{member.streakCount || 1}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Super Admin Control Bar on Approved Banner */}
        {isSuperAdmin && (
          <div className="pt-3 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-amber-300/90 font-semibold">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>{isAr ? `معتمد ومنشور رسمياً بموافقتك (${approvedBy})` : `Officially approved by ${approvedBy}`}</span>
            </div>
            <button
              onClick={handleUnpublish}
              className="px-3.5 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{isAr ? '⚠️ إلغاء النشر وسحب الاعتماد' : 'Unpublish'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
