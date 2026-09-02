import React, { useState, useMemo, useEffect } from 'react';
import { db } from '../db/localDb';
import { UserProfile, OrganizationSettings, UserRole, UserStatus, COMMITTEE_STRUCTURE, EGYPTIAN_GOVERNORATES, generateGovernorateLeaderCode, UpdatableProfileField, ProfileUpdateRequest } from '../types';
import {
  Settings, Shield, Bell, HardDrive, Save, Users, Trash2,
  Search, ChevronDown, UserCheck, UserX, Crown, AlertTriangle,
  CheckCircle, XCircle, Filter, RefreshCw, Mail, Send, Edit3,
  Database, FileText, CheckSquare, Activity, Sliders, Key, X,
  Lock, ArrowRight, Download, Sparkles, Cake, RotateCcw,
  User, Phone, Building2, Layers, Check, Square
} from 'lucide-react';
import { useLanguage } from '../lib/LanguageContext';
import { getEmailQueue, retryQueuedEmails, clearEmailQueue, QueuedEmail } from '../lib/emailService';
import { sendTestPushNotification } from '../lib/pushNotifications';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { matchesSearch } from '../lib/searchUtils';

interface SettingsPanelProps {
  currentUser: UserProfile;
  onNavigateToView?: (view: string, targetId?: string) => void;
}

const ROLE_COLORS: Record<string, string> = {
  'Super Admin': 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800/60',
  'Vice': 'bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800/60',
  'Coordinator': 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800/60',
  'Deputy Coordinator': 'bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800/60',
  'Leader': 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/60',
  'Member': 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700',
};

const STATUS_COLORS: Record<string, string> = {
  'Active': 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/60',
  'Inactive': 'bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  'Disabled': 'bg-red-100 text-red-800 border-red-300 dark:bg-red-950/50 dark:text-red-300 dark:border-red-800/60',
  'Pending Approval': 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/60',
};

