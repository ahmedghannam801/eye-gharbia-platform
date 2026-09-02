import React, { useState, useEffect } from 'react';
import { db } from '../db/localDb';
import { Meeting, AttendanceRecord, MeetingType, MeetingStatus, UserProfile, COMMITTEE_STRUCTURE } from '../types';
import { useLanguage } from '../lib/LanguageContext';
import { AttendanceImporter } from './AttendanceImporter';
import {
  exportMeetingAttendanceToExcel,
  downloadExcelFile,
  classifyAttendeeSubGroup
} from '../lib/excelExport';
import {
  formatDate,
  formatTime,
  dateToLocalInputValue,
  localInputToIso,
} from '../lib/dateUtils';
import {
  CalendarDays, Users, Plus, CheckCircle2, XCircle, Clock, Lock, Unlock,
  MapPin, Trash2, ChevronDown, ChevronUp, QrCode, UserCheck, AlertCircle,
  Building2, FileUp, MessageSquare, Star, Shield,
  FileSpreadsheet, Download, Layers, List, Search, Loader2, Sparkles, Filter, Edit3
} from 'lucide-react';

interface MeetingsProps {
  currentUser: UserProfile;
  onNavigateToView?: (view: string, targetId?: string) => void;
}

const isLeaderOrAdmin = (u: UserProfile) => ['Super Admin', 'Head', 'Vice', 'Coordinator', 'Deputy Coordinator', 'Leader', 'HRM'].includes(u.role);

// Only meeting creator or Super Admin can manage meeting attendance, code, and status
const canManageMeeting = (mtg: Meeting, user: UserProfile): boolean => {
  if (!user) return false;
  if (user.role === 'Super Admin') return true;
  return Boolean(mtg.createdBy && (mtg.createdBy === user.id || mtg.createdBy === user.email));
};

