import React, { useState, useEffect } from 'react';
import { db } from '../db/localDb';
import { UserProfile, ExcuseRequest, FreezeRequest, CommitteeChangeRequest, ExcuseType, Meeting, Task } from '../types';
import { useLanguage } from '../lib/LanguageContext';
import { isAdminUser } from '../lib/permissions';
import { FileText, Snowflake, Clock, CheckCircle2, XCircle, Send, MessageSquare, ArrowRightLeft } from 'lucide-react';

interface ExcusesAndFreezeProps {
  currentUser: UserProfile;
  onNavigateToView?: (view: string) => void;
}

const COMMITTEES_LIST = ['HR', 'PR', 'SM', 'OR'];
const COMMITTEE_DEPTS_MAP: Record<string, string[]> = {
  HR: ['HRM', 'HRD', 'HRS', 'HRIS'],
  PR: ['EPR', 'IPR'],
  SM: ['Content', 'Graphic Design', 'Photography', 'Video Editing'],
  OR: ['VIP', 'Planning', 'Coordination', 'Logistics'],
};
const HRM_SUB_BRANCHES = ['HR OF PR', 'HR OF SM', 'HR OF OR', 'HR OF HR', 'HRM General'];

export const ExcusesAndFreezeModal: React.FC<ExcusesAndFreezeProps> = ({ currentUser }) => {
  const { language, isRtl } = useLanguage();
  const isAr = language === 'ar';

  const isHighboardOrHR =
    isAdminUser(currentUser) ||
    ['Super Admin', 'Vice', 'Coordinator', 'Deputy Coordinator', 'HRM'].includes(currentUser.role) ||
    currentUser.department === 'HRM' ||
    currentUser.committee === 'HR' ||
    currentUser.committee === 'All' ||
    (currentUser.department || '').includes('HR') ||
    ((currentUser as any).subCommittee || '').includes('HR');

  const isHead = currentUser.role === 'Head';
  const isHeadOrHighboard = isHighboardOrHR || isHead;
  const isLeader = currentUser.role === 'Leader';
  const isLeadership = isHeadOrHighboard || isLeader;

  // Check if a user can approve/reject requests (Super Admin / Head / Vice / HR have full management and approval authority)
  const canApproveRequest = (requestMemberId?: string): boolean => {
    if (isAdminUser(currentUser) || isHighboardOrHR || isHead) {
      return true; // Unrestricted access for all leadership and HR admins
    }
    if (isLeader) {
      if (requestMemberId && requestMemberId === currentUser.id) return false;
      return true;
    }
    return false;
  };

  const [activeTab, setActiveTab] = useState<'manage' | 'excuses' | 'freeze' | 'committee-change' | 'activity'>(() => {
    return isLeadership ? 'manage' : 'excuses';
  });
  const [manageCategoryFilter, setManageCategoryFilter] = useState<'all' | 'committee' | 'excuse' | 'freeze'>('all');
  const [committeeFilter, setCommitteeFilter] = useState<string>(() => {
    if (isHead && currentUser.committee && currentUser.committee !== 'None' && currentUser.committee !== 'All') {
      return currentUser.committee;
    }
    return 'All';
  });
  const [statusFilter, setStatusFilter] = useState<'All' | 'Pending' | 'Approved' | 'Rejected'>('All');
  const [activitySearch, setActivitySearch] = useState('');

  const [excuses, setExcuses] = useState<ExcuseRequest[]>([]);
  const [freezes, setFreezes] = useState<FreezeRequest[]>([]);
  const [committeeChanges, setCommitteeChanges] = useState<CommitteeChangeRequest[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  // Excuse Form state
  const [excuseType, setExcuseType] = useState<ExcuseType>('Meeting');
  const [selectedMeetingId, setSelectedMeetingId] = useState<string>('');
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [isCustomTarget, setIsCustomTarget] = useState<boolean>(false);
  const [excuseTarget, setExcuseTarget] = useState('');
  const [excuseReason, setExcuseReason] = useState('');
  const [excuseDate, setExcuseDate] = useState(new Date().toISOString().slice(0, 10));

  // Freeze Form state
  const [freezeStart, setFreezeStart] = useState('');
  const [freezeEnd, setFreezeEnd] = useState('');
  const [freezeReason, setFreezeReason] = useState('');

  // Committee Change Form state
  const [targetCommittee, setTargetCommittee] = useState<string>(() => {
    return currentUser.committee === 'HR' ? 'PR' : 'HR';
  });
  const [targetDepartment, setTargetDepartment] = useState<string>('None');
  const [targetSubDepartment, setTargetSubDepartment] = useState<string>('HR OF PR');
  const [committeeChangeReason, setCommitteeChangeReason] = useState('');

  // Status message
  const [successMsg, setSuccessMsg] = useState('');

  // Admin Response Modal
  const [selectedRequest, setSelectedRequest] = useState<{
    type: 'excuse' | 'freeze' | 'committee';
    item: any;
  } | null>(null);
  const [adminNote, setAdminNote] = useState('');

  const loadData = () => {
    setExcuses(db.getExcuseRequests());
    setFreezes(db.getFreezeRequests());
    setCommitteeChanges(db.getCommitteeChangeRequests());
    setLogs(db.getLogs());
    setMeetings(db.getMeetings());
    setTasks(db.getTasks());
  };

  useEffect(() => {
    loadData();
    const unsub = db.onChange(loadData);
    return () => unsub();
  }, []);

  const handleClearAllSampleRequests = () => {
    if (confirm(isAr ? 'هل أنت متأكد من مسح جميع طلبات الأعذار والفريز وتغيير اللجان؟' : 'Clear all excuse, freeze, and committee requests?')) {
      db.clearAllExcuseAndFreezeRequests(currentUser);
      loadData();
      setSuccessMsg(isAr ? 'تم مسح جميع الطلبات بنجاح.' : 'Cleared all requests.');
      setTimeout(() => setSuccessMsg(''), 3000);
    }
  };

  const userRelevantMeetings = meetings.filter(m => {
    if (isHighboardOrHR || currentUser.role === 'Super Admin' || currentUser.committee === 'All') return true;
    const matchComm = !m.committee || m.committee === 'All' || m.committee === 'None' || m.committee === 'General' || m.committee === currentUser.committee;
    const matchDept = !m.department || m.department === 'All' || m.department === 'None' || m.department === 'General' || m.department === currentUser.department;
    return matchComm && matchDept;
  });

  const userRelevantTasks = tasks.filter(t => {
    if (isHighboardOrHR || currentUser.role === 'Super Admin' || currentUser.committee === 'All') return true;
    const matchComm = !t.committee || t.committee === 'All' || t.committee === 'None' || t.committee === currentUser.committee;
    return matchComm;
  });

  const handleMeetingChange = (meetingId: string) => {
    setSelectedMeetingId(meetingId);
    if (meetingId === '__custom__') {
      setIsCustomTarget(true);
      setExcuseTarget('');
    } else {
      setIsCustomTarget(false);
      const m = meetings.find(item => item.id === meetingId);
      if (m) {
        setExcuseTarget(m.title);
        if (m.scheduledAt) {
          setExcuseDate(m.scheduledAt.slice(0, 10));
        }
      } else {
        setExcuseTarget('');
      }
    }
  };

  const handleTaskChange = (taskId: string) => {
    setSelectedTaskId(taskId);
    if (taskId === '__custom__') {
      setIsCustomTarget(true);
      setExcuseTarget('');
    } else {
      setIsCustomTarget(false);
      const t = tasks.find(item => item.id === taskId);
      if (t) {
        setExcuseTarget(t.title || (t as any).name || '');
        if (t.deadline) {
          setExcuseDate(t.deadline.slice(0, 10));
        }
      } else {
        setExcuseTarget('');
      }
    }
  };

  const handleCreateExcuse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!excuseReason.trim()) return;

    const targetId = excuseType === 'Meeting'
      ? (selectedMeetingId !== '__custom__' && selectedMeetingId ? selectedMeetingId : undefined)
      : excuseType === 'Task'
      ? (selectedTaskId !== '__custom__' && selectedTaskId ? selectedTaskId : undefined)
      : undefined;

    db.createExcuseRequest({
      memberId: currentUser.id,
      memberName: currentUser.fullName,
      committee: currentUser.committee,
      department: currentUser.department,
      type: excuseType,
      targetId: targetId,
      targetTitle: excuseTarget || (excuseType === 'Meeting' ? 'اجتماع' : excuseType === 'Task' ? 'مهمة' : 'عذر عام'),
      reason: excuseReason,
      date: excuseDate,
    }, currentUser);

    setExcuseReason('');
    setExcuseTarget('');
    setSelectedMeetingId('');
    setSelectedTaskId('');
    setIsCustomTarget(false);
    setSuccessMsg(isAr ? 'تم تقديم طلب العذر بنجاح، وسوف تراجعه الإدارة وقادة اللجان قريباً.' : 'Excuse request submitted successfully.');
    setTimeout(() => setSuccessMsg(''), 3000);
    setActiveTab('manage');
  };

  const handleCreateFreeze = (e: React.FormEvent) => {
    e.preventDefault();
    if (!freezeStart || !freezeEnd || !freezeReason.trim()) return;

    db.createFreezeRequest({
      memberId: currentUser.id,
      memberName: currentUser.fullName,
      committee: currentUser.committee,
      department: currentUser.department,
      startDate: freezeStart,
      endDate: freezeEnd,
      reason: freezeReason,
    }, currentUser);

    setFreezeStart('');
    setFreezeEnd('');
    setFreezeReason('');
    setSuccessMsg(isAr ? 'تم تقديم طلب فريز العضوية بنجاح، وسوف تراجعه الإدارة.' : 'Freeze request submitted successfully.');
    setTimeout(() => setSuccessMsg(''), 3000);
    setActiveTab('manage');
  };

  const handleCreateCommitteeChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (!committeeChangeReason.trim()) return;

    const finalTargetDept = (targetCommittee === 'HR' && targetDepartment === 'HRM' && targetSubDepartment)
      ? targetSubDepartment
      : targetDepartment;

    db.createCommitteeChangeRequest({
      memberId: currentUser.id,
      memberName: currentUser.fullName,
      governorate: currentUser.governorate,
      currentCommittee: currentUser.committee,
      targetCommittee: targetCommittee,
      currentDepartment: currentUser.department,
      targetDepartment: finalTargetDept,
      reason: committeeChangeReason,
    }, currentUser);

    setCommitteeChangeReason('');
    setSuccessMsg(isAr ? 'تم إرسال طلب تغيير اللجنة بنجاح! تم إشعار القادة والإدارة لمراجعة طلبك.' : 'Committee change request submitted to Leaders and Admins.');
    setTimeout(() => setSuccessMsg(''), 4000);
    setActiveTab('manage');
  };

  const handleAdminDecision = async (status: 'Approved' | 'Rejected') => {
    if (!selectedRequest) return;

    if (selectedRequest.type === 'committee') {
      await db.updateCommitteeChangeRequestStatus(selectedRequest.item.id, status, adminNote, currentUser);
    } else if (selectedRequest.type === 'excuse') {
      await db.updateExcuseStatus(selectedRequest.item.id, status, adminNote, currentUser);
    } else {
      await db.updateFreezeStatus(selectedRequest.item.id, status, adminNote, currentUser);
    }

    setSelectedRequest(null);
    setAdminNote('');
    loadData();
  };

  const userComm = (currentUser.committee || '').trim().toLowerCase();

  const visibleExcuses = excuses.filter(exc => {
    if (isHighboardOrHR) {
      if (committeeFilter !== 'All') {
        return (exc.committee || '').trim().toLowerCase() === committeeFilter.toLowerCase();
      }
      return true;
    }
    if (isHead || isLeader) {
      const excComm = (exc.committee || '').trim().toLowerCase();
      const matchCommittee = excComm === userComm || excComm === 'all' || userComm === 'all' || (userComm.includes('hr') && excComm.includes('hr'));
      if (committeeFilter !== 'All') {
        return matchCommittee && (exc.committee || '').trim().toLowerCase() === committeeFilter.toLowerCase();
      }
      return matchCommittee || exc.memberId === currentUser.id;
    }
    return exc.memberId === currentUser.id;
  }).filter(exc => statusFilter === 'All' || exc.status === statusFilter);

  const visibleFreezes = freezes.filter(frz => {
    if (isHighboardOrHR) {
      if (committeeFilter !== 'All') {
        return (frz.committee || '').trim().toLowerCase() === committeeFilter.toLowerCase();
      }
      return true;
    }
    if (isHead || isLeader) {
      const frzComm = (frz.committee || '').trim().toLowerCase();
      const matchCommittee = frzComm === userComm || frzComm === 'all' || userComm === 'all' || (userComm.includes('hr') && frzComm.includes('hr'));
      if (committeeFilter !== 'All') {
        return matchCommittee && (frz.committee || '').trim().toLowerCase() === committeeFilter.toLowerCase();
      }
      return matchCommittee || frz.memberId === currentUser.id;
    }
    return frz.memberId === currentUser.id;
  }).filter(frz => statusFilter === 'All' || frz.status === statusFilter);

  const visibleCommitteeChanges = committeeChanges.filter(c => {
    if (isHighboardOrHR) {
      if (committeeFilter !== 'All') {
        return (c.currentCommittee || '').trim().toLowerCase() === committeeFilter.toLowerCase() ||
               (c.targetCommittee || '').trim().toLowerCase() === committeeFilter.toLowerCase();
      }
      return true;
    }
    if (isHead || isLeader) {
      const curComm = (c.currentCommittee || '').trim().toLowerCase();
      const targetComm = (c.targetCommittee || '').trim().toLowerCase();
      const matchCommittee = curComm === userComm || targetComm === userComm || userComm === 'all' || (userComm.includes('hr') && (curComm.includes('hr') || targetComm.includes('hr')));
      if (committeeFilter !== 'All') {
        return matchCommittee && ((c.currentCommittee || '').trim().toLowerCase() === committeeFilter.toLowerCase() || (c.targetCommittee || '').trim().toLowerCase() === committeeFilter.toLowerCase());
      }
      return matchCommittee || c.memberId === currentUser.id;
    }
    return c.memberId === currentUser.id;
  }).filter(c => statusFilter === 'All' || c.status === statusFilter);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Approved':
        return <span className="px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 text-[10px] font-bold flex items-center gap-1 w-fit"><CheckCircle2 className="w-3 h-3" /> {isAr ? 'مقبول ومُعتمد' : 'Approved'}</span>;
      case 'Rejected':
        return <span className="px-2.5 py-1 rounded-full bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 text-[10px] font-bold flex items-center gap-1 w-fit"><XCircle className="w-3 h-3" /> {isAr ? 'مرفوض' : 'Rejected'}</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800 text-[10px] font-bold flex items-center gap-1 w-fit"><Clock className="w-3 h-3 animate-spin" /> {isAr ? 'قيد المراجعة' : 'Pending'}</span>;
    }
  };

  const pendingCommCount = visibleCommitteeChanges.filter(c => c.status === 'Pending').length;
  const pendingExcCount = visibleExcuses.filter(e => e.status === 'Pending').length;
  const pendingFrzCount = visibleFreezes.filter(f => f.status === 'Pending').length;
  const pendingCount = pendingCommCount + pendingExcCount + pendingFrzCount;

  return (
    <div className="space-y-6 p-4 sm:p-6" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-200 text-xs font-black">
            <Snowflake className="w-3.5 h-3.5" />
            <span>{isAr ? 'منظومة الأعذار والطلبات وتجميد العضوية' : 'Excuses, Requests & Freeze System'}</span>
          </div>
          <h1 className="text-xl sm:text-3xl font-black">
            {isLeadership
              ? (isAr ? 'لوحة متابعة ومراجعة طلبات الأعضاء واللجان' : 'Leadership Requests & Approvals Panel')
              : (isAr ? 'تقديم الأعذار وطلبات نقل اللجان وتجميد النشاط' : 'Excuses & Requests Hub')}
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl font-semibold">
            {isLeadership
              ? (isAr
                  ? 'يمكنك مراجعة كافة طلبات الأعضاء واللجان (طلبات نقل اللجان، الأعذار الرسمية، وتجميد العضوية) واعتمادها أو رفضها فورياً مع إشعار الأعضاء بالقرار.'
                  : 'Review, approve, or reject member requests for committee transfers, excuses, and membership freezes with instant notifications.')
              : (isAr 
                  ? 'يمكنك تقديم عذر رسمي عن عدم حضور اجتماع، أو طلب فريز لتجميد نشاطك مؤقتاً، أو تقديم طلب رسمي لتغيير ونقل لجنتك إلى لجنة أخرى بموافقة القادة والإدارة.' 
                  : 'Submit official excuses for meetings, request membership freezes, or request a committee transfer with Leader and Admin approval.')}
          </p>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center justify-between animate-fade-in shadow-sm">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg('')} className="p-1 hover:bg-emerald-100 dark:hover:bg-emerald-900 rounded-lg">
            <CheckCircle2 className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        {isLeadership ? (
          <>
            <button
              onClick={() => setActiveTab('manage')}
              className={`px-4 py-2.5 rounded-2xl font-black text-xs flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'manage'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>{isAr ? '📥 إدارة ومراجعة الطلبات واللجان' : 'Manage & Review Requests'}</span>
              {pendingCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-900 text-[10px] font-black animate-pulse">
                  {pendingCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('activity')}
              className={`px-4 py-2.5 rounded-2xl font-black text-xs flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'activity'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
              }`}
            >
              <span>📜 {isAr ? 'سجل الأنشطة والتحركات' : 'Audit Logs'}</span>
            </button>

            <button
              onClick={() => setActiveTab('excuses')}
              className={`px-4 py-2.5 rounded-2xl font-black text-xs flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'excuses'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>{isAr ? 'تقديم عذر خاص بي' : 'Submit Excuse'}</span>
            </button>

            <button
              onClick={() => setActiveTab('freeze')}
              className={`px-4 py-2.5 rounded-2xl font-black text-xs flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'freeze'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
              }`}
            >
              <Snowflake className="w-4 h-4 text-cyan-400" />
              <span>{isAr ? 'طلب فريز خاص بي' : 'Request Freeze'}</span>
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => setActiveTab('excuses')}
              className={`px-4 py-2.5 rounded-2xl font-black text-xs flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'excuses'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>{isAr ? 'تقديم عذر رسمي' : 'Submit Excuse'}</span>
            </button>

            <button
              onClick={() => setActiveTab('freeze')}
              className={`px-4 py-2.5 rounded-2xl font-black text-xs flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'freeze'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
              }`}
            >
              <Snowflake className="w-4 h-4 text-cyan-400" />
              <span>{isAr ? 'طلب فريز (تجميد العضوية)' : 'Request Freeze'}</span>
            </button>

            <button
              onClick={() => setActiveTab('committee-change')}
              className={`px-4 py-2.5 rounded-2xl font-black text-xs flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'committee-change'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
              }`}
            >
              <ArrowRightLeft className="w-4 h-4 text-emerald-400" />
              <span>{isAr ? '🔄 طلب تغيير لجنة' : 'Change Committee'}</span>
            </button>

            <button
              onClick={() => setActiveTab('manage')}
              className={`px-4 py-2.5 rounded-2xl font-black text-xs flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'manage'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>{isAr ? 'طلباتي ومتابعة الردود' : 'My Requests'}</span>
            </button>
          </>
        )}
      </div>

      {activeTab === 'excuses' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 space-y-6 shadow-sm">
          <h2 className="text-base font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-500" />
            <span>{isAr ? 'نموذج تقديم عذر رسمي جديد' : 'Submit Official Excuse'}</span>
          </h2>

          {/* Explanation Banner on Excuse Scoring */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/30 border border-blue-200 dark:border-blue-800/60 space-y-1.5 shadow-xs">
            <div className="flex items-center gap-2 font-black text-xs text-blue-900 dark:text-blue-200">
              <span className="text-base">⚖️</span>
              <span>{isAr ? 'قواعد التقييم واحتساب درجات الأعذار الرسمية' : 'Official Excuse Evaluation Rules'}</span>
            </div>
            <p className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed font-semibold">
              {isAr
                ? '• عند قبول العذر رسمياً من قِبل الليدر أو الإدارة: يحصل العضو على نصف درجة التقييم (50%) الخاصة بالاجتماع أو التكليف في الـ AVG.\n• عند رفض العذر أو الغياب بدون عذر مقبول: يحصل العضو على (0) درجة من تقييم الاجتماع.'
                : '• If accepted by Leader/Admin: Member earns 50% (half score) of the meeting/task points.\n• If rejected or unexcused: Member earns 0 points.'}
            </p>
          </div>

          <form onSubmit={handleCreateExcuse} className="space-y-4 max-w-xl">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                  {isAr ? 'نوع العذر' : 'Excuse Type'}
                </label>
                <select
                  value={excuseType}
                  onChange={e => {
                    const newType = e.target.value as ExcuseType;
                    setExcuseType(newType);
                    setSelectedMeetingId('');
                    setSelectedTaskId('');
                    setIsCustomTarget(false);
                    setExcuseTarget('');
                  }}
                  className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 p-3 text-xs font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="Meeting">{isAr ? '🏛️ عذر عن حضور اجتماع' : 'Meeting'}</option>
                  <option value="Task">{isAr ? '🎯 عذر عن تأخر تسليم مهمة / تكليف' : 'Task'}</option>
                  <option value="General">{isAr ? '🚨 عذر عام / ظرف طارئ' : 'General'}</option>
                </select>
              </div>

              {/* Dynamic Target Selection for Meetings */}
              {excuseType === 'Meeting' && (
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                    {isAr ? 'اختر الاجتماع المراد تقديم العذر عنه' : 'Select Meeting'}
                  </label>
                  {userRelevantMeetings.length > 0 ? (
                    <div className="space-y-2">
                      <select
                        value={selectedMeetingId}
                        onChange={e => handleMeetingChange(e.target.value)}
                        className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 p-3 text-xs font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none"
                      >
                        <option value="">{isAr ? '-- اختر الاجتماع من القائمة --' : '-- Select a Meeting --'}</option>
                        {userRelevantMeetings.map(m => {
                          const isOnline = m.type === 'online' || (m.location || '').toLowerCase().includes('online') || (m.location || '').includes('زووم');
                          const dateStr = m.scheduledAt ? m.scheduledAt.slice(0, 10) : '';
                          return (
                            <option key={m.id} value={m.id}>
                              {isOnline ? '🌐' : '🏛️'} {m.title} {dateStr ? `(${dateStr})` : ''} — {m.committee === 'All' ? (isAr ? 'اجتماع عام' : 'General') : m.committee}
                            </option>
                          );
                        })}
                        <option value="__custom__">✏️ {isAr ? 'اجتماع آخر (كتابة يدوية)' : 'Other / Custom Meeting'}</option>
                      </select>

                      {isCustomTarget && (
                        <input
                          type="text"
                          value={excuseTarget}
                          onChange={e => setExcuseTarget(e.target.value)}
                          placeholder={isAr ? 'اكتب اسم الاجتماع بالتفصيل...' : 'Enter meeting title...'}
                          required
                          className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 p-3 text-xs font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none animate-fade-in"
                        />
                      )}
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={excuseTarget}
                      onChange={e => setExcuseTarget(e.target.value)}
                      placeholder={isAr ? 'اكتب اسم الاجتماع...' : 'Enter meeting title...'}
                      required
                      className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 p-3 text-xs font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  )}
                </div>
              )}

              {/* Dynamic Target Selection for Tasks */}
              {excuseType === 'Task' && (
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                    {isAr ? 'اختر المهمة أو التكليف المراد تقديم العذر عنه' : 'Select Task'}
                  </label>
                  {userRelevantTasks.length > 0 ? (
                    <div className="space-y-2">
                      <select
                        value={selectedTaskId}
                        onChange={e => handleTaskChange(e.target.value)}
                        className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 p-3 text-xs font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none"
                      >
                        <option value="">{isAr ? '-- اختر المهمة من القائمة --' : '-- Select a Task --'}</option>
                        {userRelevantTasks.map(t => {
                          const deadlineStr = t.deadline ? t.deadline.slice(0, 10) : '';
                          return (
                            <option key={t.id} value={t.id}>
                              🎯 {t.title || (t as any).name} {deadlineStr ? `(تاريخ التسليم: ${deadlineStr})` : ''}
                            </option>
                          );
                        })}
                        <option value="__custom__">✏️ {isAr ? 'تكليف آخر (كتابة يدوية)' : 'Other / Custom Task'}</option>
                      </select>

                      {isCustomTarget && (
                        <input
                          type="text"
                          value={excuseTarget}
                          onChange={e => setExcuseTarget(e.target.value)}
                          placeholder={isAr ? 'اكتب اسم المهمة بالتفصيل...' : 'Enter task title...'}
                          required
                          className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 p-3 text-xs font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none animate-fade-in"
                        />
                      )}
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={excuseTarget}
                      onChange={e => setExcuseTarget(e.target.value)}
                      placeholder={isAr ? 'اكتب اسم التكليف أو المهمة...' : 'Enter task title...'}
                      required
                      className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 p-3 text-xs font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  )}
                </div>
              )}

              {/* General Target Input */}
              {excuseType === 'General' && (
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                    {isAr ? 'عنوان أو مناسبة العذر (اختياري)' : 'Occasion / Title (Optional)'}
                  </label>
                  <input
                    type="text"
                    value={excuseTarget}
                    onChange={e => setExcuseTarget(e.target.value)}
                    placeholder={isAr ? 'مثال: ظرف طارئ، سفر مفاجئ...' : 'Emergency, travel...'}
                    className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 p-3 text-xs font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                {isAr ? 'تاريخ الفاعلية أو الاجتماع' : 'Date'}
              </label>
              <input
                type="date"
                value={excuseDate}
                onChange={e => setExcuseDate(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 p-3 text-xs font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                {isAr ? 'سبب العذر بالتفصيل' : 'Detailed Reason for Excuse'}
              </label>
              <textarea
                rows={4}
                value={excuseReason}
                onChange={e => setExcuseReason(e.target.value)}
                placeholder={isAr ? 'يرجى كتابة سبب عدم التمكن من الحضور أو التسليم بوضوح...' : 'State the reason clearly...'}
                required
                className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 p-3 text-xs font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
              />
            </div>

            <button
              type="submit"
              className="px-6 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-blue-500/20 transition-all cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>{isAr ? 'إرسال طلب العذر' : 'Submit Excuse Request'}</span>
            </button>
          </form>
        </div>
      )}

      {activeTab === 'freeze' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 space-y-6 shadow-sm">
          <h2 className="text-base font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Snowflake className="w-5 h-5 text-cyan-500" />
            <span>{isAr ? 'نموذج طلب الفريز (تجميد نشاط العضوية)' : 'Membership Freeze Request Form'}</span>
          </h2>

          <div className="p-4 rounded-2xl bg-cyan-50 dark:bg-cyan-950/30 border border-cyan-200 dark:border-cyan-800 text-cyan-800 dark:text-cyan-300 text-xs space-y-1">
            <p className="font-bold">{isAr ? '💡 ماهو طلب الفريز؟' : '💡 What is a Membership Freeze?'}</p>
            <p>{isAr ? 'يسمح لك طلب الفريز بتجميد التكليفات والأنشطة لفترة زمنيّة محددة (مثل فترة امتحانات الترم أو السفر) دون التأثير على تقييمك أو التسبب في إنذارات غياب.' : 'Temporarily pauses your tasks and activities for a specified period without affecting your score or attendance status.'}</p>
          </div>

          <form onSubmit={handleCreateFreeze} className="space-y-4 max-w-xl">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                  {isAr ? 'تاريخ بدء الفريز' : 'Freeze Start Date'}
                </label>
                <input
                  type="date"
                  value={freezeStart}
                  onChange={e => setFreezeStart(e.target.value)}
                  required
                  className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 p-3 text-xs font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-cyan-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                  {isAr ? 'تاريخ انتهاء الفريز' : 'Freeze End Date'}
                </label>
                <input
                  type="date"
                  value={freezeEnd}
                  onChange={e => setFreezeEnd(e.target.value)}
                  required
                  className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 p-3 text-xs font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-cyan-500 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                {isAr ? 'سبب طلب الفريز' : 'Reason for Freeze'}
              </label>
              <textarea
                rows={4}
                value={freezeReason}
                onChange={e => setFreezeReason(e.target.value)}
                placeholder={isAr ? 'اذكر سبب طلب تجميد العضوية والمبررات الإدارية...' : 'Provide details...'}
                required
                className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 p-3 text-xs font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-cyan-500 outline-none resize-none"
              />
            </div>

            <button
              type="submit"
              className="px-6 py-3 rounded-2xl bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-cyan-500/20 transition-all cursor-pointer"
            >
              <Snowflake className="w-4 h-4" />
              <span>{isAr ? 'إرسال طلب الفريز' : 'Submit Freeze Request'}</span>
            </button>
          </form>
        </div>
      )}

      {activeTab === 'committee-change' && !isHeadOrHighboard && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 space-y-6 shadow-sm">
          <h2 className="text-base font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-emerald-500" />
            <span>{isAr ? 'نموذج طلب نقل / تغيير اللجنة الرسمية' : 'Committee Transfer Request Form'}</span>
          </h2>

          <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs space-y-1">
            <p className="font-bold">{isAr ? '📌 شروط وإجراءات نقل اللجنة:' : '📌 Committee Transfer Guidelines:'}</p>
            <p>
              {isAr 
                ? 'عند تقديم طلب نقل لجنة، يتم إرسال إشعار رسمي وفوري للقادة والإدارة العليا لمراجعة طلبك. عند موافقة القادة سيتم تحديث لجنتك تلقائياً في النظام وإشعارك بالقرار.' 
                : 'Your request will be forwarded to Committee Leaders and Executive Admins for review. Upon approval, your committee will be updated immediately.'}
            </p>
            <div className="pt-2 text-[11px] font-mono">
              <strong>{isAr ? 'لجنتك الحالية:' : 'Current Committee:'}</strong> {currentUser.committee} {currentUser.department && currentUser.department !== 'None' ? `(${currentUser.department})` : ''}
            </div>
          </div>

          <form onSubmit={handleCreateCommitteeChange} className="space-y-4 max-w-xl">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                  {isAr ? 'اللجنة المراد الانتقال إليها' : 'Target Committee'}
                </label>
                <select
                  value={targetCommittee}
                  onChange={e => {
                    const comm = e.target.value;
                    setTargetCommittee(comm);
                    const depts = COMMITTEE_DEPTS_MAP[comm] || [];
                    setTargetDepartment(depts[0] || 'None');
                    if (comm === 'HR') setTargetSubDepartment('HR OF PR');
                  }}
                  className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 p-3 text-xs font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  {COMMITTEES_LIST.map(comm => (
                    <option key={comm} value={comm}>
                      {comm === 'HR' ? (isAr ? 'الموارد البشرية (HR)' : 'Human Resources (HR)')
                        : comm === 'PR' ? (isAr ? 'العلاقات العامة (PR)' : 'Public Relations (PR)')
                        : comm === 'SM' ? (isAr ? 'السوشيال ميديا (SM)' : 'Social Media (SM)')
                        : (isAr ? 'العلاقات التنظيمية واللوجستية (OR)' : 'Organization & Logistics (OR)')}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                  {isAr ? 'القسم المطلوب (اختياري)' : 'Target Department (Optional)'}
                </label>
                <select
                  value={targetDepartment}
                  onChange={e => {
                    const dept = e.target.value;
                    setTargetDepartment(dept);
                    if (dept === 'HRM') setTargetSubDepartment('HR OF PR');
                  }}
                  className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 p-3 text-xs font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <option value="None">{isAr ? 'بدون تخصيص محدد / غير محدد' : 'General / None'}</option>
                  {(COMMITTEE_DEPTS_MAP[targetCommittee] || []).map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* HRM Sub-Branch Selector: Opened only when HR committee and HRM department are selected */}
            {targetCommittee === 'HR' && targetDepartment === 'HRM' && (
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-1.5 animate-fadeIn">
                <label className="block text-xs font-black text-emerald-700 dark:text-emerald-300">
                  {isAr ? 'اللجنة الفرعية لـ HRM (تحديد التكليف) *' : 'HRM Sub-Branch Assignment *'}
                </label>
                <select
                  value={targetSubDepartment}
                  onChange={e => setTargetSubDepartment(e.target.value)}
                  className="w-full rounded-xl border border-emerald-500/40 bg-white dark:bg-slate-900 p-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  {HRM_SUB_BRANCHES.map(sub => (
                    <option key={sub} value={sub}>{sub}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                {isAr ? 'سبب طلب نقل اللجنة بالتفصيل' : 'Reason for Transfer'}
              </label>
              <textarea
                rows={4}
                value={committeeChangeReason}
                onChange={e => setCommitteeChangeReason(e.target.value)}
                placeholder={isAr ? 'يرجى توضيح أسباب رغبتك في النقل وخبراتك أو مهاراتك في اللجنة الجديدة...' : 'State your transfer reasons and relevant skills...'}
                required
                className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 p-3 text-xs font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
              />
            </div>

            <button
              type="submit"
              className="px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
            >
              <ArrowRightLeft className="w-4 h-4" />
              <span>{isAr ? 'إرسال طلب نقل اللجنة للقادة والإدارة' : 'Submit Transfer Request'}</span>
            </button>
          </form>
        </div>
      )}

      {activeTab === 'manage' && (
        <div className="space-y-6">
          {/* Top Filter & Metrics Bar */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-500" />
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                  {isLeadership ? (isAr ? 'تصفية وإدارة طلبات الأعضاء' : 'Filter & Manage Requests') : (isAr ? 'متابعة سجل طلباتي' : 'My Requests Log')}
                </h3>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2">
                {isLeadership && (
                  <select
                    value={committeeFilter}
                    onChange={e => setCommitteeFilter(e.target.value)}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 outline-none"
                  >
                    <option value="All">{isAr ? 'كل اللجان' : 'All Committees'}</option>
                    <option value="HR">HR</option>
                    <option value="PR">PR</option>
                    <option value="SM">SM</option>
                    <option value="OR">OR</option>
                  </select>
                )}

                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value as any)}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 outline-none"
                >
                  <option value="All">{isAr ? 'كل الحالات' : 'All Status'}</option>
                  <option value="Pending">{isAr ? 'قيد المراجعة ⏳' : 'Pending ⏳'}</option>
                  <option value="Approved">{isAr ? 'مقبول ومُعتمد ✅' : 'Approved ✅'}</option>
                  <option value="Rejected">{isAr ? 'مرفوض ❌' : 'Rejected ❌'}</option>
                </select>
              </div>
            </div>

            {/* Category Sub-Tabs */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setManageCategoryFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  manageCategoryFilter === 'all'
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {isAr ? 'عرض الكل' : 'All'} ({visibleCommitteeChanges.length + visibleExcuses.length + visibleFreezes.length})
              </button>

              <button
                onClick={() => setManageCategoryFilter('committee')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  manageCategoryFilter === 'committee'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span>{isAr ? 'طلبات نقل اللجان' : 'Committee Transfers'}</span>
                <span className="px-1.5 py-0.2 rounded-md bg-white/20 text-[10px]">{visibleCommitteeChanges.length}</span>
                {pendingCommCount > 0 && (
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                )}
              </button>

              <button
                onClick={() => setManageCategoryFilter('excuse')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  manageCategoryFilter === 'excuse'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>{isAr ? 'طلبات الأعذار الرسمية' : 'Excuses'}</span>
                <span className="px-1.5 py-0.2 rounded-md bg-white/20 text-[10px]">{visibleExcuses.length}</span>
                {pendingExcCount > 0 && (
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                )}
              </button>

              <button
                onClick={() => setManageCategoryFilter('freeze')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  manageCategoryFilter === 'freeze'
                    ? 'bg-cyan-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <Snowflake className="w-3.5 h-3.5" />
                <span>{isAr ? 'طلبات الفريز والتجميد' : 'Freezes'}</span>
                <span className="px-1.5 py-0.2 rounded-md bg-white/20 text-[10px]">{visibleFreezes.length}</span>
                {pendingFrzCount > 0 && (
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                )}
              </button>
            </div>
          </div>
          {(manageCategoryFilter === 'all' || manageCategoryFilter === 'committee') && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
              <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-100 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <ArrowRightLeft className="w-4 h-4 text-emerald-500" />
                  {isAr ? 'طلبات تغيير ونقل اللجان' : 'Committee Transfer Requests'}
                </span>
                <span className="text-xs text-slate-400 font-mono font-bold">
                  {visibleCommitteeChanges.length}
                </span>
              </h3>

              {visibleCommitteeChanges.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">{isAr ? 'لا توجد طلبات تغيير لجان مطابقة حالياً.' : 'No committee transfer requests found.'}</p>
              ) : (
                <div className="space-y-3">
                  {visibleCommitteeChanges.map((commReq) => (
                    <div
                      key={commReq.id}
                      className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-1.5 text-start">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-[9px] font-bold">
                            {isAr ? 'طلب نقل لجنة' : 'Transfer'}
                          </span>
                          <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                            {commReq.memberName}
                          </h4>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {new Date(commReq.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs font-black text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 w-fit">
                          <span className="text-amber-600 dark:text-amber-400">{commReq.currentCommittee}</span>
                          <ArrowRightLeft className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-emerald-600 dark:text-emerald-400">{commReq.targetCommittee} {commReq.targetDepartment && commReq.targetDepartment !== 'None' ? `(${commReq.targetDepartment})` : ''}</span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300">{commReq.reason}</p>
                        {commReq.adminResponse && (
                          <p className="text-[11px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 p-2 rounded-xl border border-amber-200 dark:border-amber-800/40 mt-1">
                            💬 <strong>{isAr ? 'رد الإدارة:' : 'Admin Note:'}</strong> {commReq.adminResponse}
                          </p>
                        )}
                      </div>

                      <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0">
                        {getStatusBadge(commReq.status)}

                        {commReq.status === 'Pending' && (
                          canApproveRequest(commReq.memberId) ? (
                            <button
                              onClick={() => setSelectedRequest({ type: 'committee', item: commReq })}
                              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] shadow-sm cursor-pointer"
                            >
                              {isAr ? 'مراجعة وقبول / رفض' : 'Review'}
                            </button>
                          ) : (
                            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-lg border border-amber-200 dark:border-amber-800">
                              🔒 {isAr ? 'يتطلب موافقة القادة أو الإدارة' : 'Leader / Admin Approval Required'}
                            </span>
                          )
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {(manageCategoryFilter === 'all' || manageCategoryFilter === 'excuse') && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
              <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-100 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-500" />
                  {isAr ? 'طلبات الأعذار الرسمية' : 'Excuse Requests'}
                </span>
                <span className="text-xs text-slate-400 font-mono font-bold">
                  {visibleExcuses.length}
                </span>
              </h3>

              {visibleExcuses.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">{isAr ? 'لا توجد طلبات أعذار مطابقة حالياً.' : 'No excuse requests found.'}</p>
              ) : (
                <div className="space-y-3">
                  {visibleExcuses.map((exc) => (
                    <div
                      key={exc.id}
                      className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-1.5 text-start">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-[9px] font-bold">
                            {exc.type === 'Meeting' ? (isAr ? 'اجتماع' : 'Meeting') : exc.type === 'Task' ? (isAr ? 'تاسك' : 'Task') : (isAr ? 'عام' : 'General')}
                          </span>
                          <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                            {exc.memberName} ({exc.committee})
                          </h4>
                          <span className="text-[10px] text-slate-400 font-mono">{exc.date}</span>
                        </div>
                        {exc.targetTitle && (
                          <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">{exc.targetTitle}</p>
                        )}
                        <p className="text-xs text-slate-600 dark:text-slate-300">{exc.reason}</p>
                        {exc.adminResponse && (
                          <p className="text-[11px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 p-2 rounded-xl border border-amber-200 dark:border-amber-800/40 mt-1">
                            💬 <strong>{isAr ? 'رد الإدارة:' : 'Admin Note:'}</strong> {exc.adminResponse}
                          </p>
                        )}
                      </div>

                      <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0">
                        {getStatusBadge(exc.status)}

                        {exc.status === 'Pending' && (
                          canApproveRequest(exc.memberId) ? (
                            <button
                              onClick={() => setSelectedRequest({ type: 'excuse', item: exc })}
                              className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] shadow-sm cursor-pointer"
                            >
                              {isAr ? 'مراجعة واتخاذ قرار' : 'Review'}
                            </button>
                          ) : (
                            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-lg border border-amber-200 dark:border-amber-800">
                              🔒 {isAr ? 'يتطلب موافقة مسئول HR أو النائب' : 'Requires HEAD HR / Vice Approval'}
                            </span>
                          )
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {(manageCategoryFilter === 'all' || manageCategoryFilter === 'freeze') && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
              <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-100 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Snowflake className="w-4 h-4 text-cyan-500" />
                  {isAr ? 'طلبات الفريز وتجميد النشاط' : 'Freeze Requests'}
                </span>
                <span className="text-xs text-slate-400 font-mono font-bold">
                  {visibleFreezes.length}
                </span>
              </h3>

              {visibleFreezes.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">{isAr ? 'لا توجد طلبات فريز مطابقة حالياً.' : 'No freeze requests found.'}</p>
              ) : (
                <div className="space-y-3">
                  {visibleFreezes.map((frz) => (
                    <div
                      key={frz.id}
                      className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-1.5 text-start">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-md bg-cyan-100 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 text-[9px] font-bold">
                            {isAr ? 'تجميد نشاط' : 'Freeze'}
                          </span>
                          <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                            {frz.memberName} ({frz.committee})
                          </h4>
                        </div>
                        <p className="text-xs font-semibold text-cyan-600 dark:text-cyan-400">
                          🗓️ {isAr ? 'المدة:' : 'Period:'} {frz.startDate} ➔ {frz.endDate}
                        </p>
                        <p className="text-xs text-slate-600 dark:text-slate-300">{frz.reason}</p>
                        {frz.adminResponse && (
                          <p className="text-[11px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 p-2 rounded-xl border border-amber-200 dark:border-amber-800/40 mt-1">
                            💬 <strong>{isAr ? 'رد الإدارة:' : 'Admin Note:'}</strong> {frz.adminResponse}
                          </p>
                        )}
                      </div>

                      <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0">
                        {getStatusBadge(frz.status)}

                        {frz.status === 'Pending' && (
                          canApproveRequest(frz.memberId) ? (
                            <button
                              onClick={() => setSelectedRequest({ type: 'freeze', item: frz })}
                              className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] shadow-sm cursor-pointer"
                            >
                              {isAr ? 'مراجعة واتخاذ قرار' : 'Review'}
                            </button>
                          ) : (
                            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-lg border border-amber-200 dark:border-amber-800">
                              🔒 {isAr ? 'يتطلب موافقة مسئول HR أو النائب' : 'Requires HEAD HR / Vice Approval'}
                            </span>
                          )
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'activity' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 space-y-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <span>📜 {isAr ? 'سجل أنشطة وتحركات الكيان اللحظي (Live Activity Audit Log)' : 'Live Activity Audit Log'}</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5 font-semibold">
                {isAr ? 'سجل زمني حي يُسجل كافة العمليات التي يقوم بها الأعضاء والقادة والإدارة.' : 'Real-time timeline tracking actions by members, leaders, and administration.'}
              </p>
            </div>
            <div className="relative w-full sm:w-64">
              <input
                type="text"
                value={activitySearch}
                onChange={e => setActivitySearch(e.target.value)}
                placeholder={isAr ? 'ابحث باسم العضو، الإجراء، التفاصيل...' : 'Search logs...'}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-white focus:outline-none"
              />
            </div>
          </div>

          {logs.filter(l => {
            if (!activitySearch.trim()) return true;
            const q = activitySearch.toLowerCase();
            return l.userName?.toLowerCase().includes(q) || l.action?.toLowerCase().includes(q) || l.details?.toLowerCase().includes(q);
          }).length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-12">{isAr ? 'لا توجد أنشطة مسجلة تفي بالبحث.' : 'No activity logs matching search.'}</p>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
              {logs.filter(l => {
                if (!activitySearch.trim()) return true;
                const q = activitySearch.toLowerCase();
                return l.userName?.toLowerCase().includes(q) || l.action?.toLowerCase().includes(q) || l.details?.toLowerCase().includes(q);
              }).map(log => (
                <div key={log.id} className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 text-[10px] font-black">
                        {log.action}
                      </span>
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100">{log.userName}</span>
                      <span className="text-[9px] font-mono font-bold bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-1.5 py-0.2 rounded">
                        {log.userRole}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">{log.details}</p>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono shrink-0">
                    {new Date(log.timestamp).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Admin Review Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800 space-y-4 shadow-2xl">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-blue-500" />
              <span>{isAr ? 'مراجعة الطلب واتخاذ القرار الإداري' : 'Review & Admin Decision'}</span>
            </h3>

            <div className="bg-slate-50 dark:bg-slate-850 p-3 rounded-2xl text-xs space-y-1">
              <p className="font-bold text-slate-800 dark:text-slate-200">
                {selectedRequest.item.memberName} {selectedRequest.type === 'committee' ? `(طلب نقل: من ${selectedRequest.item.currentCommittee} إلى ${selectedRequest.item.targetCommittee})` : `— ${selectedRequest.item.committee}`}
              </p>
              {selectedRequest.type === 'excuse' && selectedRequest.item.targetTitle && (
                <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                  {selectedRequest.item.type === 'Meeting' ? '🏛️ اجتماع:' : selectedRequest.item.type === 'Task' ? '🎯 تكليف:' : '📌'} {selectedRequest.item.targetTitle} ({selectedRequest.item.date})
                </p>
              )}
              <p className="text-slate-600 dark:text-slate-400">{selectedRequest.item.reason}</p>
            </div>

            {selectedRequest.type === 'excuse' && (
              <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-[11px] text-amber-800 dark:text-amber-300 font-semibold space-y-0.5">
                <p>⚖️ <strong>{isAr ? 'تأثير القرار على التقييم (AVG):' : 'Scoring Impact:'}</strong></p>
                <p>{isAr ? '• الموافقة: يُمنح العضو نصف درجة التقييم (50%) ويوثق كمعذور في سجل الحضور.' : '• Approve: Member earns 50% points and marked as excused in attendance.'}</p>
                <p>{isAr ? '• الرفض: يُحتسب الاجتماع/التكليف ويحصل العضو على (0) درجة.' : '• Reject: Member earns 0 points for this item.'}</p>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                {isAr ? 'ملاحظات الإدارة للطلب (اختياري)' : 'Admin Comment/Notes'}
              </label>
              <input
                type="text"
                value={adminNote}
                onChange={e => setAdminNote(e.target.value)}
                placeholder={isAr ? 'مثال: تم قبول العذر / تم رفض الطلب لعدم وجود سبب كافٍ' : 'Enter note...'}
                className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 p-3 text-xs font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setSelectedRequest(null)}
                className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>

              <button
                onClick={() => handleAdminDecision('Rejected')}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs flex items-center gap-1 cursor-pointer"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>{isAr ? 'رفض الطلب' : 'Reject'}</span>
              </button>

              <button
                onClick={() => handleAdminDecision('Approved')}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 cursor-pointer shadow-md shadow-emerald-600/20"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{isAr ? 'موافقة وتفعيل' : 'Approve'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