const AVAILABLE_UPDATE_FIELDS: { id: UpdatableProfileField; titleAr: string; descAr: string; icon: any }[] = [
  { id: 'fullName', titleAr: 'الاسم الكامل', descAr: 'تأكيد وكتابة الاسم الثلاثي الرسمي', icon: User },
  { id: 'phoneNumber', titleAr: 'رقم الهاتف / الواتساب', descAr: 'رقم هاتف مصري متاح للتواصل والمتابعة', icon: Phone },
  { id: 'committee', titleAr: 'اللجنة التابع لها', descAr: 'تسكين وتأكيد اللجنة الرئيسية (HR, PR, SM, OR)', icon: Building2 },
  { id: 'department', titleAr: 'اللجنة الفرعية / القسم', descAr: 'تسكين القسم التخصصي واللجنة الفرعية', icon: Layers },
  { id: 'email', titleAr: 'البريد الإلكتروني', descAr: 'البريد الإلكتروني المعتمد لاستلام الإشعارات', icon: Mail },
];

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ currentUser, onNavigateToView }) => {
  const { language, isRtl } = useLanguage();
  const ar = language === 'ar';
  const [activeTab, setActiveTab] = useState<'members' | 'update-requests' | 'config' | 'master' | 'logs' | 'security-codes'>('members');
  const [settings, setSettings] = useState<OrganizationSettings>(db.getSettings());
  const [isSaved, setIsSaved] = useState(false);

  // Profile Update Requests State
  const [targetScope, setTargetScope] = useState<'all' | 'committee' | 'specific'>('specific');
  const [targetCommittee, setTargetCommittee] = useState('HR');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [requestedFields, setRequestedFields] = useState<UpdatableProfileField[]>([
    'phoneNumber',
    'department'
  ]);
  const [updateMessage, setUpdateMessage] = useState('');
  const [reqTableSearch, setReqTableSearch] = useState('');
  const [reqTableCommFilter, setReqTableCommFilter] = useState('all');
  const [onlyMissingFilter, setOnlyMissingFilter] = useState(false);
  const [isSendingRequest, setIsSendingRequest] = useState(false);

  // Security Codes Sheet State
  const [secSearch, setSecSearch] = useState('');
  const [secRoleFilter, setSecRoleFilter] = useState('all');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [showAddSecModal, setShowAddSecModal] = useState(false);
  const [newSecGovVal, setNewSecGovVal] = useState('الغربية');
  const [newSecCodeVal, setNewSecCodeVal] = useState('');
  const [newSecNameVal, setNewSecNameVal] = useState('');
  const [newSecRoleVal, setNewSecRoleVal] = useState<UserRole>('Leader');
  const [newSecCommVal, setNewSecCommVal] = useState('HR');
  const [newSecDeptVal, setNewSecDeptVal] = useState('HRM');

  // Members management state
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [committeeFilter, setCommitteeFilter] = useState<string>('all');
  const [subCommitteeFilter, setSubCommitteeFilter] = useState<string>('all');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{ msg: string; ok: boolean } | null>(null);

  // Full User Edit Modal State
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('Member');
  const [editStatus, setEditStatus] = useState<UserStatus>('Active');
  const [editCommittee, setEditCommittee] = useState('HR');
  const [editDepartment, setEditDepartment] = useState('HRM');
  const [editSubCommittee, setEditSubCommittee] = useState('HR OF OR');
  const [editCode, setEditCode] = useState('');
  const [editDob, setEditDob] = useState('');

  // Lock body scroll when any modal is open so it's always locked directly in the viewport
  useEffect(() => {
    if (editingUser || showAddSecModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [editingUser, showAddSecModal]);

  // Logs search state
  const [logSearch, setLogSearch] = useState('');

  // One-time local→Supabase sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResults, setSyncResults] = useState<{ name: string; ok: boolean; msg: string }[] | null>(null);

  // Refresh counter: increment to force UI re-render after data mutations
  const [refreshKey, setRefreshKey] = useState(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const allUsers = useMemo(() => db.getUsers(currentUser), [refreshKey, currentUser]);
  const logs = useMemo(() => db.getLogs(), [refreshKey]);
  const tasks = db.getTasks();
  const submissions = db.getSubmissions();

  // Email delivery queue
  const [emailQueue, setEmailQueue] = useState<QueuedEmail[]>(getEmailQueue());
  const [retrying, setRetrying] = useState(false);

  const refreshQueue = () => setEmailQueue(getEmailQueue());

  const handleRetryQueue = async () => {
    setRetrying(true);
    const res = await retryQueuedEmails();
    setRetrying(false);
    refreshQueue();
    showFeedback(
      ar
        ? `تم إعادة إرسال ${res.sent} إيميل${res.stillFailed > 0 ? ` (${res.stillFailed} ما زال فاشل)` : ''}`
        : `Retried queue: ${res.sent} sent${res.stillFailed > 0 ? `, ${res.stillFailed} still failed` : ''}`,
      res.sent > 0
    );
  };

  const handleClearQueue = () => {
    if (!confirm(ar ? 'هل تريد فعلاً إفراغ قائمة الانتظار؟' : 'Clear the entire email queue?')) return;
    clearEmailQueue();
    refreshQueue();
  };

  const [isAuditing, setIsAuditing] = useState(false);

  const handleAutoAuditProfiles = async () => {
    setIsAuditing(true);
    try {
      const res = await db.autoAuditAndFixProfiles();
      showFeedback(
        ar
          ? `✅ تم فحص وتحديث قاعدة البيانات: (${res.fixedEventsCount} تصحيح لجان، ${res.generatedCodesCount} توليد أكواد عضوية، ${res.notifiedNoCommitteeCount} إشعار لغير المسكنين، ${res.notifiedIncompleteCount} إشعار استكمال بيانات)`
          : `✅ Audit completed: (${res.fixedEventsCount} fixed, ${res.generatedCodesCount} codes generated, ${res.notifiedNoCommitteeCount} unassigned notified, ${res.notifiedIncompleteCount} incomplete notified)`,
        true
      );
      setRefreshKey(k => k + 1);
    } catch (e: any) {
      showFeedback(e?.message || 'حدث خطأ أثناء الفحص والتحديث', false);
    } finally {
      setIsAuditing(false);
    }
  };

  const filtered = useMemo(() => {
    return allUsers.filter(u => {
      const matchSearch = matchesSearch([
        u?.fullName,
        u?.email,
        u?.phoneNumber,
        u?.membershipCode,
        u?.committee,
        u?.department,
        u?.role,
        u?.governorate
      ], search);

      const matchRole = roleFilter === 'all' || u.role === roleFilter;
      const matchStatus = statusFilter === 'all' || u.status === statusFilter;
      const isHrm = committeeFilter === 'HR' || committeeFilter === 'HRM';
      const matchComm = committeeFilter === 'all' || u.committee === committeeFilter || (isHrm && (u.committee === 'HR' || u.committee === 'HRM'));
      
      let matchSub = true;
      if (isHrm && subCommitteeFilter !== 'all') {
        const sub = subCommitteeFilter.toLowerCase();
        matchSub = (u.department || '').toLowerCase().includes(sub) || ((u as any).subCommittee || '').toLowerCase().includes(sub);
      }

      return matchSearch && matchRole && matchStatus && matchComm && matchSub;
    });
  }, [allUsers, search, roleFilter, statusFilter, committeeFilter, subCommitteeFilter]);

  // Profile Update Requests - Audit missing fields helper
  const getMissingFieldsForUser = (u: UserProfile) => {
    const isNameBad = !u.fullName || !u.fullName.trim().includes(' ') || /\d/.test(u.fullName);
    const isPhoneBad = !u.phoneNumber || u.phoneNumber.trim() === '+201000000000' || u.phoneNumber.trim().length < 10;
    const isCommBad = !u.committee || u.committee === 'None' || u.committee === 'General' || !['HR', 'PR', 'SM', 'OR'].includes(u.committee);
    const isDeptBad = !u.department || u.department === 'None' || u.department === 'Events' || u.department === 'General';
    const isEmailBad = !u.email || !u.email.includes('@') || !u.email.includes('.');

    const list: { field: UpdatableProfileField; label: string; isMissing: boolean }[] = [
      { field: 'fullName', label: 'الاسم', isMissing: isNameBad },
      { field: 'phoneNumber', label: 'رقم الهاتف', isMissing: isPhoneBad },
      { field: 'committee', label: 'اللجنة', isMissing: isCommBad },
      { field: 'department', label: 'القسم / الفرع', isMissing: isDeptBad },
      { field: 'email', label: 'البريد الإلكتروني', isMissing: isEmailBad },
    ];
    const missingOnly = list.filter(item => item.isMissing);
    return {
      all: list,
      missing: missingOnly,
      hasMissing: missingOnly.length > 0,
    };
  };

  // Filtered members for the Profile Update Requests selection table
  const reqTableFilteredUsers = useMemo(() => {
    return allUsers.filter(u => {
      if (u.status !== 'Active') return false;
      const matchSearch = matchesSearch([u.fullName, u.membershipCode, u.phoneNumber, u.email, u.committee, u.department], reqTableSearch);
      const isHrm = reqTableCommFilter === 'HR' || reqTableCommFilter === 'HRM';
      const matchComm = reqTableCommFilter === 'all' || u.committee === reqTableCommFilter || (isHrm && (u.committee === 'HR' || u.committee === 'HRM'));
      if (!matchSearch || !matchComm) return false;

      if (onlyMissingFilter) {
        const audit = getMissingFieldsForUser(u);
        return audit.hasMissing;
      }
      return true;
    });
  }, [allUsers, reqTableSearch, reqTableCommFilter, onlyMissingFilter]);

  const handleSendProfileUpdateRequest = async () => {
    if (requestedFields.length === 0) {
      showFeedback(ar ? 'يرجى اختيار حقل واحد على الأقل مطلوب تحديثه!' : 'Please select at least one field to update!', false);
      return;
    }

    if (targetScope === 'specific' && selectedUserIds.length === 0) {
      showFeedback(ar ? 'يرجى تحديد عضو واحد على الأقل لإرسال طلب التحديث إليه!' : 'Please select at least one member!', false);
      return;
    }

    setIsSendingRequest(true);
    try {
      const created = db.createProfileUpdateRequest({
        targetScope,
        targetCommittee: targetScope === 'committee' ? targetCommittee : undefined,
        targetUserIds: targetScope === 'specific' ? selectedUserIds : [],
        requestedFields,
        message: updateMessage.trim() || undefined,
        createdBy: currentUser.id,
        createdByName: currentUser.fullName,
      }, currentUser);

      showFeedback(
        ar
          ? `تم إرسال طلب تحديث البيانات لـ (${created.targetUserIds.length}) عضو بنجاح! 🚀`
          : `Profile update request sent to ${created.targetUserIds.length} members! 🚀`,
        true
      );
      setSelectedUserIds([]);
      setUpdateMessage('');
      setRefreshKey(k => k + 1);
    } catch (err: any) {
      showFeedback(err?.message || (ar ? 'حدث خطأ أثناء الإرسال' : 'Failed to send request'), false);
    } finally {
      setIsSendingRequest(false);
    }
  };

  const handleCancelProfileUpdateRequest = (reqId: string) => {
    if (!confirm(ar ? 'هل أنت متأكد من إلغاء هذا الطلب وسحبه من عند الأعضاء؟' : 'Are you sure you want to cancel this request?')) return;
    db.cancelProfileUpdateRequest(reqId, currentUser);
    showFeedback(ar ? 'تم إلغاء الطلب بنجاح.' : 'Request cancelled.', true);
    setRefreshKey(k => k + 1);
  };

  const filteredLogs = useMemo(() => {
    if (!logSearch) return logs;
    return logs.filter(l => matchesSearch([l?.userName, l?.action, l?.details], logSearch));
  }, [logs, logSearch]);

  const showFeedback = (msg: string, ok: boolean) => {
    setActionFeedback({ msg, ok });
    setTimeout(() => setActionFeedback(null), 5000);
  };

  const handleDelete = (userId: string) => {
    if (userId === currentUser.id) {
      showFeedback(ar ? 'لا يمكنك حذف حسابك الخاص!' : 'You cannot delete your own account!', false);
      setConfirmDeleteId(null);
      return;
    }
    const ok = db.deleteUser(userId, currentUser);
    if (ok) {
      showFeedback(ar ? 'تم حذف العضو بنجاح.' : 'Member removed successfully.', true);
      setRefreshKey(k => k + 1);
    }
    else showFeedback(ar ? 'فشل الحذف.' : 'Delete failed.', false);
    setConfirmDeleteId(null);
  };

  const handleStatusChange = async (userId: string, status: UserStatus) => {
    db.updateUserStatus(userId, status, currentUser);
    // Explicit Supabase safety-net: ensure the status change is persisted
    if (isSupabaseConfigured) {
      try {
        await supabase.from('profiles').update({ status }).eq('id', userId);
      } catch (err) {
        console.error('[SettingsPanel] Supabase status update failed:', err);
      }
    }
    showFeedback(
      ar ? `تم تغيير الحالة إلى ${status}.` : `Status changed to ${status}.`,
      true
    );
    setRefreshKey(k => k + 1);
  };

  const handleRoleChange = async (userId: string, role: UserRole) => {
    if (userId === currentUser.id) {
      showFeedback(ar ? 'لا يمكنك تغيير دورك الخاص!' : 'You cannot change your own role!', false);
      return;
    }
    db.updateUserRole(userId, role, currentUser);
    // Explicit Supabase safety-net: ensure the role change is persisted
    if (isSupabaseConfigured) {
      try {
        await supabase.from('profiles').update({ role }).eq('id', userId);
      } catch (err) {
        console.error('[SettingsPanel] Supabase role update failed:', err);
      }
    }
    showFeedback(
      ar ? `تم تغيير الدور إلى ${role}.` : `Role changed to ${role}.`,
      true
    );
    setRefreshKey(k => k + 1);
  };

  // Open Full Master Edit Modal for a user
  const handleOpenMasterEdit = (user: UserProfile) => {
    setEditingUser(user);
    setEditFullName(user.fullName);
    setEditEmail(user.email);
    setEditPhone(user.phoneNumber || '');
    setEditRole(user.role);
    setEditStatus(user.status);
    setEditCommittee(user.committee || 'HR');
    setEditDepartment(user.department || 'HRM');
    setEditSubCommittee(user.subCommittee || 'HR OF OR');
    setEditCode(user.membershipCode || '');
    setEditDob(user.dateOfBirth || '');
  };

  // Save Full Master Edit
  const handleSaveMasterEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    const updatedFields = {
      fullName: editFullName,
      email: editEmail,
      phoneNumber: editPhone,
      role: editRole,
      status: editStatus,
      committee: editCommittee,
      department: editDepartment,
      subCommittee: editCommittee === 'HRM' || editCommittee === 'HR' || editDepartment.startsWith('HRM') ? editSubCommittee : '',
      membershipCode: editCode,
      dateOfBirth: editDob,
    };

    db.updateUserFullDetails(
      editingUser.id,
      updatedFields,
      currentUser
    );

    if (editDob) {
      db.updateUserDateOfBirth(editingUser.id, editDob);
    }

    // Explicit Supabase safety-net: ensure all field changes are persisted
    if (isSupabaseConfigured) {
      try {
        const row: Record<string, any> = {};
        if (updatedFields.fullName) row.full_name = updatedFields.fullName;
        if (updatedFields.email) row.email = updatedFields.email;
        if (updatedFields.phoneNumber) row.phone_number = updatedFields.phoneNumber;
        if (updatedFields.role) row.role = updatedFields.role;
        if (updatedFields.status) row.status = updatedFields.status;
        if (updatedFields.committee) row.committee = updatedFields.committee;
        if (updatedFields.department) row.department = updatedFields.department;
        if (updatedFields.subCommittee !== undefined) row.sub_committee = updatedFields.subCommittee;
        if (updatedFields.membershipCode) row.membership_code = updatedFields.membershipCode;
        if (updatedFields.dateOfBirth) row.date_of_birth = updatedFields.dateOfBirth;
        await supabase.from('profiles').update(row).eq('id', editingUser.id);
      } catch (err) {
        console.error('[SettingsPanel] Supabase master edit update failed:', err);
      }
    }

    setEditingUser(null);
    showFeedback(ar ? 'تم تحديث كافة بيانات العضو بنجاح!' : 'User full profile updated successfully!', true);
    setRefreshKey(k => k + 1);
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    db.updateSettings(settings, currentUser);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 1500);
  };

  // ─── One-time local → Supabase sync ───────────────────────────────────
  const syncLocalToSupabase = async () => {
    if (!isSupabaseConfigured) {
      showFeedback('Supabase not configured.', false);
      return;
    }
    setIsSyncing(true);
    setSyncResults(null);

    const users = db.getUsers();
    const results: { name: string; ok: boolean; msg: string }[] = [];

    for (const user of users) {
      try {
        const row: Record<string, any> = {};
        if (user.role)         row.role           = user.role;
        if (user.status)       row.status         = user.status;
        if (user.committee)    row.committee      = user.committee;
        if (user.department)   row.department     = user.department;
        if (user.subCommittee !== undefined) row.sub_committee = user.subCommittee;
        if (user.fullName)     row.full_name      = user.fullName;
        if (user.phoneNumber)  row.phone_number   = user.phoneNumber;
        if (user.membershipCode) row.membership_code = user.membershipCode;
        if (user.dateOfBirth)  row.date_of_birth  = user.dateOfBirth;
        if (user.governorate)  row.governorate    = user.governorate;

        const { error } = await supabase
          .from('profiles')
          .update(row)
          .eq('id', user.id);

        if (error) {
          results.push({ name: user.fullName, ok: false, msg: error.message });
        } else {
          results.push({ name: user.fullName, ok: true, msg: `${user.role} / ${user.committee} / ${user.status}` });
        }
      } catch (err: any) {
        results.push({ name: user.fullName, ok: false, msg: err?.message || 'Unknown error' });
      }
    }

    setSyncResults(results);
    setIsSyncing(false);

    const ok = results.filter(r => r.ok).length;
    const fail = results.filter(r => !r.ok).length;
    showFeedback(
      `Sync complete: ✅ ${ok} updated, ❌ ${fail} failed out of ${users.length} members.`,
      fail === 0
    );
  };

  // Export JSON Database Backup
  const handleExportDataBackup = () => {
    const backupData = {
      users: db.getUsers(),
      tasks: db.getTasks(),
      submissions: db.getSubmissions(),
      announcements: db.getAnnouncements(),
      videoTasks: db.getVideoTasks(),
      settings: db.getSettings(),
      exportedAt: new Date().toISOString(),
      exportedBy: currentUser.fullName,
    };
    const jsonStr = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `eye_workflow_backup_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showFeedback(ar ? 'تم تصدير نسخة احتياطية من قاعدة البيانات بنجاح 💾' : 'Database backup exported successfully 💾', true);
  };

  const handleElevateToVIPSuperAdmin = async () => {
    if (!currentUser) return;
    try {
      db.updateProfile(currentUser.id, {
        role: 'Super Admin',
        status: 'Active',
        committee: 'All',
        bio: '👑 الحساب المالي والتنفيذي المميز للمشرف العام على المنصة | كامل الصلاحيات والتحكم الشامل 👑',
      }, currentUser);

      if (isSupabaseConfigured) {
        await supabase
          .from('profiles')
          .update({
            user_role: 'Super Admin',
            status: 'Active',
            committee: 'All',
          })
          .eq('id', currentUser.id);
      }

      showFeedback(
        ar
          ? '🎉 تم ترقية وتأكيد حسابك كـ (Super Admin VIP) بنجاح! يمتلك حسابك الآن صلاحية كاملة وغير محدودة على كل شيء بالمنصة.'
          : '🎉 Your account has been promoted to VIP Super Admin with full master access!',
        true
      );
      setTimeout(() => {
        window.location.reload();
      }, 1400);
    } catch (err: any) {
      showFeedback(err?.message || (ar ? 'حدث خطأ أثناء الترقية' : 'Failed to promote account'), false);
    }
  };

  const handleCopySecCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    showFeedback(ar ? `تم نسخ الكود (${code}) إلى الحافظة بنجاح! 📋` : `Code (${code}) copied to clipboard! 📋`, true);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  const handleExportSecurityCodesCSV = () => {
    const codesMap = db.getAllSecurityCodes();
    const rows = [
      ['الكود الأمني (Security Code)', 'الاسم / المنصب المستهدف (Target Person)', 'الدور / المستوى الوظيفي (Role)', 'اللجنة (Committee)', 'القسم / الفرع (Department)', 'البريد (Email)']
    ];
    Object.entries(codesMap).forEach(([code, details]: [string, any]) => {
      rows.push([
        code,
        details.fullName || '-',
        details.role || '-',
        details.committee || '-',
        details.department || '-',
        details.email || '-'
      ]);
    });

    const csvContent = "\uFEFF" + rows.map(r => r.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `شيت_أكواد_التحقق_الأمني_للمناصب_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showFeedback(ar ? 'تم تصدير شيت أكواد التحقق الأمني بنجاح 📋' : 'Security codes sheet exported successfully 📋', true);
  };

  const handleSaveNewSecurityCode = () => {
    if (!newSecCodeVal.trim()) {
      showFeedback(ar ? 'يرجى كتابة كود التحقق الأمني' : 'Please enter security code', false);
      return;
    }
    db.addCustomSecurityCode(
      newSecCodeVal.trim(),
      newSecNameVal.trim() || 'مسؤول جديد',
      newSecRoleVal,
      newSecCommVal,
      newSecDeptVal,
      newSecGovVal
    );
    showFeedback(ar ? `تم إنشاء وإضافة الكود الأمني (${newSecCodeVal.trim().toUpperCase()}) لـ محافظة ${newSecGovVal} بنجاح! 🎉` : 'New governorate security code added successfully!', true);
    setShowAddSecModal(false);
    setNewSecCodeVal('');
    setNewSecNameVal('');
  };

  const handleExportMembersCSV = () => {
    const rows = [
      ['الاسم الكامل', 'رقم التواصل (الرقم المسجل)', 'البريد الإلكتروني', 'الدور / المنصب', 'الحالة', 'اللجنة الرئيسية', 'القسم / الفرع', 'كود العضوية', 'المحافظة', 'تاريخ الانضمام']
    ];
    allUsers.forEach((u) => {
      rows.push([
        u.fullName || '-',
        u.phoneNumber || '-',
        u.email || '-',
        u.role || '-',
        u.status || '-',
        u.committee || '-',
        u.department || '-',
        u.membershipCode || '-',
        u.governorate || 'الغربية',
        u.joinedDate || '-'
      ]);
    });

    const csvContent = "\uFEFF" + rows.map(r => r.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `كشف_بيانات_الأعضاء_ورقم_التواصل_المسجل_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showFeedback(ar ? 'تم تصدير كشف الأعضاء متضمناً رقم التواصل المسجل بنجاح 📋' : 'Exported members list with registered contact numbers! 📋', true);
  };

  const handleResetAllPoints = async () => {
    if (!confirm(ar ? 'هل أنت متأكد من تصفير كافة النقاط والبونص لجميع أعضاء الكيان؟ سيتم تعيين رصيد الجميع إلى 0 نقطة.' : 'Are you sure you want to reset all points and bonuses to 0 for all members?')) return;
    const ok = await db.resetAllUsersPoints(currentUser);
    setRefreshKey(k => k + 1);
    showFeedback(
      ok
        ? (ar ? 'تم تصفير جميع نقاط وبونص الأعضاء بنجاح! رصيد الجميع الآن 0 Pts 🎯' : 'Successfully reset all points and bonuses to 0!')
        : (ar ? 'حدث خطأ أثناء تصفير النقاط' : 'Failed to reset points'),
      ok
    );
  };

  const ALL_ROLES: UserRole[] = ['Member', 'Leader', 'Deputy Coordinator', 'Coordinator', 'Vice', 'Head', 'Super Admin'];
  const ALL_STATUSES: UserStatus[] = ['Active', 'Pending Approval', 'Disabled'];

  if (!['Super Admin', 'Head', 'Vice', 'HRM'].includes(currentUser.role)) {
    return (
      <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-3xl border border-red-200 dark:border-red-900/40 shadow-xl max-w-lg mx-auto my-12" dir={isRtl ? 'rtl' : 'ltr'}>
        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-black text-slate-900 dark:text-white mb-2">
          {ar ? 'غير مسموح بالوصول' : 'Access Denied'}
        </h2>
        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-6">
          {ar
            ? 'مركز التحكم الشامل وإعدادات الكيان مخصصة حصرياً للمشرفين العامين والإدارة العليا فقط.'
            : 'The Master Control Center & System Settings are exclusively reserved for Executive Leadership (Super Admin, Head, Vice).'}
        </p>
        <button
          onClick={() => onNavigateToView?.('dashboard')}
          className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-xs hover:bg-blue-700 transition-all shadow-md"
        >
          {ar ? 'العودة للرئيسية' : 'Back to Dashboard'}
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 animate-fade-in" id="settings-viewport" dir={isRtl ? 'rtl' : 'ltr'}>

      {/* Top Banner Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 rounded-3xl text-white shadow-xl border border-slate-800 relative overflow-hidden">
        <div className="space-y-1 relative z-10">
          <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-widest">
            <Crown className="w-4 h-4" />
            <span>{ar ? 'مسئول لجنة الموارد البشرية' : 'HR Committee Manager Command Center'}</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black">
            {ar ? 'مركز التحكم الشامل بالمنصة 👑' : 'Master Control & System Settings 👑'}
          </h1>
          <p className="text-xs text-slate-300 font-medium">
            {ar ? 'إدارة الأعضاء والصلاحيات، متابعة العمليات، التحكم بالإعدادات وسجلات المراقبة الكاملة.' : 'Manage members, system configuration, audit logs, and master overrides.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0 relative z-10">
          <button
            onClick={handleAutoAuditProfiles}
            disabled={isAuditing}
            className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-black rounded-2xl text-xs transition-all shadow-md cursor-pointer"
            title={ar ? 'فحص بيانات الأعضاء، توليد الأكواد الناقصة، وإرسال إشعارات التحديث للمستهدفين فقط' : 'Audit profiles, generate missing codes & send targeted notices'}
          >
            {isAuditing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            <span>{isAuditing ? (ar ? 'جاري الفحص والتحديث...' : 'Auditing...') : (ar ? 'فحص وتحديث العضويات تلقائياً ⚡' : 'Auto-Audit & Notify ⚡')}</span>
          </button>

          <button
            onClick={handleResetAllPoints}
            className="flex items-center gap-2 px-4 py-2.5 bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-500/40 rounded-2xl text-xs font-bold transition-all shadow-md cursor-pointer"
            title={ar ? 'تصفير كافة النقاط والبونص للأعضاء' : 'Zero out all points & bonus'}
          >
            <RotateCcw className="w-4 h-4" />
            <span>{ar ? 'تصفير جميع النقاط (0 Pts) 🔄' : 'Reset All Points (0)'}</span>
          </button>

          <button
            onClick={handleExportDataBackup}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-400/30 rounded-2xl text-xs font-bold transition-all shadow-md shrink-0 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>{ar ? 'تصدير نسخة احتياطية (JSON)' : 'Export Backup'}</span>
          </button>
        </div>
      </div>


      {/* Toast Feedback Notification */}
      {actionFeedback && (
        <div className={`p-4 rounded-2xl border text-xs font-bold flex items-center justify-between shadow-lg animate-fade-in ${
          actionFeedback.ok
            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
            : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
        }`}>
          <div className="flex items-center gap-2">
            {actionFeedback.ok ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            <span>{actionFeedback.msg}</span>
          </div>
        </div>
      )}

      {/* Email Queue Banner Alert */}
      {emailQueue.length > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
          <Mail className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-black text-amber-800 dark:text-amber-200">
              {ar ? `⚠️ ${emailQueue.length} إيميل في قائمة الانتظار (لم يُرسل)` : `⚠️ ${emailQueue.length} email(s) queued for delivery`}
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              <button
                onClick={handleRetryQueue}
                disabled={retrying}
                className="flex items-center gap-1.5 text-[10px] font-black px-3 py-1.5 rounded-lg bg-amber-600 text-white hover:bg-amber-700"
              >
                <Send className="w-3 h-3" />
                {retrying ? (ar ? 'جاري الإرسال...' : 'Retrying...') : (ar ? 'إعادة الإرسال الآن' : 'Retry now')}
              </button>
              <button
                onClick={handleClearQueue}
                className="flex items-center gap-1.5 text-[10px] font-black px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-amber-300 text-amber-700 dark:text-amber-300"
              >
                <Trash2 className="w-3 h-3" />
                {ar ? 'إفراغ القائمة' : 'Clear queue'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab('members')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-black transition-all ${
            activeTab === 'members'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>{ar ? 'إدارة الأعضاء والصلاحيات' : 'Members & Roles'}</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
            {allUsers.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('update-requests')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-black transition-all ${
            activeTab === 'update-requests'
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50'
          }`}
        >
          <UserCheck className="w-4 h-4 text-emerald-400" />
          <span>{ar ? 'طلب تحديث بيانات الأعضاء 📝' : 'Profile Update Requests 📝'}</span>
          {db.getProfileUpdateRequests().filter(r => r.status === 'Active').length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500 text-white font-black animate-pulse">
              {db.getProfileUpdateRequests().filter(r => r.status === 'Active').length} {ar ? 'نشط' : 'Active'}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('master')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-black transition-all ${
            activeTab === 'master'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50'
          }`}
        >
          <Sliders className="w-4 h-4 text-amber-400" />
          <span>{ar ? 'غرفة التحكم بالعمليات' : 'Master Command Center'}</span>
        </button>

        <button
          onClick={() => setActiveTab('config')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-black transition-all ${
            activeTab === 'config'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>{ar ? 'إعدادات الكيان' : 'Organization Settings'}</span>
        </button>

        <button
          onClick={() => setActiveTab('logs')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-black transition-all ${
            activeTab === 'logs'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>{ar ? 'سجل الأنشطة والمراقبة' : 'Audit Logs'}</span>
        </button>

        <button
          onClick={() => setActiveTab('security-codes')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-black transition-all ${
            activeTab === 'security-codes'
              ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20 font-bold'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50'
          }`}
        >
          <Key className="w-4 h-4 text-amber-500" />
          <span>{ar ? 'شيت أكواد التحقق الأمني للمناصب' : 'Security Codes Sheet'}</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-100 text-amber-900 font-extrabold">
            {Object.keys(db.getAllSecurityCodes()).length}
          </span>
        </button>
      </div>

      {/* TAB 1: MEMBERS & PERMISSIONS */}
      {activeTab === 'members' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="relative w-full md:w-80">
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={ar ? 'ابحث بالاسم، الإيميل، أو الكود...' : 'Search by name, email, code...'}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-xs font-bold focus:outline-none focus:border-indigo-500"
              />
              <Search className="absolute end-3 top-2.5 w-4 h-4 text-slate-400" />
            </div>

            <div className="flex flex-wrap gap-2 w-full md:w-auto">
              <select
                value={roleFilter}
                onChange={e => setRoleFilter(e.target.value)}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold"
              >
                <option value="all">{ar ? 'جميع المناصب' : 'All Roles'}</option>
                {ALL_ROLES.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold"
              >
                <option value="all">{ar ? 'جميع الحالات' : 'All Statuses'}</option>
                <option value="Active">Active</option>
                <option value="Pending Approval">Pending Approval</option>
                <option value="Disabled">Disabled</option>
              </select>

              <select
                value={committeeFilter}
                onChange={e => {
                  setCommitteeFilter(e.target.value);
                  setSubCommitteeFilter('all');
                }}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold"
              >
                <option value="all">{ar ? 'جميع اللجان' : 'All Committees'}</option>
                {['HR', 'PR', 'SM', 'OR'].map(c => (
                  <option key={c} value={c}>{c === 'HR' ? (ar ? 'الموارد البشرية (HR)' : 'HR Committee') : `${c} Committee`}</option>
                ))}
              </select>

              {(committeeFilter === 'HR' || committeeFilter === 'HRM') && (
                <select
                  value={subCommitteeFilter}
                  onChange={e => setSubCommitteeFilter(e.target.value)}
                  className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 rounded-xl px-3 py-2 text-xs font-bold text-amber-900 dark:text-amber-200 animate-fadeIn"
                >
                  <option value="all">{ar ? '🏢 كل أقسام وفروع HR' : 'All HR Departments'}</option>
                  <option value="HRM">{ar ? 'HRM — إدارة الموارد البشرية' : 'HR Management (HRM)'}</option>
                  <option value="HRD">{ar ? 'HRD — التطوير والتدريب' : 'HR Development (HRD)'}</option>
                  <option value="HRS">{ar ? 'HRS — الدعم والمساندة' : 'HR Support (HRS)'}</option>
                  <option value="HRIS">{ar ? 'HRIS — نظم المعلومات' : 'HR Info Systems (HRIS)'}</option>
                </select>
              )}

              <button
                type="button"
                onClick={() => setActiveTab('update-requests')}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer active:scale-95"
              >
                <UserCheck className="w-3.5 h-3.5 text-emerald-300" />
                <span>{ar ? 'طلب تحديث بيانات الأعضاء 📝' : 'Request Profile Updates 📝'}</span>
              </button>

              <button
                onClick={handleExportMembersCSV}
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{ar ? 'تصدير الأعضاء كـ CSV 📊' : 'Export Members 📊'}</span>
              </button>
            </div>
          </div>

          {/* Members Table */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-start text-xs font-semibold">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider bg-slate-50/50 dark:bg-slate-850">
                    <th className="py-3.5 px-4 text-start">{ar ? 'العضو' : 'Member'}</th>
                    <th className="py-3.5 px-4 text-start">{ar ? 'رقم التواصل (الرقم المسجل)' : 'Contact Phone'}</th>
                    <th className="py-3.5 px-4 text-start">{ar ? 'الكود' : 'Code'}</th>
                    <th className="py-3.5 px-4 text-start">{ar ? 'اللجنة / القسم' : 'Committee / Dept'}</th>
                    <th className="py-3.5 px-4 text-start">{ar ? 'المنصب / الدور' : 'Role'}</th>
                    <th className="py-3.5 px-4 text-start">{ar ? 'الحالة' : 'Status'}</th>
                    <th className="py-3.5 px-4 text-end">{ar ? 'الإجراءات والتحكم' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                  {filtered.map(u => (
                    <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-850 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                        <div className="flex items-center gap-3">
                          <img
                            src={u.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${u.fullName}`}
                            className="w-8 h-8 rounded-full border object-cover cursor-pointer hover:scale-105 transition-transform"
                            alt=""
                            onClick={() => onNavigateToView?.('profile', u.id)}
                          />
                          <div>
                            <div
                              className="cursor-pointer hover:text-eye-brand hover:underline"
                              onClick={() => onNavigateToView?.('profile', u.id)}
                            >
                              {u.fullName}
                            </div>
                            <div className="text-[10px] text-slate-400 font-normal">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[11px] font-bold text-emerald-600 dark:text-emerald-400">{u.phoneNumber || '—'}</td>
                      <td className="py-3.5 px-4 font-mono text-[11px] font-bold text-indigo-600 dark:text-indigo-400">{u.membershipCode}</td>
                      <td className="py-3.5 px-4 font-bold">{u.committee} - {u.department}</td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${ROLE_COLORS[u.role] || ''}`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${STATUS_COLORS[u.status] || ''}`}>
                          {u.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-end">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Quick approve if pending */}
                          {u.status === 'Pending Approval' && (
                            <button
                              onClick={() => handleStatusChange(u.id, 'Active')}
                              className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg text-[10px] font-bold hover:bg-emerald-700"
                            >
                              {ar ? 'تفعيل' : 'Approve'}
                            </button>
                          )}

                          {/* Full Edit Modal trigger */}
                          <button
                            onClick={() => handleOpenMasterEdit(u)}
                            className="p-1.5 bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                            title={ar ? 'تعديل شامل الحقول' : 'Master Edit'}
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">{ar ? 'تعديل' : 'Edit'}</span>
                          </button>

                          {/* Delete user */}
                          {confirmDeleteId === u.id ? (
                            <div className="flex items-center gap-1">
                              <button onClick={() => handleDelete(u.id)} className="px-2 py-1 bg-red-600 text-white rounded text-[10px] font-bold">
                                {ar ? 'تأكيد' : 'Confirm'}
                              </button>
                              <button onClick={() => setConfirmDeleteId(null)} className="px-2 py-1 border rounded text-[10px]">
                                {ar ? 'إلغاء' : 'Cancel'}
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmDeleteId(u.id)}
                              className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg transition-colors"
                              title={ar ? 'حذف العضو' : 'Delete Member'}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}

                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400 font-bold">
                        {ar ? 'لا يوجد أعضاء مطابقين للبحث.' : 'No members found matching filter.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB: PROFILE UPDATE REQUESTS */}
      {activeTab === 'update-requests' && (
        <div className="space-y-6 animate-fade-in">
          
          {/* Main Request Form & Configuration Card */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
            
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-xs uppercase tracking-wider">
                  <UserCheck className="w-4 h-4 text-emerald-500" />
                  <span>{ar ? 'تحديث وتدقيق بيانات العضوية' : 'Member Profile Update & Verification'}</span>
                </div>
                <h2 className="text-xl font-black text-slate-900 dark:text-white">
                  {ar ? 'إرسال طلب تحديث بيانات للأعضاء 📝' : 'Dispatch Profile Update Request 📝'}
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  {ar
                    ? 'يمكنك تحديد أعضاء معينين، أو لجنة كاملة، أو المنصة بأسرها، وتحديد الحقول المطلوبة (الاسم، الهاتف، اللجنة، القسم، الإيميل).'
                    : 'Select target members or committees and choose specific fields to request an update for.'}
                </p>
              </div>

              {/* Status summary pill */}
              <div className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-950/50 p-2.5 rounded-2xl border border-indigo-200 dark:border-indigo-800/60 shrink-0">
                <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <div className="text-xs font-black">
                  <span className="text-slate-500 font-medium block text-[10px]">{ar ? 'الأعضاء المحددين:' : 'Selected:'}</span>
                  <span className="text-indigo-600 dark:text-indigo-400">
                    {targetScope === 'all'
                      ? (ar ? 'جميع أعضاء المنصة' : 'All Members')
                      : targetScope === 'committee'
                      ? (ar ? `لجنة ${targetCommittee}` : `${targetCommittee} Committee`)
                      : `${selectedUserIds.length} ${ar ? 'عضو' : 'members'}`}
                  </span>
                </div>
              </div>
            </div>

            {/* Scope Selection */}
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <span>1. {ar ? 'نطاق الإرسال المستهدف:' : 'Target Scope:'}</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setTargetScope('specific')}
                  className={`p-4 rounded-2xl border-2 text-start transition-all cursor-pointer flex items-start gap-3 ${
                    targetScope === 'specific'
                      ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-950 dark:text-indigo-100 shadow-sm'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full border-2 mt-0.5 flex items-center justify-center shrink-0 ${targetScope === 'specific' ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-400'}`}>
                    {targetScope === 'specific' && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                  <div>
                    <h4 className="text-xs font-black">{ar ? 'أعضاء محددين بالاسم 👤' : 'Specific Members'}</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{ar ? 'اختر الأعضاء من الجدول أدناه بالاسم والكود' : 'Pick members from table below'}</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setTargetScope('committee')}
                  className={`p-4 rounded-2xl border-2 text-start transition-all cursor-pointer flex items-start gap-3 ${
                    targetScope === 'committee'
                      ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-950 dark:text-indigo-100 shadow-sm'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full border-2 mt-0.5 flex items-center justify-center shrink-0 ${targetScope === 'committee' ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-400'}`}>
                    {targetScope === 'committee' && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                  <div>
                    <h4 className="text-xs font-black">{ar ? 'لجنة معينة بالكامل 🏢' : 'Specific Committee'}</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{ar ? 'إرسال لجميع أعضاء لجنة محددة' : 'Send to all committee members'}</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setTargetScope('all')}
                  className={`p-4 rounded-2xl border-2 text-start transition-all cursor-pointer flex items-start gap-3 ${
                    targetScope === 'all'
                      ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-950 dark:text-indigo-100 shadow-sm'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full border-2 mt-0.5 flex items-center justify-center shrink-0 ${targetScope === 'all' ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-400'}`}>
                    {targetScope === 'all' && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                  <div>
                    <h4 className="text-xs font-black">{ar ? 'المنصة بالكامل 🌐' : 'Entire Platform'}</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{ar ? 'تحديث عام لجميع الأعضاء المسجلين' : 'Send to all active members'}</p>
                  </div>
                </button>
              </div>

              {/* Committee dropdown if committee scope */}
              {targetScope === 'committee' && (
                <div className="bg-indigo-50/60 dark:bg-indigo-950/30 p-4 rounded-2xl border border-indigo-200 dark:border-indigo-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn mt-2">
                  <span className="text-xs font-black text-indigo-950 dark:text-indigo-200">
                    {ar ? 'اختر اللجنة المستهدفة بالإرسال:' : 'Select Target Committee:'}
                  </span>
                  <select
                    value={targetCommittee}
                    onChange={e => setTargetCommittee(e.target.value)}
                    className="bg-white dark:bg-slate-800 border-2 border-indigo-300 dark:border-indigo-700 rounded-xl px-4 py-2 text-xs font-bold text-slate-900 dark:text-white"
                  >
                    <option value="HR">{ar ? 'الموارد البشرية (HR)' : 'HR'}</option>
                    <option value="PR">{ar ? 'العلاقات العامة (PR)' : 'PR'}</option>
                    <option value="SM">{ar ? 'السوشيال ميديا (SM)' : 'SM'}</option>
                    <option value="OR">{ar ? 'التنظيم واللوجستيات (OR)' : 'OR'}</option>
                  </select>
                </div>
              )}
            </div>

            {/* Field Chooser */}
            <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <span>2. {ar ? 'ما هي الحقول المطلوب من الأعضاء تحديثها؟ (اختر ما ينطبق):' : 'Select Fields to Request:'}</span>
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setRequestedFields(['fullName', 'phoneNumber', 'committee', 'department', 'email'])}
                    className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline font-bold cursor-pointer"
                  >
                    {ar ? 'تحديد كل الحقول' : 'Select All'}
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={() => setRequestedFields([])}
                    className="text-[11px] text-slate-500 hover:underline font-bold cursor-pointer"
                  >
                    {ar ? 'إلغاء التحديد' : 'Deselect All'}
                  </button>
                </div>
              </div>

              {/* 5 Checkboxes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {AVAILABLE_UPDATE_FIELDS.map(f => {
                  const Icon = f.icon;
                  const isChecked = requestedFields.includes(f.id);
                  return (
                    <label
                      key={f.id}
                      className={`flex items-start gap-3 p-3.5 rounded-2xl border-2 cursor-pointer transition-all ${
                        isChecked
                          ? 'border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-950 dark:text-indigo-100 shadow-sm'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-800/40 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={e => {
                          if (e.target.checked) {
                            setRequestedFields(prev => [...prev, f.id]);
                          } else {
                            setRequestedFields(prev => prev.filter(x => x !== f.id));
                          }
                        }}
                        className="mt-0.5 w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <Icon className={`w-3.5 h-3.5 ${isChecked ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} />
                          <span className="text-xs font-black">{f.titleAr}</span>
                        </div>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{f.descAr}</p>
                      </div>
                    </label>
                  );
                })}
              </div>

              {/* Optional Custom Note */}
              <div className="pt-2">
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                  {ar ? 'توجيهات أو ملاحظة تظهر للأعضاء في نافذة التحديث (اختياري):' : 'Custom Note for Members (Optional):'}
                </label>
                <input
                  type="text"
                  value={updateMessage}
                  onChange={e => setUpdateMessage(e.target.value)}
                  placeholder={ar ? 'مثال: يرجى كتابة رقم واتساب متاح للمتابعة، والتأكد من تسكين اللجنة الفرعية قبل نهاية الأسبوع...' : 'e.g. Please ensure your WhatsApp number and sub-committee are accurate...'}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs font-semibold focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Interactive Members Selection Table */}
            <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <Users className="w-4 h-4 text-indigo-500" />
                    <span>{ar ? 'قائمة الأعضاء وبياناتهم التفصيلية' : 'Members Directory & Missing Data Audit'}</span>
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {ar
                      ? 'يمكنك فحص بيانات كل عضو (الاسم، اللجنة، القسم، الهاتف، الإيميل) وحالة الاكتمال، وتحديد من تود إرسال التحديث له.'
                      : 'Audit all details per member to target exactly what needs updating.'}
                  </p>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-2">
                  {/* Missing Only Toggle */}
                  <button
                    type="button"
                    onClick={() => setOnlyMissingFilter(!onlyMissingFilter)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 border cursor-pointer ${
                      onlyMissingFilter
                        ? 'bg-rose-500 text-white border-rose-600 shadow-sm animate-pulse'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>{ar ? 'الأعضاء أصحاب البيانات الناقصة فقط ⚠️' : 'Missing Data Only ⚠️'}</span>
                  </button>

                  {/* Committee filter */}
                  <select
                    value={reqTableCommFilter}
                    onChange={e => setReqTableCommFilter(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold"
                  >
                    <option value="all">{ar ? 'كل اللجان' : 'All'}</option>
                    <option value="HR">HR</option>
                    <option value="PR">PR</option>
                    <option value="SM">SM</option>
                    <option value="OR">OR</option>
                  </select>

                  {/* Search box */}
                  <div className="relative w-48 sm:w-56">
                    <input
                      type="text"
                      value={reqTableSearch}
                      onChange={e => setReqTableSearch(e.target.value)}
                      placeholder={ar ? 'بحث بالعضو أو الكود...' : 'Search...'}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold focus:outline-none focus:border-indigo-500"
                    />
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute end-2.5 top-2.5 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Select all bar */}
              <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span>
                    {ar
                      ? `تم تحديد ${selectedUserIds.length} عضو من بين ${reqTableFilteredUsers.length} معروض`
                      : `Selected ${selectedUserIds.length} of ${reqTableFilteredUsers.length}`}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const visibleIds = reqTableFilteredUsers.map(u => u.id);
                      setSelectedUserIds(Array.from(new Set([...selectedUserIds, ...visibleIds])));
                    }}
                    className="text-indigo-600 dark:text-indigo-400 hover:underline font-bold text-xs cursor-pointer"
                  >
                    {ar ? 'تحديد كل المعروضين' : 'Select All Visible'}
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={() => {
                      const visibleIds = new Set(reqTableFilteredUsers.map(u => u.id));
                      setSelectedUserIds(selectedUserIds.filter(id => !visibleIds.has(id)));
                    }}
                    className="text-slate-500 hover:underline font-bold text-xs cursor-pointer"
                  >
                    {ar ? 'إلغاء تحديد المعروضين' : 'Deselect Visible'}
                  </button>
                </div>
              </div>

              {/* The Directory Table */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-inner">
                <div className="overflow-x-auto max-h-[420px]">
                  <table className="w-full text-xs text-start border-collapse">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 sticky top-0 z-10 font-black shadow-sm">
                      <tr>
                        <th className="p-3 text-center w-10">
                          <input
                            type="checkbox"
                            checked={reqTableFilteredUsers.length > 0 && reqTableFilteredUsers.every(u => selectedUserIds.includes(u.id))}
                            onChange={e => {
                              if (e.target.checked) {
                                const visibleIds = reqTableFilteredUsers.map(u => u.id);
                                setSelectedUserIds(Array.from(new Set([...selectedUserIds, ...visibleIds])));
                              } else {
                                const visibleIds = new Set(reqTableFilteredUsers.map(u => u.id));
                                setSelectedUserIds(selectedUserIds.filter(id => !visibleIds.has(id)));
                              }
                            }}
                            className="w-4 h-4 rounded text-indigo-600"
                          />
                        </th>
                        <th className="p-3 text-start">{ar ? 'العضو' : 'Member'}</th>
                        <th className="p-3 text-start">{ar ? 'اللجنة' : 'Committee'}</th>
                        <th className="p-3 text-start">{ar ? 'القسم / الفرع' : 'Department'}</th>
                        <th className="p-3 text-start">{ar ? 'رقم الهاتف' : 'Phone'}</th>
                        <th className="p-3 text-start">{ar ? 'البريد الإلكتروني' : 'Email'}</th>
                        <th className="p-3 text-start">{ar ? 'حالة البيانات (نواقص)' : 'Data Status'}</th>
                        <th className="p-3 text-center">{ar ? 'إجراء سريع' : 'Action'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                      {reqTableFilteredUsers.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="p-8 text-center text-slate-400 font-bold">
                            {ar ? 'لا يوجد أعضاء يطابقون شروط البحث الحالية.' : 'No members found matching filters.'}
                          </td>
                        </tr>
                      ) : (
                        reqTableFilteredUsers.map(u => {
                          const isSelected = selectedUserIds.includes(u.id);
                          const audit = getMissingFieldsForUser(u);
                          const isPhoneMissing = !u.phoneNumber || u.phoneNumber === '+201000000000';

                          return (
                            <tr
                              key={u.id}
                              onClick={() => {
                                if (isSelected) {
                                  setSelectedUserIds(selectedUserIds.filter(id => id !== u.id));
                                } else {
                                  setSelectedUserIds([...selectedUserIds, u.id]);
                                }
                              }}
                              className={`transition-colors cursor-pointer ${
                                isSelected
                                  ? 'bg-indigo-50/70 dark:bg-indigo-950/40'
                                  : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                              }`}
                            >
                              <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={e => {
                                    if (e.target.checked) {
                                      setSelectedUserIds([...selectedUserIds, u.id]);
                                    } else {
                                      setSelectedUserIds(selectedUserIds.filter(id => id !== u.id));
                                    }
                                  }}
                                  className="w-4 h-4 rounded text-indigo-600"
                                />
                              </td>
                              <td className="p-3">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black text-xs shrink-0">
                                    {(u.fullName || 'ع').charAt(0)}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="font-black text-slate-900 dark:text-white truncate" title={u.fullName}>
                                      {u.fullName || (ar ? 'بدون اسم' : 'No Name')}
                                    </p>
                                    <span className="text-[10px] font-mono text-slate-400 font-bold block">
                                      {u.membershipCode || '—'}
                                    </span>
                                  </div>
                                </div>
                              </td>

                              <td className="p-3">
                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                                  u.committee && u.committee !== 'None'
                                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                                    : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                }`}>
                                  {u.committee && u.committee !== 'None' ? u.committee : (ar ? '⚠️ غير مسكن' : 'None')}
                                </span>
                              </td>

                              <td className="p-3">
                                <div className="space-y-0.5">
                                  <span className="font-bold text-slate-700 dark:text-slate-300 block text-[11px]">
                                    {u.department && u.department !== 'None' ? u.department : (ar ? '⚠️ غير محدد' : '—')}
                                  </span>
                                  {u.subCommittee && (
                                    <span className="text-[9px] text-amber-700 dark:text-amber-300 font-bold block">
                                      {u.subCommittee}
                                    </span>
                                  )}
                                </div>
                              </td>

                              <td className="p-3 font-mono font-bold">
                                {isPhoneMissing ? (
                                  <span className="text-rose-600 dark:text-rose-400 text-[11px] font-black flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3" />
                                    <span>{ar ? 'غير مسجل' : 'Missing'}</span>
                                  </span>
                                ) : (
                                  <span className="text-slate-800 dark:text-slate-200">{u.phoneNumber}</span>
                                )}
                              </td>

                              <td className="p-3 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                                {u.email || '—'}
                              </td>

                              <td className="p-3">
                                {audit.hasMissing ? (
                                  <div className="flex flex-wrap gap-1">
                                    {audit.missing.map(m => (
                                      <span
                                        key={m.field}
                                        className="text-[9px] font-black bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800 px-1.5 py-0.5 rounded"
                                      >
                                        ⚠️ {m.label}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-[10px] font-black bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-full">
                                    {ar ? 'مكتملة ✅' : 'Complete ✅'}
                                  </span>
                                )}
                              </td>

                              <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!selectedUserIds.includes(u.id)) {
                                      setSelectedUserIds([...selectedUserIds, u.id]);
                                    }
                                    const missingKeys = audit.missing.map(m => m.field);
                                    if (missingKeys.length > 0) {
                                      setRequestedFields(Array.from(new Set([...requestedFields, ...missingKeys])));
                                    }
                                  }}
                                  className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-200 bg-indigo-50 dark:bg-indigo-950 px-2 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800 transition-colors cursor-pointer"
                                  title={ar ? 'تحديد العضو واختيار حقوله الناقصة' : 'Select & target missing'}
                                >
                                  {ar ? 'تحديد وتدقيق' : 'Target'}
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Submit Action Bar */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs font-bold text-slate-500">
                {targetScope === 'specific' ? (
                  <span>
                    {ar ? `سيتم إرسال الطلب لـ ` : `Will send to `}
                    <strong className="text-indigo-600 dark:text-indigo-400 font-black">{selectedUserIds.length}</strong>
                    {ar ? ` عضو محدد.` : ` selected members.`}
                  </span>
                ) : targetScope === 'committee' ? (
                  <span>{ar ? `سيتم إرسال الطلب لجميع أعضاء لجنة (${targetCommittee}).` : `Will send to all members of ${targetCommittee}.`}</span>
                ) : (
                  <span>{ar ? `سيتم إرسال الطلب لجميع الأعضاء بالمنصة بالكامل.` : `Will send to all platform members.`}</span>
                )}
              </div>

              <button
                type="button"
                onClick={handleSendProfileUpdateRequest}
                disabled={isSendingRequest || (targetScope === 'specific' && selectedUserIds.length === 0) || requestedFields.length === 0}
                className="w-full sm:w-auto py-3.5 px-8 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-black text-xs transition-all shadow-lg shadow-indigo-500/25 active:scale-95 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                <span>
                  {isSendingRequest
                    ? (ar ? 'جاري إرسال الطلبات...' : 'Sending...')
                    : (ar ? 'إرسال طلب تحديث البيانات للأعضاء 🚀' : 'Dispatch Update Request 🚀')}
                </span>
              </button>
            </div>

          </div>

          {/* Active & Previous Requests History */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-amber-500" />
              <span>{ar ? 'سجل طلبات التحديث المرسلة ومتابعة الاستجابة' : 'Sent Update Requests & Response Tracking'}</span>
            </h3>

            {db.getProfileUpdateRequests().length === 0 ? (
              <p className="text-xs text-slate-400 font-bold py-4 text-center">
                {ar ? 'لم يتم إرسال أي طلبات تحديث بيانات حتى الآن.' : 'No update requests sent yet.'}
              </p>
            ) : (
              <div className="space-y-3">
                {db.getProfileUpdateRequests().map(req => {
                  const total = req.targetUserIds.length;
                  const completed = (req.completedUserIds || []).length;
                  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
                  const isFinished = req.status === 'Completed' || (total > 0 && completed >= total);

                  return (
                    <div
                      key={req.id}
                      className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${
                              req.status === 'Active'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : req.status === 'Completed'
                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                                : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                            }`}>
                              {req.status === 'Active' ? (ar ? 'نشط ومستمر' : 'Active') : req.status === 'Completed' ? (ar ? 'مكتمل بنجاح' : 'Completed') : (ar ? 'ملغي' : 'Cancelled')}
                            </span>
                            <h4 className="text-xs font-black text-slate-900 dark:text-white">
                              {ar ? `طلب تحديث: ` : `Update: `}
                              <span className="text-indigo-600 dark:text-indigo-400">
                                {req.targetScope === 'all'
                                  ? (ar ? 'المنصة بالكامل' : 'All Platform')
                                  : req.targetScope === 'committee'
                                  ? (ar ? `لجنة ${req.targetCommittee}` : `${req.targetCommittee} Committee`)
                                  : (ar ? `${total} أعضاء محددين` : `${total} Specific Members`)}
                              </span>
                            </h4>
                          </div>
                          <p className="text-[11px] text-slate-400 font-medium">
                            {ar ? `مرسل بواسطة: ${req.createdByName || 'المشرف'} · ${new Date(req.createdAt).toLocaleDateString('ar-EG')}` : `By ${req.createdByName || 'Admin'} on ${new Date(req.createdAt).toLocaleDateString()}`}
                          </p>
                        </div>

                        {req.status === 'Active' && (
                          <button
                            type="button"
                            onClick={() => handleCancelProfileUpdateRequest(req.id)}
                            className="text-xs font-bold text-rose-600 hover:text-rose-800 border border-rose-200 dark:border-rose-800 rounded-xl px-3 py-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                          >
                            {ar ? 'إلغاء وسحب الطلب 🚫' : 'Cancel Request 🚫'}
                          </button>
                        )}
                      </div>

                      {/* Fields badge */}
                      <div className="flex flex-wrap gap-1.5 items-center text-xs">
                        <span className="text-[10px] text-slate-500 font-bold">{ar ? 'الحقول المطلوبة:' : 'Requested:'}</span>
                        {req.requestedFields.map(f => (
                          <span key={f} className="text-[10px] font-black bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-md">
                            {f === 'fullName' ? 'الاسم' : f === 'phoneNumber' ? 'الهاتف' : f === 'committee' ? 'اللجنة' : f === 'department' ? 'القسم' : 'الإيميل'}
                          </span>
                        ))}
                      </div>

                      {/* Progress bar */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px] font-black">
                          <span className="text-slate-600 dark:text-slate-300">
                            {ar ? `نسبة الاستجابة وتحديث البيانات:` : `Response Rate:`}
                          </span>
                          <span className="text-indigo-600 dark:text-indigo-400 font-mono">
                            {completed} / {total} ({percent}%)
                          </span>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-500 rounded-full ${isFinished ? 'bg-emerald-500' : 'bg-indigo-600'}`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      )}

      {/* TAB 2: MASTER COMMAND CENTER */}
      {activeTab === 'master' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600">
                <FileText className="w-5 h-5" />
              </div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">{ar ? 'إدارة مهام الكيان' : 'Tasks Overview'}</h3>
              <p className="text-xs text-slate-500 font-medium">{ar ? `إجمالي المهام المفتوحة بالكيان: ${tasks.length} مهمة.` : `Total active tasks: ${tasks.length}`}</p>
              <div className="pt-2 text-xs font-bold text-indigo-600">
                <span>{ar ? 'مراقبة كافة المهام والتسليمات' : 'Monitor all task submissions'}</span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600">
                <CheckSquare className="w-5 h-5" />
              </div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">{ar ? 'سجل تسليمات المهام' : 'Submissions Control'}</h3>
              <p className="text-xs text-slate-500 font-medium">{ar ? `إجمالي التسليمات المرفوعة: ${submissions.length} تسليم.` : `Total submissions: ${submissions.length}`}</p>
              <div className="pt-2 text-xs font-bold text-emerald-600">
                <span>{ar ? 'إمكانية إعادة فتح وتسليم أي مهمة' : 'Override grades and resubmissions'}</span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center text-amber-600">
                <Shield className="w-5 h-5" />
              </div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">{ar ? 'الأمان والصلاحيات العليا' : 'Master Security'}</h3>
              <p className="text-xs text-slate-500 font-medium">{ar ? 'منح صلاحيات مسئول لجنة الموارد البشرية والإشراف الكامل.' : 'Full administrative access controls.'}</p>
              <div className="pt-2 text-xs font-bold text-amber-600">
                <span>{ar ? 'نظام تشفير وحفظ محلي آمن' : 'Secured session & local state'}</span>
              </div>
            </div>
          </div>

          {/* ── One-time Local → Supabase Sync Tool ── */}
          <div className="bg-gradient-to-br from-violet-950/80 to-indigo-950/80 border border-violet-700/40 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Database className="w-5 h-5 text-violet-400" />
                  <h3 className="text-sm font-black text-white">
                    {ar ? '🔄 مزامنة البيانات المحلية مع Supabase' : '🔄 Sync Local Data → Supabase'}
                  </h3>
                </div>
                <p className="text-xs text-violet-300 font-medium leading-relaxed">
                  {ar
                    ? `يقرأ كل بيانات الأعضاء (${allUsers.length} عضو) من الذاكرة المحلية ويرفعها لـ Supabase — المنصب، اللجنة، الحالة، القسم، وباقي الحقول.`
                    : `Reads all ${allUsers.length} members from local cache and pushes role, committee, department, status to Supabase.`}
                </p>
              </div>
              <button
                onClick={syncLocalToSupabase}
                disabled={isSyncing}
                className="shrink-0 flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl text-xs font-black shadow-lg shadow-violet-900/40 transition-all"
              >
                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? (ar ? 'جاري المزامنة...' : 'Syncing...') : (ar ? 'ابدأ المزامنة الآن' : 'Run Sync Now')}</span>
              </button>
            </div>

            {/* Results Table */}
            {syncResults && (
              <div className="space-y-3">
                {/* Summary bar */}
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full text-xs font-black">
                    ✅ {syncResults.filter(r => r.ok).length} {ar ? 'نجح' : 'succeeded'}
                  </span>
                  <span className="px-3 py-1 bg-red-500/20 text-red-300 border border-red-500/30 rounded-full text-xs font-black">
                    ❌ {syncResults.filter(r => !r.ok).length} {ar ? 'فشل' : 'failed'}
                  </span>
                  <span className="px-3 py-1 bg-slate-500/20 text-slate-300 border border-slate-500/30 rounded-full text-xs font-black">
                    👥 {syncResults.length} {ar ? 'إجمالي' : 'total'}
                  </span>
                </div>

                {/* Per-user results */}
                <div className="bg-black/30 rounded-2xl border border-white/10 overflow-hidden max-h-72 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-white/10 text-slate-400 uppercase text-[10px]">
                        <th className="py-2 px-3 text-start">{ar ? 'الحالة' : 'Status'}</th>
                        <th className="py-2 px-3 text-start">{ar ? 'الاسم' : 'Member'}</th>
                        <th className="py-2 px-3 text-start">{ar ? 'التفاصيل' : 'Details'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {syncResults.map((r, i) => (
                        <tr key={i} className={r.ok ? 'text-emerald-300' : 'text-red-400'}>
                          <td className="py-1.5 px-3 font-bold">{r.ok ? '✅' : '❌'}</td>
                          <td className="py-1.5 px-3 font-bold text-white">{r.name}</td>
                          <td className="py-1.5 px-3 font-mono text-[10px] opacity-80">{r.msg}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: CONFIGURATION SETTINGS */}
      {activeTab === 'config' && (
        <form onSubmit={handleSaveSettings} className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
            <h2 className="text-base font-black text-slate-900 dark:text-white">
              {ar ? 'إعدادات المنظمة العامة' : 'General Organization Settings'}
            </h2>
            <button
              type="submit"
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-500/20"
            >
              <Save className="w-4 h-4" />
              <span>{isSaved ? (ar ? 'تم الحفظ!' : 'Saved!') : (ar ? 'حفظ التعديلات' : 'Save Changes')}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">{ar ? 'اسم المنظمة / الكيان' : 'Organization Name'}</label>
              <input
                type="text"
                value={settings.orgName}
                onChange={e => setSettings({ ...settings, orgName: e.target.value })}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs font-bold"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">{ar ? 'رابط شعار المنظمة (Logo URL)' : 'Logo URL'}</label>
              <input
                type="text"
                value={settings.orgLogoUrl || ''}
                onChange={e => setSettings({ ...settings, orgLogoUrl: e.target.value })}
                placeholder="https://..."
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs font-bold"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">{ar ? 'الحد الأقصى لحجم الملفات (ميجابايت)' : 'Default Max File Upload Size (MB)'}</label>
              <input
                type="number"
                value={settings.defaultMaxFileSizeMb}
                onChange={e => setSettings({ ...settings, defaultMaxFileSizeMb: Number(e.target.value) })}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs font-bold"
              />
            </div>

            <div className="flex items-center gap-3 pt-6">
              <input
                type="checkbox"
                id="allowSelfReg"
                checked={settings.allowSelfRegistration}
                onChange={e => setSettings({ ...settings, allowSelfRegistration: e.target.checked })}
                className="w-4 h-4 text-indigo-600 rounded"
              />
            </div>

            {/* Mobile Push & OneSignal PWA Integration Card */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50/50 dark:from-slate-850 dark:to-slate-800 rounded-2xl p-4 border border-blue-200/50 dark:border-slate-700 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">📱</span>
                  <div>
                    <h4 className="text-xs font-black text-slate-900 dark:text-white">
                      {ar ? 'إعدادات إشعارات الموبايل المباشرة (Mobile Push & PWA)' : 'Mobile Web Push & PWA Settings'}
                    </h4>
                    <p className="text-[10px] text-slate-500 font-semibold">
                      {ar ? 'تتيح استقبال إشعارات فورية على الموبايلات (أندرويد وآيفون) عند نشر المهام والأعذار' : 'Send instant push alerts to Android & iOS devices for tasks, excuses, and updates.'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    const ok = await sendTestPushNotification();
                    if (ok) {
                      showFeedback(ar ? 'تم إرسال إشعار التجربة بنجاح على هذا الموبايل! 📲' : 'Test push sent to device!', true);
                    } else {
                      showFeedback(ar ? 'تأكد من السماح بالإشعارات في إعدادات الموبايل/المتصفح.' : 'Please allow notifications in browser/phone settings.', false);
                    }
                  }}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Bell className="w-3.5 h-3.5" />
                  <span>{ar ? 'اختبار الإشعار 📱' : 'Test Push 📱'}</span>
                </button>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* TAB 4: AUDIT LOGS */}
      {activeTab === 'logs' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-3">
            <h2 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-600" />
              <span>{ar ? 'سجل العمليات والمراقبة الكاملة' : 'System Audit Trail Logs'}</span>
            </h2>
            <input
              type="text"
              value={logSearch}
              onChange={e => setLogSearch(e.target.value)}
              placeholder={ar ? 'ابحث في السجل...' : 'Search logs...'}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold w-full md:w-64"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs font-semibold">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase text-[10px]">
                  <th className="py-2.5 px-4 text-start">{ar ? 'الوقت' : 'Timestamp'}</th>
                  <th className="py-2.5 px-4 text-start">{ar ? 'المستخدم' : 'User'}</th>
                  <th className="py-2.5 px-4 text-start">{ar ? 'المنصب' : 'Role'}</th>
                  <th className="py-2.5 px-4 text-start">{ar ? 'العملية' : 'Action'}</th>
                  <th className="py-2.5 px-4 text-start">{ar ? 'التفاصيل' : 'Details'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {filteredLogs.slice(0, 50).map(l => (
                  <tr key={l.id} className="hover:bg-slate-50 dark:hover:bg-slate-850">
                    <td className="py-2.5 px-4 text-slate-400 text-[11px] font-mono">{new Date(l.timestamp).toLocaleString('ar-EG')}</td>
                    <td className="py-2.5 px-4 font-bold">{l.userName}</td>
                    <td className="py-2.5 px-4"><span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">{l.userRole}</span></td>
                    <td className="py-2.5 px-4 font-bold text-indigo-600 dark:text-indigo-400">{l.action}</td>
                    <td className="py-2.5 px-4 text-slate-500 max-w-md truncate">{l.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: SECURITY CODES SHEET */}
      {activeTab === 'security-codes' && (
        <div className="space-y-4 animate-fade-in">
          {/* Header Action Bar */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder={ar ? 'بحث بالكود أو الاسم أو الدور...' : 'Search code, name or role...'}
                  value={secSearch}
                  onChange={(e) => setSecSearch(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl ps-9 pe-3 py-2 text-xs font-bold"
                />
              </div>

              <select
                value={secRoleFilter}
                onChange={(e) => setSecRoleFilter(e.target.value)}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold"
              >
                <option value="all">{ar ? 'جميع المناصب والأدوار' : 'All Roles'}</option>
                <option value="Vice">Vice (نائب)</option>
                <option value="Coordinator">Coordinator (منسق)</option>
                <option value="Deputy Coordinator">Deputy Coordinator (نائب منسق)</option>
                <option value="Head">Head (رئيس لجنة)</option>
                <option value="HRM">HRM (مسؤول موارد بشرية)</option>
                <option value="Leader">Leader (قائد لجنة)</option>
              </select>
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto justify-end">
              <button
                onClick={handleExportSecurityCodesCSV}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-500/20 transition-all cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>{ar ? 'تصدير كـ CSV / شيت إكسل 📊' : 'Export CSV Sheet 📊'}</span>
              </button>

              <button
                onClick={() => setShowAddSecModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-xs font-black shadow-md shadow-amber-500/20 transition-all cursor-pointer"
              >
                <Key className="w-4 h-4" />
                <span>{ar ? '+ إضافة كود أمني جديد 🔑' : '+ New Security Code 🔑'}</span>
              </button>
            </div>
          </div>

          {/* Table Listing */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-start text-xs font-semibold">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase text-[10px] bg-slate-50/50 dark:bg-slate-800/50">
                    <th className="py-3 px-4 text-start">{ar ? 'كود التحقق الأمني *' : 'Security Code'}</th>
                    <th className="py-3 px-4 text-start">{ar ? 'الاسم / المنصب المستهدف' : 'Target Position / Person'}</th>
                    <th className="py-3 px-4 text-start">{ar ? 'الدور الوظيفي' : 'Role'}</th>
                    <th className="py-3 px-4 text-start">{ar ? 'اللجنة والقسم' : 'Committee & Branch'}</th>
                    <th className="py-3 px-4 text-start">{ar ? 'البريد الإلكتروني المعتمد' : 'Assigned Email'}</th>
                    <th className="py-3 px-4 text-center">{ar ? 'نسخ الكود' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                  {Object.entries(db.getAllSecurityCodes())
                    .filter(([code, d]: [string, any]) => {
                      const matchQuery = !secSearch.trim() ||
                        code.toLowerCase().includes(secSearch.toLowerCase()) ||
                        (d.fullName && d.fullName.toLowerCase().includes(secSearch.toLowerCase())) ||
                        (d.role && d.role.toLowerCase().includes(secSearch.toLowerCase())) ||
                        (d.department && d.department.toLowerCase().includes(secSearch.toLowerCase()));
                      const matchRole = secRoleFilter === 'all' || d.role === secRoleFilter;
                      return matchQuery && matchRole;
                    })
                    .map(([code, details]: [string, any]) => (
                      <tr key={code} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-mono font-black text-amber-600 dark:text-amber-400 text-sm">
                          <span className="bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-lg border border-amber-200/60 dark:border-amber-800/50 inline-block">
                            {code}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-extrabold text-slate-900 dark:text-white">
                          {details.fullName || 'غير مخصص'}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border uppercase ${ROLE_COLORS[details.role] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                            {details.role}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-600 dark:text-slate-300">
                          {details.committee || 'None'} / {details.department || 'Executive'}
                        </td>
                        <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                          {details.email || '-'}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => handleCopySecCode(code)}
                            className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-400/40 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <Key className="w-3.5 h-3.5" />
                            <span>{copiedCode === code ? (ar ? 'تم النسخ! ✓' : 'Copied! ✓') : (ar ? 'نسخ الكود 📋' : 'Copy Code 📋')}</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ADD SECURITY CODE MODAL */}
      {showAddSecModal && (
        <div 
          className="fixed inset-0 z-[99999] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh' }}
        >
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto relative z-10 animate-fade-in">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-amber-500" />
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  {ar ? 'إضافة وتخصيص كود أمان قيادي جديد' : 'Generate & Assign Security Code'}
                </h3>
              </div>
              <button 
                onClick={() => setShowAddSecModal(false)} 
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  {ar ? 'المحافظة التابع لها الكود الأمني' : 'Governorate'}
                </label>
                <div className="w-full bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-black text-emerald-700 dark:text-emerald-400">
                  {ar ? 'محافظة الغربية (GHB)' : 'Gharbia Governorate (GHB)'}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                    {ar ? 'كود التحقق الأمني التلقائي *' : 'Security Code *'}
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const autoCode = generateGovernorateLeaderCode('الغربية', db.getUsers());
                      setNewSecCodeVal(autoCode);
                    }}
                    className="text-[10px] font-bold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                  >
                    {ar ? '⚡ توليد كود جديد' : '⚡ Auto-Generate'}
                  </button>
                </div>
                <input
                  required
                  placeholder="EYE-GHB-LDR-101"
                  value={newSecCodeVal || generateGovernorateLeaderCode('الغربية', db.getUsers())}
                  onChange={(e) => setNewSecCodeVal(e.target.value.toUpperCase())}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-black font-mono text-amber-600 uppercase"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  {ar ? 'اسم المسؤول / الشخص المستهدف' : 'Target Person Name'}
                </label>
                <input
                  placeholder={ar ? 'أدخل اسم الشخص المخصص له الكود' : 'Target Official Name'}
                  value={newSecNameVal}
                  onChange={(e) => setNewSecNameVal(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    {ar ? 'الدور / المنصب' : 'Role'}
                  </label>
                  <select
                    value={newSecRoleVal}
                    onChange={(e) => setNewSecRoleVal(e.target.value as UserRole)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white"
                  >
                    {['Leader', 'Vice', 'Head', 'Coordinator', 'Deputy Coordinator', 'HRM'].map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    {ar ? 'اللجنة' : 'Committee'}
                  </label>
                  <select
                    value={newSecCommVal}
                    onChange={(e) => setNewSecCommVal(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white"
                  >
                    {['HR', 'PR', 'SM', 'OR', 'None'].map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  {ar ? 'القسم / الفرع' : 'Department'}
                </label>
                <input
                  placeholder="HRM / EPR / Content / VIP"
                  value={newSecDeptVal}
                  onChange={(e) => setNewSecDeptVal(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowAddSecModal(false)}
                className="flex-1 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                {ar ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleSaveNewSecurityCode}
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-xs font-black shadow-md shadow-amber-500/20 cursor-pointer"
              >
                {ar ? 'حفظ الكود وإضافته' : 'Save Code'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULL MASTER EDIT USER MODAL */}
      {editingUser && (
        <div 
          className="fixed inset-0 z-[99999] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh' }}
        >
          <div className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto relative z-10 animate-fade-in text-slate-900 dark:text-white">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="space-y-1">
                <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 dark:bg-indigo-950/50 px-2.5 py-1 rounded-full uppercase">
                  {ar ? 'تعديل شامل بحساب العضو' : 'Master User Profile Override'}
                </span>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  {editingUser.fullName}
                </h3>
              </div>
              <button 
                onClick={() => setEditingUser(null)} 
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMasterEdit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">{ar ? 'الاسم الكامل *' : 'Full Name *'}</label>
                  <input
                    required
                    value={editFullName}
                    onChange={e => setEditFullName(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">{ar ? 'البريد الإلكتروني *' : 'Email *'}</label>
                  <input
                    required
                    type="email"
                    value={editEmail}
                    onChange={e => setEditEmail(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">{ar ? 'رقم الهاتف' : 'Phone Number'}</label>
                  <input
                    value={editPhone}
                    onChange={e => setEditPhone(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">{ar ? 'كود العضوية (Membership Code)' : 'Membership Code'}</label>
                  <input
                    value={editCode}
                    onChange={e => setEditCode(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">{ar ? 'تاريخ الميلاد (Date of Birth) 🎂' : 'Date of Birth 🎂'}</label>
                  <input
                    type="date"
                    value={editDob}
                    onChange={e => setEditDob(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">{ar ? 'المنصب / الدور (Role)' : 'Role'}</label>
                  <select
                    value={editRole}
                    onChange={e => setEditRole(e.target.value as UserRole)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white"
                  >
                    {ALL_ROLES.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">{ar ? 'حالة الحساب (Status)' : 'Status'}</label>
                  <select
                    value={editStatus}
                    onChange={e => setEditStatus(e.target.value as UserStatus)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white"
                  >
                    {ALL_STATUSES.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">{ar ? 'اللجنة' : 'Committee'}</label>
                  <select
                    value={editCommittee}
                    onChange={e => {
                      const comm = e.target.value;
                      setEditCommittee(comm);
                      const depts = COMMITTEE_STRUCTURE[comm] || [];
                      if (depts.length > 0) setEditDepartment(depts[0]);
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white"
                  >
                    <option value="None">None</option>
                    {['HR', 'PR', 'SM', 'OR'].map(c => (
                      <option key={c} value={c}>{c === 'HR' ? 'الموارد البشرية (HR)' : `${c} Committee`}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">{ar ? 'القسم' : 'Department'}</label>
                  <select
                    value={editDepartment}
                    onChange={e => setEditDepartment(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white"
                  >
                    <option value="None">None</option>
                    {(COMMITTEE_STRUCTURE[editCommittee] || ['HRM', 'HRD', 'HRS', 'HRIS']).map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                {/* Sub-committee dropdown shown ONLY when HR committee and HRM department are chosen */}
                {editCommittee === 'HR' && (editDepartment === 'HRM' || editDepartment.startsWith('HRM')) && (
                  <div className="col-span-2 bg-indigo-50/70 dark:bg-indigo-950/40 p-3.5 rounded-2xl border border-indigo-200 dark:border-indigo-800/60 space-y-1">
                    <label className="text-xs font-black text-indigo-900 dark:text-indigo-200 block mb-1">
                      {ar ? 'اللجنة الفرعية لـ HRM (التكليف) *' : 'HRM Sub-Committee *'}
                    </label>
                    <select
                      value={editSubCommittee || 'HR OF PR'}
                      onChange={e => setEditSubCommittee(e.target.value)}
                      className="w-full bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-700 rounded-xl px-3 py-2 text-xs font-bold text-indigo-900 dark:text-indigo-100"
                    >
                      <option value="HR OF PR">HR OF PR (Human Resources of Public Relations)</option>
                      <option value="HR OF SM">HR OF SM (Human Resources of Social Media)</option>
                      <option value="HR OF OR">HR OF OR (Human Resources of Organization)</option>
                      <option value="HR OF HR">HR OF HR (Internal Human Resources)</option>
                      <option value="HRM General">HRM General (General HR Management)</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="flex-1 py-2.5 border rounded-xl text-xs font-bold text-slate-500"
                >
                  {ar ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-500/20"
                >
                  {ar ? 'حفظ البيانات وتحديث الحساب' : 'Save Full Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