export const MeetingAttendance: React.FC<MeetingsProps> = ({ currentUser, onNavigateToView }) => {
  const { language, isRtl } = useLanguage();
  const isAr = language === 'ar';

  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, AttendanceRecord[]>>({});
  const [expandedMtg, setExpandedMtg] = useState<string | null>(null);
  const [checkInCode, setCheckInCode] = useState('');
  const [checkInFeedback, setCheckInFeedback] = useState('');
  const [checkInRating, setCheckInRating] = useState<number>(5);
  const [checkInResult, setCheckInResult] = useState<'ok' | 'wrong_code' | 'already' | 'closed' | null>(null);
  const [checkingMtgId, setCheckingMtgId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showImporter, setShowImporter] = useState(false);
  const [mobileCheckInMtg, setMobileCheckInMtg] = useState<Meeting | null>(null);
  const [viewFeedbackMtg, setViewFeedbackMtg] = useState<Meeting | null>(null);

  // Grouped vs List View State & Filters per meeting
  const [viewModeMap, setViewModeMap] = useState<Record<string, 'grouped' | 'list'>>({});
  const [subGroupFilterMap, setSubGroupFilterMap] = useState<Record<string, string>>({});
  const [searchAttendeeMap, setSearchAttendeeMap] = useState<Record<string, string>>({});
  const [exportingMtgId, setExportingMtgId] = useState<string | null>(null);
  const [exportSuccessMtgId, setExportSuccessMtgId] = useState<string | null>(null);

  // Create form state
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formType, setFormType] = useState<MeetingType>('General');
  const [formCommittee, setFormCommittee] = useState<string>('All');
  const [formDept, setFormDept] = useState<string>('All');
  const [formDate, setFormDate] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [formAttendeesCount, setFormAttendeesCount] = useState<string>('');

  const load = () => {
    const all = db.getMeetings();
    const users = db.getUsers();
    setAllUsers(users);

    let visible = all;
    if (currentUser.role === 'Member') {
      visible = all.filter(m => {
        const matchComm = !m.committee || m.committee === 'All' || m.committee === 'None' || m.committee === 'General' || m.committee === currentUser.committee;
        const matchDept = !m.department || m.department === 'All' || m.department === 'None' || m.department === 'General' || m.department === currentUser.department;
        return matchComm && matchDept;
      });
    } else {
      visible = all;
    }
    setMeetings(visible);
    const attMap: Record<string, AttendanceRecord[]> = {};
    visible.forEach(m => { attMap[m.id] = db.getAttendance(m.id); });
    setAttendanceMap(attMap);
  };

  useEffect(() => {
    load();
    const unsub = db.onChange(load);
    return () => unsub();
  }, []);

  const handleDeleteMeeting = (mtgId: string) => {
    const confirmMsg = isAr
      ? 'هل أنت متأكد من رغبتك في حذف هذا الاجتماع نهائياً؟ سيتم حذفه من عند الجميع.'
      : 'Are you sure you want to permanently delete this meeting? It will be removed for everyone.';

    if (window.confirm(confirmMsg)) {
      db.deleteMeeting(mtgId, currentUser);
      load();
    }
  };

  // Edit form state
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);
  const [editFormTitle, setEditFormTitle] = useState('');
  const [editFormDesc, setEditFormDesc] = useState('');
  const [editFormType, setEditFormType] = useState<MeetingType>('General');
  const [editFormCommittee, setEditFormCommittee] = useState<string>('All');
  const [editFormDept, setEditFormDept] = useState<string>('All');
  const [editFormDate, setEditFormDate] = useState('');
  const [editFormLocation, setEditFormLocation] = useState('');
  const [editFormAttendeesCount, setEditFormAttendeesCount] = useState<string>('');

  const handleOpenEdit = (mtg: Meeting, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingMeeting(mtg);
    setEditFormTitle(mtg.title || '');
    setEditFormDesc(mtg.description || '');
    setEditFormType(mtg.type || 'General');
    setEditFormCommittee(mtg.committee || 'All');
    setEditFormDept(mtg.department || 'All');
    setEditFormDate(dateToLocalInputValue(mtg.scheduledAt));
    setEditFormLocation(mtg.location || '');
    setEditFormAttendeesCount(mtg.expectedAttendeesCount ? String(mtg.expectedAttendeesCount) : '');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMeeting) return;
    await db.updateMeeting(editingMeeting.id, {
      title: editFormTitle,
      description: editFormDesc,
      type: editFormType,
      committee: isExecutiveAdmin ? editFormCommittee : editingMeeting.committee,
      department: isExecutiveAdmin ? editFormDept : editingMeeting.department,
      scheduledAt: localInputToIso(editFormDate),
      location: editFormLocation,
      expectedAttendeesCount: editFormAttendeesCount ? parseInt(editFormAttendeesCount, 10) : undefined,
    }, currentUser);
    setEditingMeeting(null);
    load();
  };

  const isExecutiveAdmin = ['Super Admin', 'Vice', 'Coordinator', 'Deputy Coordinator'].includes(currentUser.role);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const effectiveCommittee = isExecutiveAdmin ? formCommittee : (currentUser.committee || 'HR');
    const effectiveDept = isExecutiveAdmin ? formDept : 'All';
    db.createMeeting({
      title: formTitle,
      description: formDesc,
      type: formType,
      committee: effectiveCommittee,
      department: effectiveDept,
      scheduledAt: localInputToIso(formDate),
      location: formLocation,
      expectedAttendeesCount: formAttendeesCount ? parseInt(formAttendeesCount, 10) : undefined,
      createdBy: currentUser.id,
      createdByName: currentUser.fullName,
      status: 'Scheduled',
    }, currentUser);
    setShowCreate(false);
    setFormTitle(''); setFormDesc(''); setFormDate(''); setFormLocation(''); setFormAttendeesCount('');
  };

  const handleCheckIn = (mtgId: string) => {
    const result = db.checkIn(mtgId, checkInCode, currentUser, checkInFeedback, checkInRating);
    setCheckInResult(result);
    if (result === 'ok') {
      setCheckInCode('');
      setCheckInFeedback('');
      setCheckInRating(5);
      setTimeout(() => setCheckInResult(null), 3000);
    }
  };

  const handleExportExcel = async (mtg: Meeting, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      setExportingMtgId(mtg.id);
      const att = attendanceMap[mtg.id] || [];
      const { buffer, filename } = await exportMeetingAttendanceToExcel(mtg, att, allUsers);
      downloadExcelFile(buffer, filename);
      setExportSuccessMtgId(mtg.id);
      setTimeout(() => setExportSuccessMtgId(null), 3500);
    } catch (err) {
      console.error('Error exporting Excel:', err);
      alert(isAr ? 'حدث خطأ أثناء تصدير ملف الإكسيل' : 'Error exporting Excel file');
    } finally {
      setExportingMtgId(null);
    }
  };

  const statusColor = (s: MeetingStatus) => ({
    Scheduled: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400',
    Open: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400',
    Closed: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
  }[s]);

  const statusLabel = (s: MeetingStatus) => isAr
    ? ({ Scheduled: 'مجدول', Open: 'مفتوح', Closed: 'مغلق' }[s])
    : s;

  const typeLabel = (t: MeetingType) => isAr
    ? ({ General: 'عام', Committee: 'لجنة', Department: 'قسم', Emergency: 'طارئ' }[t])
    : t;

  const myAttendance = db.getAllAttendance().filter(a => a.memberId === currentUser.id);

  // Map users for fast lookup
  const usersMap = new Map<string, UserProfile>();
  allUsers.forEach(u => {
    if (u.id) usersMap.set(u.id, u);
    if (u.email) usersMap.set(u.email.toLowerCase(), u);
  });

  return (
    <div className="p-6 space-y-6 animate-fade-in" dir={isRtl ? 'rtl' : 'ltr'} id="meetings-view">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-50 to-blue-50/30 dark:from-slate-900 dark:to-blue-950/30 p-6 rounded-3xl border border-blue-200/40 dark:border-slate-800 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold text-xs uppercase tracking-widest">
            <CalendarDays className="w-4 h-4" />
            <span>{isAr ? 'نظام الاجتماعات والحضور' : 'Meetings & Attendance'}</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">
            {isAr ? 'الاجتماعات وتسجيل الحضور 📅' : 'Meetings & Attendance 📅'}
          </h1>
          <p className="text-xs text-slate-500 font-semibold">
            {isAr ? 'تابع الحضور مقسماً حسب اللجان واللجان الفرعية مع إمكانية تصدير Excel منظم' : 'Track attendance grouped by committees and sub-committees with Excel export'}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="bg-white dark:bg-slate-900 px-4 py-2 rounded-2xl border border-slate-200 dark:border-slate-700 text-center shadow-sm">
            <p className="text-blue-600 font-black text-xl">{myAttendance.length}</p>
            <p className="text-[10px] text-slate-500 font-bold">{isAr ? 'حضوري' : 'My Attended'}</p>
          </div>
          {isLeaderOrAdmin(currentUser) && (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setShowImporter(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-2xl text-xs font-bold transition-all shadow-sm cursor-pointer active:scale-95"
                id="import-attendance-btn"
              >
                <FileUp className="w-4 h-4" />
                {isAr ? 'رفع ملف حضور' : 'Import File'}
              </button>
              <button
                onClick={() => setShowCreate(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-eye-brand hover:bg-eye-brand-dark text-white rounded-2xl text-xs font-bold transition-all shadow-sm cursor-pointer active:scale-95"
                id="create-meeting-btn"
              >
                <Plus className="w-4 h-4" />
                {isAr ? 'اجتماع جديد' : 'New Meeting'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Meetings List */}
      {meetings.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-16 text-center shadow-sm">
          <CalendarDays className="w-12 h-12 text-blue-200 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-400">{isAr ? 'لا توجد اجتماعات مجدولة حالياً.' : 'No meetings scheduled yet.'}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {meetings.map(mtg => {
            const att = attendanceMap[mtg.id] || [];
            const iCheckedIn = att.some(a => a.memberId === currentUser.id);
            const isExpanded = expandedMtg === mtg.id;
            const canManage = canManageMeeting(mtg, currentUser);
            const currentViewMode = viewModeMap[mtg.id] || 'grouped';
            const currentFilter = subGroupFilterMap[mtg.id] || 'all';
            const searchKeyword = (searchAttendeeMap[mtg.id] || '').trim().toLowerCase();

            // Enrich attendees with profile data and classification
            const enrichedAttendees = att.map(rec => {
              const u = usersMap.get(rec.memberId) || usersMap.get((rec.memberEmail || '').toLowerCase());
              const classification = classifyAttendeeSubGroup(rec, u);
              return {
                record: rec,
                user: u,
                ...classification
              };
            });

            // Extract unique sub-groups for filter tabs with clean ordering
            const subGroupsSet = new Map<string, { code: string; label: string; count: number; committeeLabel: string }>();
            enrichedAttendees.forEach(item => {
              const key = `${item.committee}:::${item.subGroup}`;
              if (!subGroupsSet.has(key)) {
                subGroupsSet.set(key, {
                  code: item.subGroup,
                  label: item.subGroupLabelAr,
                  count: 0,
                  committeeLabel: item.committeeLabelAr
                });
              }
              subGroupsSet.get(key)!.count++;
            });

            // Sort sub-groups so HRM, HRD, HRS, HRIS are in clean priority order
            const subPriority: Record<string, number> = { HRM: 1, HRD: 2, HRS: 3, HRIS: 4, EPR: 10, IPR: 11, Content: 20, 'Graphic Design': 21, Photography: 22, 'Video Editing': 23, VIP: 30, Planning: 31, Coordination: 32, Logistics: 33 };
            const sortedSubGroups = Array.from(subGroupsSet.entries()).sort(([aKey, aVal], [bKey, bVal]) => {
              const pA = subPriority[aVal.code] || 99;
              const pB = subPriority[bVal.code] || 99;
              return pA - pB;
            });

            // Filter attendees by sub-group & search
            const filteredAttendees = enrichedAttendees.filter(item => {
              const matchFilter = currentFilter === 'all' || `${item.committee}:::${item.subGroup}` === currentFilter;
              const matchSearch = matchesSearch([
                item.record.memberName,
                item.user?.membershipCode,
                item.record.memberEmail,
                item.user?.phoneNumber,
                item.subGroupLabelAr,
                item.committee,
                item.subGroup
              ], searchKeyword);
              return matchFilter && matchSearch;
            });

            // Group filtered attendees in clean order
            const groupedSections: Record<string, typeof enrichedAttendees> = {};
            filteredAttendees.forEach(item => {
              const key = `${item.committee}:::${item.subGroup}`;
              if (!groupedSections[key]) groupedSections[key] = [];
              groupedSections[key].push(item);
            });

            return (
              <div key={mtg.id} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm card-pressable transition-all">
                {/* Meeting header row */}
                <div
                  className="flex items-center gap-4 p-5 cursor-pointer select-none"
                  onClick={() => setExpandedMtg(isExpanded ? null : mtg.id)}
                >
                  {/* Icon */}
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${mtg.status === 'Open' ? 'bg-emerald-100 dark:bg-emerald-950/40' : mtg.status === 'Closed' ? 'bg-slate-100 dark:bg-slate-800' : 'bg-blue-100 dark:bg-blue-950/40'}`}>
                    <CalendarDays className={`w-6 h-6 ${mtg.status === 'Open' ? 'text-emerald-600' : mtg.status === 'Closed' ? 'text-slate-400' : 'text-blue-600'}`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-base font-black text-slate-900 dark:text-white truncate">{mtg.title}</p>
                      <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${statusColor(mtg.status)}`}>{statusLabel(mtg.status)}</span>
                      <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2.5 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">{typeLabel(mtg.type)}</span>
                      {mtg.createdByName && (
                        <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 px-2.5 py-0.5 rounded-full border border-slate-200/60 dark:border-slate-700/60">
                          👤 {isAr ? `المنظم: ${mtg.createdByName}` : `Host: ${mtg.createdByName}`}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 sm:gap-3 flex-wrap mt-1.5 text-xs text-slate-500 font-semibold">
                      <span className="flex items-center gap-1 font-bold text-slate-700 dark:text-slate-300">
                        <Clock className="w-3.5 h-3.5 text-indigo-500" />
                        {formatDate(mtg.scheduledAt, isAr ? 'ar' : 'en')}
                        {' — '}
                        <span className="text-eye-brand font-black">{formatTime(mtg.scheduledAt, isAr ? 'ar' : 'en')}</span>
                      </span>
                      {mtg.location && mtg.location.match(/^https?:\/\//i) ? (
                        <a
                          href={mtg.location}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-bold hover:underline"
                        >
                          <MapPin className="w-3.5 h-3.5 text-blue-500" />
                          <span>{isAr ? 'رابط الاجتماع 🔗' : 'Meeting Link 🔗'}</span>
                        </a>
                      ) : (
                        <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-slate-400" />{mtg.location}</span>
                      )}
                      <span className="flex items-center gap-1 font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
                        <Users className="w-3.5 h-3.5 text-blue-500" />
                        <span>{att.length}{mtg.expectedAttendeesCount ? ` / ${mtg.expectedAttendeesCount}` : ''} {isAr ? 'حاضر' : 'attended'}</span>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    {/* Quick Excel Export button in card header for leaders/admins */}
                    {isLeaderOrAdmin(currentUser) && (
                      <button
                        onClick={(e) => handleExportExcel(mtg, e)}
                        disabled={exportingMtgId === mtg.id}
                        className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-600 dark:hover:text-white border border-emerald-300 dark:border-emerald-700/60 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer active:scale-95"
                        title={isAr ? 'تصدير كشف الحضور Excel' : 'Export Attendance to Excel'}
                      >
                        {exportingMtgId === mtg.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <FileSpreadsheet className="w-3.5 h-3.5" />
                        )}
                        <span className="hidden sm:inline">{isAr ? 'تصدير Excel' : 'Export Excel'}</span>
                      </button>
                    )}

                    {iCheckedIn && <span className="text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/60 px-3 py-1 rounded-full font-black">✓ {isAr ? 'حضرت' : 'Attended'}</span>}
                    {!iCheckedIn && currentUser.role === 'Member' && mtg.status === 'Open' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setMobileCheckInMtg(mtg); setCheckInCode(''); setCheckInResult(null); setCheckingMtgId(null); }}
                        className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-full font-black animate-pulse flex items-center gap-1.5 shrink-0 shadow-md shadow-blue-500/20"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        {isAr ? 'سجّل حضورك' : 'Check-in'}
                      </button>
                    )}
                    {canManage && (
                      <button
                        onClick={(e) => handleOpenEdit(mtg, e)}
                        className="p-2 rounded-xl bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-600 dark:hover:text-white border border-blue-200/60 dark:border-blue-800 transition-colors"
                        title={isAr ? 'تعديل موعد وبيانات الاجتماع' : 'Edit Meeting & Time'}
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                    )}
                    {canManage && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteMeeting(mtg.id); }}
                        className="p-2 rounded-xl bg-red-50 hover:bg-red-500 text-red-500 hover:text-white border border-red-100 transition-colors"
                        title={isAr ? 'حذف الاجتماع' : 'Delete Meeting'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                  </div>

                </div>

                {/* Expanded panel */}
                {isExpanded && (
                  <div className="border-t border-slate-100 dark:border-slate-800 p-6 space-y-6 bg-slate-50/30 dark:bg-slate-900/30">
                    {mtg.description && (
                      <div className="bg-white dark:bg-slate-800/80 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80">
                        <p className="text-xs text-slate-700 dark:text-slate-300 font-medium leading-relaxed">{mtg.description}</p>
                      </div>
                    )}

                    {mtg.location && mtg.location.match(/^https?:\/\//i) && (
                      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 border border-blue-200 dark:border-blue-800 rounded-2xl p-4 flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-blue-900 dark:text-blue-200">
                            {isAr ? '🔗 رابط الانضمام للاجتماع أونلاين (Online Meeting Link):' : '🔗 Meeting Link (Online):'}
                          </p>
                          <p className="text-[11px] text-blue-600 dark:text-blue-400 font-mono truncate">{mtg.location}</p>
                        </div>
                        <a
                          href={mtg.location}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 shadow-sm"
                        >
                          <span>{isAr ? 'انضمام الآن 🚀' : 'Join Now 🚀'}</span>
                        </a>
                      </div>
                    )}

                    {/* Check-in section (Members only, meeting is Open) */}
                    {!iCheckedIn && currentUser.role === 'Member' && mtg.status === 'Open' && (
                      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 rounded-2xl p-5 border border-blue-200/60 dark:border-blue-800/60 shadow-sm space-y-4">
                        <p className="text-sm font-bold text-blue-700 dark:text-blue-400 flex items-center gap-2">
                          <QrCode className="w-4 h-4" />
                          {isAr ? 'سجّل حضورك بالكود السري' : 'Check-in with secret code'}
                        </p>

                        <div className="space-y-3">
                          <div>
                            <input
                              value={checkInCode}
                              onChange={e => setCheckInCode(e.target.value.toUpperCase())}
                              placeholder={isAr ? 'اكتب الكود هنا...' : 'Enter code here...'}
                              maxLength={6}
                              autoCapitalize="characters"
                              autoComplete="off"
                              inputMode="text"
                              className="w-full bg-white dark:bg-slate-900 border-2 border-blue-300 dark:border-blue-700 rounded-2xl px-4 py-3 text-2xl font-black text-center tracking-[0.4em] focus:outline-none focus:border-blue-500 dark:focus:border-blue-400 font-mono uppercase shadow-inner transition-colors"
                              id={`checkin-code-${mtg.id}`}
                            />
                          </div>

                          {/* Session Rating (Optional) */}
                          <div className="space-y-1 bg-white/70 dark:bg-slate-900/60 p-3 rounded-2xl border border-blue-100 dark:border-blue-900/40">
                            <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                              <span>{isAr ? '⭐ تقييمك للسيشن / الاجتماع (اختياري):' : '⭐ Session Rating (Optional):'}</span>
                              <span className="text-amber-500 font-black">{checkInRating} / 5</span>
                            </div>
                            <div className="flex items-center gap-2 justify-center py-1">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                  type="button"
                                  key={star}
                                  onClick={() => setCheckInRating(star)}
                                  className="p-1 hover:scale-125 transition-transform cursor-pointer"
                                >
                                  <Star
                                    className={`w-6 h-6 ${
                                      star <= checkInRating
                                        ? 'fill-amber-400 text-amber-400 drop-shadow-[0_2px_8px_rgba(251,191,36,0.5)]'
                                        : 'text-slate-300 dark:text-slate-600'
                                    }`}
                                  />
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Feedback & Suggestions Textarea */}
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                              <MessageSquare className="w-3.5 h-3.5 text-blue-500" />
                              <span>{isAr ? '💬 رأيك ومقترحاتك حول السيشن (اختياري):' : '💬 Feedback & Suggestions (Optional):'}</span>
                            </label>
                            <textarea
                              rows={2}
                              value={checkInFeedback}
                              onChange={e => setCheckInFeedback(e.target.value)}
                              placeholder={isAr ? 'اكتب رأيك بصراحة، ما الذي استفدته، أو أي اقتراحات للتطوير...' : 'Share what you learned or any suggestions...'}
                              className="w-full bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 rounded-xl p-3 text-xs text-slate-800 dark:text-slate-100 font-semibold focus:outline-none focus:border-blue-500 resize-none shadow-sm"
                            />
                            <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold flex items-center gap-1 mt-0.5">
                              <Shield className="w-3 h-3 shrink-0" />
                              <span>{isAr ? '🔒 خصوصية تامة: ملاحظاتك واقتراحاتك تظهر حصرياً لقادة ومسؤولي السيشن.' : '🔒 Privacy: Your feedback is exclusively visible to session leaders/hosts.'}</span>
                            </p>
                          </div>

                          <button
                            onClick={() => { setCheckingMtgId(mtg.id); handleCheckIn(mtg.id); }}
                            className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-2xl text-sm font-black transition-all shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <CheckCircle2 className="w-5 h-5" />
                            {isAr ? 'تأكيد تسجيل الحضور والفيدباك ✅' : 'Submit Check-in & Feedback ✅'}
                          </button>
                        </div>

                        {checkInResult && checkingMtgId === mtg.id && (
                          <div className={`mt-3 flex items-center justify-center gap-2 text-sm font-bold py-3 rounded-xl ${checkInResult === 'ok' ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30' : 'text-red-500 bg-red-50 dark:bg-red-950/30'}`}>
                            {checkInResult === 'ok' && <><CheckCircle2 className="w-4 h-4" />{isAr ? 'تم تسجيل حضورك وفيدباكك بنجاح! ✅' : 'Checked in successfully! ✅'}</>}
                            {checkInResult === 'wrong_code' && <><XCircle className="w-4 h-4" />{isAr ? 'الكود غير صحيح، حاول مجدداً' : 'Wrong code, try again'}</>}
                            {checkInResult === 'already' && <><AlertCircle className="w-4 h-4" />{isAr ? 'سبق تسجيل حضورك في هذا الاجتماع' : 'Already checked in'}</>}
                            {checkInResult === 'closed' && <><Lock className="w-4 h-4" />{isAr ? 'الاجتماع مغلق' : 'Meeting is closed'}</>}
                          </div>
                        )}
                      </div>
                    )}

                    {iCheckedIn && (
                      <div className="flex items-center gap-2 text-emerald-600 text-xs font-bold bg-emerald-50 dark:bg-emerald-950/20 px-4 py-3 rounded-2xl border border-emerald-200/50">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        {isAr ? 'تم تسجيل حضورك بنجاح في هذا الاجتماع 🎉' : 'You are marked as attended for this meeting 🎉'}
                      </div>
                    )}

                    {/* Meeting Manager Controls (Meeting Creator or Super Admin only) */}
                    {canManage && (
                      <div className="space-y-4 bg-slate-100/70 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80">
                        {/* Attendance Code Display */}
                        <div className="flex items-center gap-3 bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                          <QrCode className="w-5 h-5 text-eye-brand shrink-0" />
                          <div>
                            <p className="text-[10px] text-slate-500 font-bold">{isAr ? 'كود الحضور السري (خاص بمنشئ الاجتماع / الإدارة)' : 'Secret Attendance Code (Host / Admin Only)'}</p>
                            <p className="text-xl font-black font-mono tracking-widest text-eye-brand">{mtg.attendanceCode}</p>
                          </div>
                          <p className="text-[10px] text-slate-400 ms-auto">{isAr ? 'أعطه للأعضاء أثناء الاجتماع' : 'Share with members only'}</p>
                        </div>

                        {/* Status controls */}
                        <div className="flex gap-2 flex-wrap items-center">
                          {mtg.status === 'Scheduled' && (
                            <button
                              onClick={() => db.updateMeetingStatus(mtg.id, 'Open', currentUser)}
                              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                            >
                              <Unlock className="w-3.5 h-3.5" />
                              {isAr ? 'افتح تسجيل الحضور' : 'Open Check-in'}
                            </button>
                          )}
                          {mtg.status === 'Open' && (
                            <button
                              onClick={() => db.updateMeetingStatus(mtg.id, 'Closed', currentUser)}
                              className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                            >
                              <Lock className="w-3.5 h-3.5" />
                              {isAr ? 'أغلق تسجيل الحضور' : 'Close Check-in'}
                            </button>
                          )}
                          {mtg.status === 'Closed' && (
                            <button
                              onClick={() => db.updateMeetingStatus(mtg.id, 'Open', currentUser)}
                              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm animate-pulse cursor-pointer"
                            >
                              <Unlock className="w-3.5 h-3.5" />
                              {isAr ? 'إعادة فتح تسجيل الحضور 🔓' : 'Reopen Check-in 🔓'}
                            </button>
                          )}
                          <button
                            onClick={() => handleOpenEdit(mtg)}
                            className="flex items-center gap-1.5 px-4 py-2 bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-600 dark:hover:text-white rounded-xl text-xs font-bold transition-all border border-blue-200/60 dark:border-blue-800/60 cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            {isAr ? 'تعديل موعد وبيانات الاجتماع' : 'Edit Meeting & Time'}
                          </button>
                          <button
                            onClick={() => handleDeleteMeeting(mtg.id)}
                            className="flex items-center gap-1.5 px-4 py-2 bg-red-50 hover:bg-red-600 text-red-600 hover:text-white rounded-xl text-xs font-bold transition-all border border-red-200/60 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            {isAr ? 'حذف الاجتماع' : 'Delete'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* ─────────────────────────────────────────────────────────────
                        ATTENDANCE SECTION WITH SUB-COMMITTEE GROUPING & EXCEL EXPORT
                    ───────────────────────────────────────────────────────────── */}
                    <div className="space-y-4">
                      {/* Attendance Action Toolbar */}
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white dark:bg-slate-800/80 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                        
                        {/* Title & Count */}
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                            <Users className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-black text-slate-900 dark:text-white">
                                {isAr ? 'سجل وكشف الحضور' : 'Attendance Roster'}
                              </h4>
                              <span className="text-xs font-extrabold bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 px-2.5 py-0.5 rounded-full">
                                {att.length} {isAr ? 'حاضر' : 'members'}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400 font-semibold">
                              {isAr ? 'مقسم تلقائياً حسب اللجان واللجان الفرعية' : 'Automatically divided by committee & sub-committee'}
                            </p>
                          </div>
                        </div>

                        {/* Controls: View Mode Switcher, Excel Export, Feedback Modal */}
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* View Mode Toggle (Grouped vs List) */}
                          <div className="flex items-center bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
                            <button
                              onClick={() => setViewModeMap(prev => ({ ...prev, [mtg.id]: 'grouped' }))}
                              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                currentViewMode === 'grouped'
                                  ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                              }`}
                              title={isAr ? 'عرض مقسم للجان' : 'Grouped by committee'}
                            >
                              <Layers className="w-3.5 h-3.5" />
                              <span>{isAr ? 'مقسم للجان' : 'Grouped'}</span>
                            </button>
                            <button
                              onClick={() => setViewModeMap(prev => ({ ...prev, [mtg.id]: 'list' }))}
                              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                currentViewMode === 'list'
                                  ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                              }`}
                              title={isAr ? 'عرض قائمة موحدة' : 'Full list'}
                            >
                              <List className="w-3.5 h-3.5" />
                              <span>{isAr ? 'قائمة كاملة' : 'List'}</span>
                            </button>
                          </div>

                          {/* Excel Download Button */}
                          <button
                            onClick={(e) => handleExportExcel(mtg, e)}
                            disabled={exportingMtgId === mtg.id || att.length === 0}
                            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black transition-all shadow-sm cursor-pointer active:scale-95 ${
                              exportSuccessMtgId === mtg.id
                                ? 'bg-emerald-600 text-white'
                                : 'bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-200 dark:disabled:bg-slate-800 text-white'
                            }`}
                            id={`export-excel-btn-${mtg.id}`}
                          >
                            {exportingMtgId === mtg.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : exportSuccessMtgId === mtg.id ? (
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            ) : (
                              <Download className="w-3.5 h-3.5" />
                            )}
                            <span>
                              {exportingMtgId === mtg.id
                                ? (isAr ? 'جاري تجهيز Excel...' : 'Preparing...')
                                : exportSuccessMtgId === mtg.id
                                ? (isAr ? 'تم التحميل بنجاح! ✅' : 'Downloaded! ✅')
                                : (isAr ? 'تنزيل كشف الحضور (Excel) 📥' : 'Download Excel 📥')}
                            </span>
                          </button>

                          {/* Feedback Button */}
                          {isLeaderOrAdmin(currentUser) && att.some(a => a.feedback || a.rating) && (
                            <button
                              onClick={() => setViewFeedbackMtg(mtg)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 hover:bg-amber-100 border border-amber-300 dark:border-amber-700/60 rounded-xl text-xs font-black transition-all shadow-sm cursor-pointer"
                            >
                              <MessageSquare className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                              <span>{isAr ? `💬 الفيدباك (${att.filter(a => a.feedback || a.rating).length})` : `Feedback (${att.filter(a => a.feedback || a.rating).length})`}</span>
                            </button>
                          )}
                        </div>

                      </div>

                      {/* Search and Sub-group Filter Chips */}
                      {att.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex flex-col sm:flex-row gap-2">
                            {/* Instant Search Bar */}
                            <div className="relative flex-1">
                              <Search className="w-3.5 h-3.5 text-slate-400 absolute top-1/2 -translate-y-1/2 start-3" />
                              <input
                                type="text"
                                value={searchAttendeeMap[mtg.id] || ''}
                                onChange={e => setSearchAttendeeMap(prev => ({ ...prev, [mtg.id]: e.target.value }))}
                                placeholder={isAr ? 'بحث بالاسم، كود العضوية، أو الفرع...' : 'Search by name, code, or department...'}
                                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl ps-9 pe-3 py-2 text-xs font-semibold focus:outline-none focus:border-indigo-500 shadow-sm"
                              />
                            </div>
                          </div>

                          {/* Filter Tabs / Pills */}
                          {sortedSubGroups.length > 1 && (
                            <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 no-scrollbar flex-wrap">
                              <button
                                onClick={() => setSubGroupFilterMap(prev => ({ ...prev, [mtg.id]: 'all' }))}
                                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer ${
                                  currentFilter === 'all'
                                    ? 'bg-indigo-600 text-white shadow-sm'
                                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                                }`}
                              >
                                {isAr ? `الكل (${enrichedAttendees.length})` : `All (${enrichedAttendees.length})`}
                              </button>

                              {sortedSubGroups.map(([key, data]) => (
                                <button
                                  key={key}
                                  onClick={() => setSubGroupFilterMap(prev => ({ ...prev, [mtg.id]: key }))}
                                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer flex items-center gap-1.5 ${
                                    currentFilter === key
                                      ? 'bg-indigo-600 text-white shadow-sm'
                                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                                  }`}
                                >
                                  <span>{data.label}</span>
                                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                                    currentFilter === key ? 'bg-indigo-700 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                                  }`}>
                                    {data.count}
                                  </span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Displaying Attendees */}
                      {att.length === 0 ? (
                        <div className="p-8 text-center bg-white dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                          <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                          <p className="text-xs text-slate-400 font-semibold">{isAr ? 'لم يُسجّل أي عضو حضوره حتى الآن.' : 'No attendees checked in yet.'}</p>
                        </div>
                      ) : filteredAttendees.length === 0 ? (
                        <div className="p-8 text-center bg-white dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                          <Filter className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                          <p className="text-xs text-slate-400 font-semibold">{isAr ? 'لا توجد نتائج تطابق خيارات البحث الحالية.' : 'No members match the current filter/search.'}</p>
                        </div>
                      ) : currentViewMode === 'grouped' ? (
                        /* ===== GROUPED BY COMMITTEE & SUB-COMMITTEE VIEW ===== */
                        <div className="space-y-4">
                          {Object.entries(groupedSections).map(([groupKey, items]) => {
                            const first = items[0];
                            const groupRatings = items.map(i => i.record.rating).filter((r): r is number => typeof r === 'number' && r > 0);
                            const avgGroupRating = groupRatings.length > 0
                              ? (groupRatings.reduce((a, b) => a + b, 0) / groupRatings.length).toFixed(1)
                              : null;

                            return (
                              <div
                                key={groupKey}
                                className="bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden"
                              >
                                {/* Group Section Header */}
                                <div className="flex items-center justify-between p-3.5 bg-gradient-to-r from-indigo-50/80 via-blue-50/40 to-slate-50 dark:from-indigo-950/40 dark:via-blue-950/20 dark:to-slate-800/60 border-b border-indigo-100/80 dark:border-slate-700 flex-wrap gap-2">
                                  <div className="flex items-center gap-2.5">
                                    <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-black text-xs shadow-sm">
                                      {first.committee.slice(0, 2).toUpperCase()}
                                    </div>
                                    <div>
                                      <h5 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                                        <span>{first.subGroupLabelAr}</span>
                                      </h5>
                                      <p className="text-[10px] text-slate-500 font-semibold">
                                        {first.committeeLabelAr}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    {avgGroupRating && (
                                      <span className="text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
                                        <span>⭐</span>
                                        <span>{avgGroupRating}</span>
                                      </span>
                                    )}
                                    <span className="text-xs font-black bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 px-2.5 py-0.5 rounded-lg border border-indigo-200 dark:border-indigo-800">
                                      {items.length} {isAr ? 'حاضر' : 'members'}
                                    </span>
                                  </div>
                                </div>

                                {/* Group Attendees Grid */}
                                <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                  {items.map(item => {
                                    const a = item.record;
                                    const u = item.user;
                                    return (
                                      <div
                                        key={a.id}
                                        className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-100 dark:border-slate-700/80 space-y-2 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors"
                                      >
                                        <div className="flex items-start justify-between gap-2">
                                          <div className="flex items-center gap-2.5 min-w-0">
                                            <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black text-xs shrink-0">
                                              {(a.memberName || 'ع').charAt(0)}
                                            </div>
                                            <div className="min-w-0">
                                              <p
                                                className="text-xs font-black text-slate-900 dark:text-slate-100 cursor-pointer hover:text-indigo-600 hover:underline truncate"
                                                onClick={() => onNavigateToView?.('profile', a.memberId)}
                                                title={a.memberName}
                                              >
                                                {a.memberName}
                                              </p>
                                              <div className="flex items-center gap-1.5 text-[9px] text-slate-400 font-mono mt-0.5">
                                                <span>{u?.membershipCode || '—'}</span>
                                                <span>•</span>
                                                <span className="text-slate-500 font-sans">{u?.role || 'Member'}</span>
                                              </div>
                                            </div>
                                          </div>

                                          <div className="flex flex-col items-end gap-1 shrink-0">
                                            {a.rating && (
                                              <span className="text-[10px] text-amber-500 font-black flex items-center gap-0.5">
                                                {'⭐'.repeat(Math.min(5, Math.max(1, a.rating)))}
                                              </span>
                                            )}
                                            <span className="text-[9px] text-slate-400 font-semibold flex items-center gap-0.5">
                                              <Clock className="w-2.5 h-2.5 text-indigo-400" />
                                              {formatTime(a.checkedInAt, isAr ? 'ar' : 'en')}
                                            </span>
                                          </div>
                                        </div>

                                        {/* Feedback Preview (Leaders only) */}
                                        {isLeaderOrAdmin(currentUser) && a.feedback && (
                                          <div className="p-2 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 rounded-lg text-[11px] text-amber-900 dark:text-amber-200 font-medium leading-relaxed">
                                            <p className="line-clamp-2">💬 "{a.feedback}"</p>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>

                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        /* ===== FULL UNIFIED LIST VIEW ===== */
                        <div className="bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700/80 overflow-hidden shadow-sm">
                          {filteredAttendees.map((item, idx) => {
                            const a = item.record;
                            const u = item.user;
                            return (
                              <div key={a.id} className="p-3.5 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors">
                                <div className="flex items-center gap-3 min-w-0">
                                  <span className="text-[10px] font-mono font-bold text-slate-400 w-5 text-center">
                                    {idx + 1}
                                  </span>
                                  <UserCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <p
                                        className="text-xs font-black text-slate-900 dark:text-white cursor-pointer hover:text-indigo-600 hover:underline"
                                        onClick={() => onNavigateToView?.('profile', a.memberId)}
                                      >
                                        {a.memberName}
                                      </p>
                                      {u?.membershipCode && (
                                        <span className="text-[9px] font-mono bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.2 rounded">
                                          {u.membershipCode}
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-0.5">
                                      <span className="font-bold text-indigo-600 dark:text-indigo-400">{item.subGroupLabelAr}</span>
                                      {' · '}
                                      <span>{formatTime(a.checkedInAt, isAr ? 'ar' : 'en', true)}</span>
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  {a.rating && (
                                    <span className="text-xs text-amber-500 font-bold hidden sm:inline">
                                      {'⭐'.repeat(Math.min(5, Math.max(1, a.rating)))}
                                    </span>
                                  )}
                                  {a.isExcused && <span className="text-[9px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">{isAr ? 'معذور' : 'Excused'}</span>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                    </div>

                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create Meeting Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center px-4" dir={isRtl ? 'rtl' : 'ltr'}>
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl p-6 shadow-2xl space-y-4 modal-panel-animate">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-blue-500" />{isAr ? 'إنشاء اجتماع جديد' : 'Create New Meeting'}
              </h3>
              <button onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-slate-600"><XCircle className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleCreate} className="space-y-3">
              <input required value={formTitle} onChange={e => setFormTitle(e.target.value)}
                placeholder={isAr ? 'عنوان الاجتماع' : 'Meeting title'}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-semibold focus:outline-none focus:border-eye-brand" />
              <textarea value={formDesc} onChange={e => setFormDesc(e.target.value)} rows={2}
                placeholder={isAr ? 'وصف (اختياري)' : 'Description (optional)'}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-semibold focus:outline-none focus:border-eye-brand resize-none" />
              <div className="grid grid-cols-2 gap-3">
                <select value={formType} onChange={e => setFormType(e.target.value as MeetingType)}
                  className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold focus:outline-none focus:border-eye-brand">
                  <option value="General">{isAr ? 'عام' : 'General'}</option>
                  <option value="Committee">{isAr ? 'لجنة' : 'Committee'}</option>
                  <option value="Department">{isAr ? 'قسم' : 'Department'}</option>
                  <option value="Emergency">{isAr ? 'طارئ' : 'Emergency'}</option>
                </select>
                {isExecutiveAdmin ? (
                  <select value={formCommittee} onChange={e => setFormCommittee(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold focus:outline-none focus:border-eye-brand">
                    <option value="All">{isAr ? 'كل اللجان' : 'All Committees'}</option>
                    {['HR','PR','SM','OR'].map(c => <option key={c} value={c}>{c === 'HR' ? (isAr ? 'الموارد البشرية (HR)' : 'HR') : c}</option>)}
                  </select>
                ) : (
                  <div className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-200">
                    <span className="text-slate-500">{isAr ? 'اللجنة:' : 'Committee:'}</span>
                    <span className="bg-blue-600 text-white px-2.5 py-0.5 rounded-lg text-[11px] font-black">
                      {currentUser.committee === 'HR' ? (isAr ? 'الموارد البشرية (HR)' : 'HR') : (isAr ? `لجنة ${currentUser.committee}` : currentUser.committee)}
                    </span>
                  </div>
                )}
              </div>

              {isExecutiveAdmin && (formCommittee === 'HR' || formCommittee === 'HRM') && (
                <div className="space-y-1 animate-fadeIn">
                  <label className="text-[10px] font-bold text-amber-700 dark:text-amber-300 block">
                    {isAr ? 'قسم / فرع HR المستهدف:' : 'Target HR Department / Branch:'}
                  </label>
                  <select
                    value={formDept}
                    onChange={e => setFormDept(e.target.value)}
                    className="w-full bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 rounded-xl px-3 py-2 text-xs font-bold text-amber-900 dark:text-amber-200 focus:outline-none focus:border-amber-500"
                  >
                    <option value="All">{isAr ? 'جميع لجان وأقسام HR' : 'All HR Departments'}</option>
                    <option value="HRM">{isAr ? 'HRM — إدارة الموارد البشرية' : 'HR Management (HRM)'}</option>
                    <option value="HRD">{isAr ? 'HRD — التطوير والتدريب' : 'HR Development (HRD)'}</option>
                    <option value="HRS">{isAr ? 'HRS — الدعم والمساندة' : 'HR Support (HRS)'}</option>
                    <option value="HRIS">{isAr ? 'HRIS — نظم المعلومات' : 'HR Info Systems (HRIS)'}</option>
                  </select>
                </div>
              )}
              <input required value={formDate} onChange={e => setFormDate(e.target.value)} type="datetime-local"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-semibold focus:outline-none focus:border-eye-brand" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">
                    {isAr ? 'المكان أو رابط الاجتماع *' : 'Location or Link *'}
                  </label>
                  <input required value={formLocation} onChange={e => setFormLocation(e.target.value)}
                    placeholder={isAr ? 'المكان أو رابط الاجتماع' : 'Location or meeting link'}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-eye-brand" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">
                    {isAr ? 'عدد الحضور المستهدف / المتوقع' : 'Target Attendees Count'}
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formAttendeesCount}
                    onChange={e => setFormAttendeesCount(e.target.value)}
                    placeholder={isAr ? 'عدد الحضور (مثال: 50)' : 'Target count (e.g. 50)'}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-eye-brand" />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowCreate(false)}
                  className="flex-1 px-4 py-2.5 text-xs font-bold text-slate-500 hover:text-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl transition-all cursor-pointer">
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button type="submit"
                  className="flex-1 bg-eye-brand hover:bg-eye-brand-dark text-white rounded-xl text-xs font-bold py-2.5 transition-all shadow-sm cursor-pointer">
                  {isAr ? 'إنشاء الاجتماع' : 'Create Meeting'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Meeting Modal */}
      {editingMeeting && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 max-w-md w-full shadow-2xl space-y-4 animate-scale-in">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-blue-500" />
                {isAr ? 'تعديل موعد وبيانات الاجتماع ⏱️' : 'Edit Meeting & Time ⏱️'}
              </h3>
              <button onClick={() => setEditingMeeting(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <XCircle className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveEdit} className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">
                  {isAr ? 'عنوان الاجتماع *' : 'Meeting Title *'}
                </label>
                <input required value={editFormTitle} onChange={e => setEditFormTitle(e.target.value)}
                  placeholder={isAr ? 'عنوان الاجتماع' : 'Meeting title'}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-semibold focus:outline-none focus:border-eye-brand" />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">
                  {isAr ? 'الوصف (اختياري)' : 'Description (Optional)'}
                </label>
                <textarea value={editFormDesc} onChange={e => setEditFormDesc(e.target.value)} rows={2}
                  placeholder={isAr ? 'وصف (اختياري)' : 'Description (optional)'}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-semibold focus:outline-none focus:border-eye-brand resize-none" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">
                    {isAr ? 'نوع الاجتماع' : 'Meeting Type'}
                  </label>
                  <select value={editFormType} onChange={e => setEditFormType(e.target.value as MeetingType)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold focus:outline-none focus:border-eye-brand">
                    <option value="General">{isAr ? 'عام' : 'General'}</option>
                    <option value="Committee">{isAr ? 'لجنة' : 'Committee'}</option>
                    <option value="Department">{isAr ? 'قسم' : 'Department'}</option>
                    <option value="Emergency">{isAr ? 'طارئ' : 'Emergency'}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">
                    {isAr ? 'اللجنة المستهدفة' : 'Target Committee'}
                  </label>
                  {isExecutiveAdmin ? (
                    <select value={editFormCommittee} onChange={e => setEditFormCommittee(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold focus:outline-none focus:border-eye-brand">
                      <option value="All">{isAr ? 'كل اللجان' : 'All Committees'}</option>
                      {['HR','PR','SM','OR'].map(c => <option key={c} value={c}>{c === 'HR' ? (isAr ? 'الموارد البشرية (HR)' : 'HR') : c}</option>)}
                    </select>
                  ) : (
                    <div className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200">
                      {editingMeeting.committee}
                    </div>
                  )}
                </div>
              </div>

              {/* Exact Date & Time */}
              <div className="bg-blue-50/50 dark:bg-blue-950/20 p-3 rounded-2xl border border-blue-200/60 dark:border-blue-800/40 space-y-1.5">
                <label className="block text-xs font-black text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>{isAr ? '📅 الموعد والتوقيت الدقيق (بتوقيت مصر):' : '📅 Date & Time (Cairo Time):'}</span>
                </label>
                <input
                  required
                  value={editFormDate}
                  onChange={e => setEditFormDate(e.target.value)}
                  type="datetime-local"
                  className="w-full bg-white dark:bg-slate-800 border-2 border-blue-300 dark:border-blue-700 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-blue-600"
                />
                {editFormDate && (
                  <p className="text-[11px] font-bold text-blue-700 dark:text-blue-300 flex items-center gap-1">
                    <span>{isAr ? 'التوقيت المختار:' : 'Selected:'}</span>
                    <span className="font-black bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-700">
                      {formatDateTime(editFormDate, isAr ? 'ar' : 'en')}
                    </span>
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">
                    {isAr ? 'المكان أو رابط الاجتماع *' : 'Location or Link *'}
                  </label>
                  <input required value={editFormLocation} onChange={e => setEditFormLocation(e.target.value)}
                    placeholder={isAr ? 'المكان أو رابط الاجتماع' : 'Location or meeting link'}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-eye-brand" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">
                    {isAr ? 'عدد الحضور المتوقع' : 'Target Attendees'}
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={editFormAttendeesCount}
                    onChange={e => setEditFormAttendeesCount(e.target.value)}
                    placeholder={isAr ? 'عدد الحضور' : 'Target count'}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-eye-brand" />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setEditingMeeting(null)}
                  className="flex-1 px-4 py-2.5 text-xs font-bold text-slate-500 hover:text-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl transition-all cursor-pointer">
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button type="submit"
                  className="flex-1 bg-eye-brand hover:bg-eye-brand-dark text-white rounded-xl text-xs font-bold py-2.5 transition-all shadow-sm cursor-pointer">
                  {isAr ? 'حفظ التعديلات ✅' : 'Save Changes ✅'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Attendance Importer Modal */}
      {showImporter && (
        <AttendanceImporter
          currentUser={currentUser}
          onClose={() => { setShowImporter(false); load(); }}
        />
      )}

      {/* ===== FULL-SCREEN MOBILE CHECK-IN MODAL ===== */}
      {mobileCheckInMtg && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-gradient-to-b from-blue-900 via-blue-800 to-indigo-900"
          dir={isRtl ? 'rtl' : 'ltr'}
        >
          {/* Top bar */}
          <div className="flex items-center justify-between px-5 pt-safe pt-6 pb-4 border-b border-white/10">
            <button
              onClick={() => { setMobileCheckInMtg(null); setCheckInCode(''); setCheckInResult(null); setCheckingMtgId(null); }}
              className="flex items-center gap-1.5 text-white/70 hover:text-white text-sm font-bold"
            >
              <XCircle className="w-5 h-5" />
              {isAr ? 'إغلاق' : 'Close'}
            </button>
            <div className="flex items-center gap-2 text-white/80 text-xs font-bold">
              <QrCode className="w-4 h-4" />
              {isAr ? 'تسجيل الحضور' : 'Check-in'}
            </div>
            <div className="w-16" />
          </div>

          {/* Body */}
          <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6">
            {/* Meeting name */}
            <div className="text-center space-y-2">
              <div className="w-16 h-16 rounded-3xl bg-white/10 flex items-center justify-center mx-auto mb-2">
                <CalendarDays className="w-8 h-8 text-white" />
              </div>
              <p className="text-white/60 text-xs font-bold uppercase tracking-widest">
                {isAr ? 'اجتماع' : 'Meeting'}
              </p>
              <h2 className="text-white text-xl font-black leading-snug text-center px-2">
                {mobileCheckInMtg.title}
              </h2>
            </div>

            {/* Code input */}
            <div className="w-full max-w-sm space-y-3">
              <p className="text-white/70 text-xs font-bold text-center">
                {isAr ? 'أدخل الكود السري الذي شاركه معك المسؤول' : 'Enter the secret code shared by your leader'}
              </p>
              <input
                value={checkInCode}
                onChange={e => setCheckInCode(e.target.value.toUpperCase())}
                placeholder="● ● ● ● ● ●"
                maxLength={6}
                autoFocus
                autoCapitalize="characters"
                autoComplete="off"
                inputMode="text"
                className="w-full bg-white/10 border-2 border-white/30 focus:border-white rounded-3xl px-6 py-6 text-4xl font-black text-center tracking-[0.5em] text-white placeholder:text-white/20 focus:outline-none font-mono uppercase transition-colors"
                id="mobile-checkin-code-input"
              />
            </div>

            {/* Mobile Rating & Feedback */}
            <div className="w-full max-w-sm space-y-3">
              <div className="bg-white/10 rounded-2xl p-3 border border-white/15">
                <div className="flex items-center justify-between text-xs font-bold text-white mb-1.5">
                  <span>{isAr ? '⭐ تقييمك للسيشن (اختياري):' : '⭐ Session Rating (Optional):'}</span>
                  <span className="text-amber-300 font-black">{checkInRating} / 5</span>
                </div>
                <div className="flex items-center gap-2 justify-center py-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      type="button"
                      key={star}
                      onClick={() => setCheckInRating(star)}
                      className="p-1 hover:scale-125 transition-transform"
                    >
                      <Star
                        className={`w-7 h-7 ${
                          star <= checkInRating
                            ? 'fill-amber-400 text-amber-400 drop-shadow-[0_2px_8px_rgba(251,191,36,0.6)]'
                            : 'text-white/30'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-white/90 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-blue-300" />
                  <span>{isAr ? '💬 رأيك ومقترحاتك (اختياري - سري للقادة فقط):' : '💬 Feedback & Suggestions (Leaders only):'}</span>
                </label>
                <textarea
                  rows={2}
                  value={checkInFeedback}
                  onChange={e => setCheckInFeedback(e.target.value)}
                  placeholder={isAr ? 'اكتب رأيك أو أي اقتراحات للتطوير...' : 'Share feedback or suggestions...'}
                  className="w-full bg-white/10 border border-white/20 focus:border-white rounded-2xl p-3 text-xs text-white placeholder:text-white/40 focus:outline-none resize-none shadow-inner"
                />
              </div>
            </div>

            {/* Result feedback */}
            {checkInResult && checkingMtgId === mobileCheckInMtg.id && (
              <div className={`w-full max-w-sm flex items-center justify-center gap-3 py-4 px-5 rounded-2xl text-base font-bold ${
                checkInResult === 'ok'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                  : 'bg-red-500/20 text-red-300 border border-red-400/30'
              }`}>
                {checkInResult === 'ok' && <><CheckCircle2 className="w-6 h-6 shrink-0" />{isAr ? 'تم تسجيل حضورك وفيدباكك بنجاح! 🎉' : 'Checked in successfully! 🎉'}</>}
                {checkInResult === 'wrong_code' && <><XCircle className="w-6 h-6 shrink-0" />{isAr ? 'الكود غير صحيح، حاول مجدداً' : 'Wrong code, try again'}</>}
                {checkInResult === 'already' && <><AlertCircle className="w-6 h-6 shrink-0" />{isAr ? 'سبق تسجيل حضورك في هذا الاجتماع ✅' : 'Already checked in ✅'}</>}
                {checkInResult === 'closed' && <><Lock className="w-6 h-6 shrink-0" />{isAr ? 'تسجيل الحضور مغلق الآن' : 'Check-in is closed'}</>}
              </div>
            )}

            {/* Submit button */}
            <button
              onClick={() => {
                setCheckingMtgId(mobileCheckInMtg.id);
                const result = db.checkIn(mobileCheckInMtg.id, checkInCode, currentUser, checkInFeedback, checkInRating);
                setCheckInResult(result);
                if (result === 'ok') {
                  setCheckInCode('');
                  setCheckInFeedback('');
                  setCheckInRating(5);
                  setTimeout(() => { setMobileCheckInMtg(null); setCheckInResult(null); setCheckingMtgId(null); }, 1800);
                }
              }}
              disabled={checkInCode.length < 1}
              className="w-full max-w-sm py-4 bg-white hover:bg-white/90 disabled:bg-white/20 text-blue-900 disabled:text-white/40 rounded-3xl text-lg font-black transition-all active:scale-95 shadow-2xl shadow-black/30 flex items-center justify-center gap-3 cursor-pointer"
            >
              <CheckCircle2 className="w-6 h-6" />
              {isAr ? 'تأكيد الحضور والفيدباك' : 'Confirm Check In'}
            </button>
          </div>

          {/* Bottom safe area spacer */}
          <div className="h-8" />
        </div>
      )}

      {/* ===== LEADER FEEDBACK & SUGGESTIONS MODAL ===== */}
      {viewFeedbackMtg && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4" dir={isRtl ? 'rtl' : 'ltr'}>
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5 max-h-[90vh] flex flex-col modal-panel-animate">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-950/40 flex items-center justify-center text-amber-600 dark:text-amber-400">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <span>{isAr ? 'صندوق آراء ومقترحات الأعضاء' : 'Member Feedback & Suggestions'}</span>
                    <span className="text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-bold px-2 py-0.5 rounded-full border border-amber-300 dark:border-amber-800">
                      {isAr ? 'خاص بالقادة' : 'Leaders Only'}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 font-semibold truncate max-w-md">
                    {viewFeedbackMtg.title}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setViewFeedbackMtg(null)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Feedback Stats & Summary */}
            {(() => {
              const attList = attendanceMap[viewFeedbackMtg.id] || [];
              const feedbackList = attList.filter(a => a.feedback || a.rating);
              const ratedList = attList.filter(a => a.rating !== undefined);
              const avgRating = ratedList.length > 0
                ? (ratedList.reduce((sum, a) => sum + (a.rating || 0), 0) / ratedList.length).toFixed(1)
                : '5.0';

              return (
                <div className="space-y-4 overflow-hidden flex flex-col flex-1">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 p-3.5 rounded-2xl text-center">
                      <p className="text-xl font-black text-amber-700 dark:text-amber-300 flex items-center justify-center gap-1">
                        <span>⭐</span>
                        <span>{avgRating}</span>
                        <span className="text-xs text-amber-500 font-normal">/ 5</span>
                      </p>
                      <p className="text-[10px] font-bold text-amber-800 dark:text-amber-400 mt-0.5">{isAr ? 'متوسط تقييم السيشن' : 'Avg Rating'}</p>
                    </div>

                    <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/60 p-3.5 rounded-2xl text-center">
                      <p className="text-xl font-black text-blue-700 dark:text-blue-300">
                        {feedbackList.length}
                      </p>
                      <p className="text-[10px] font-bold text-blue-800 dark:text-blue-400 mt-0.5">{isAr ? 'عدد المقترحات والملاحظات' : 'Feedback Count'}</p>
                    </div>

                    <div className="col-span-2 sm:col-span-1 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 p-3.5 rounded-2xl text-center">
                      <p className="text-xl font-black text-emerald-700 dark:text-emerald-300">
                        {attList.length}
                      </p>
                      <p className="text-[10px] font-bold text-emerald-800 dark:text-emerald-400 mt-0.5">{isAr ? 'إجمالي الحاضرين' : 'Total Attended'}</p>
                    </div>
                  </div>

                  {/* Feedback Cards List */}
                  <div className="flex-1 overflow-y-auto space-y-3 pe-1">
                    {feedbackList.length === 0 ? (
                      <div className="p-10 text-center text-slate-400">
                        <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-40" />
                        <p className="text-xs font-bold">{isAr ? 'لم يترك أي عضو ملاحظات بعد.' : 'No feedback submitted yet.'}</p>
                      </div>
                    ) : (
                      feedbackList.map((item) => (
                        <div
                          key={item.id}
                          className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 space-y-2 shadow-sm"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <p
                                className="text-xs font-black text-slate-900 dark:text-white cursor-pointer hover:text-eye-brand hover:underline"
                                onClick={() => { setViewFeedbackMtg(null); onNavigateToView?.('profile', item.memberId); }}
                              >
                                {item.memberName}
                              </p>
                              <span className="text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-full font-bold">
                                {item.committee} · {item.department}
                              </span>
                            </div>

                            {item.rating && (
                              <span className="text-xs text-amber-500 font-black">
                                {'⭐'.repeat(Math.min(5, Math.max(1, item.rating)))}
                              </span>
                            )}
                          </div>

                          {item.feedback ? (
                            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-800 whitespace-pre-line">
                              {item.feedback}
                            </p>
                          ) : (
                            <p className="text-[11px] text-slate-400 italic">
                              {isAr ? '(قام العضو بتقييم السيشن دون كتابة نص ملاحظة)' : '(Rated session without text)'}
                            </p>
                          )}

                          <p className="text-[9px] text-slate-400 font-semibold">
                            🕒 {new Date(item.checkedInAt).toLocaleString(isAr ? 'ar-EG' : 'en-GB')}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Footer */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setViewFeedbackMtg(null)}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                {isAr ? 'إغلاق' : 'Close'}
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};
