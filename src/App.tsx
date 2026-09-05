import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { db } from './db/localDb';
import { UserProfile } from './types';
import { LandingPage } from './components/LandingPage';
import { Auth } from './components/Auth';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { MobileBottomNav } from './components/MobileBottomNav';
import { DashboardStats } from './components/DashboardStats';
import { useTheme } from './lib/ThemeContext';
import { isSupabaseConfigured, supabase } from './lib/supabaseClient';
import { SupabaseConfigError } from './components/SupabaseConfigError';
import { requestPushPermission, triggerPushFromSystemNotif, registerServiceWorker, recordUserVisit, registerPeriodicSync } from './lib/pushNotifications';
import { sendEmailAlert } from './lib/emailService';
import { DobPromptBanner } from './components/DobPromptBanner';
import { BirthdayModal } from './components/BirthdayModal';
import { YouthWelcomeModal } from './components/YouthWelcomeModal';
import { OccasionBanner } from './components/OccasionBanner';
import { ProfileCompletionModal } from './components/ProfileCompletionModal';
import { ProfileUpdatePromptModal } from './components/ProfileUpdatePromptModal';
import { OzyAIAssistant } from './components/OzyAIAssistant';
import { DeveloperWatermark } from './components/DeveloperWatermark';
import { playRoyalNotificationSound } from './lib/notificationSound';

import { ErrorBoundary } from './components/ErrorBoundary';

// Helper for safe lazy loading with auto-recovery on new deployment chunk changes
function safeLazy<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T } | any>,
  componentName?: string
) {
  return lazy(async () => {
    try {
      const module = await factory();
      if (module && module.default) return { default: module.default };
      if (componentName && module && module[componentName]) return { default: module[componentName] };
      return module;
    } catch (error: any) {
      console.warn(`[safeLazy] Chunk load error for ${componentName || 'component'}, reloading...`, error);
      const isChunkFailure =
        error?.message?.includes('Failed to fetch dynamically imported module') ||
        error?.message?.includes('Importing a module script failed') ||
        error?.name === 'ChunkLoadError';
      if (isChunkFailure) {
        const key = `chunk_reload_${componentName || 'view'}`;
        const lastAttempt = sessionStorage.getItem(key);
        if (!lastAttempt || Date.now() - Number(lastAttempt) > 6000) {
          sessionStorage.setItem(key, String(Date.now()));
          window.location.reload();
        }
      }
      throw error;
    }
  });
}

// Heavy Workspace Views - Lazy Loaded with Safe Auto-Recovery
const TaskBoard = safeLazy(() => import('./components/TaskBoard').then(m => ({ default: m.TaskBoard })), 'TaskBoard');
const Announcements = safeLazy(() => import('./components/Announcements').then(m => ({ default: m.Announcements })), 'Announcements');
const MemberProfile = safeLazy(() => import('./components/MemberProfile').then(m => ({ default: m.MemberProfile })), 'MemberProfile');
const SettingsPanel = safeLazy(() => import('./components/SettingsPanel').then(m => ({ default: m.SettingsPanel })), 'SettingsPanel');
const Leaderboard = safeLazy(() => import('./components/Leaderboard').then(m => ({ default: m.Leaderboard })), 'Leaderboard');
const SocialMediaView = safeLazy(() => import('./components/SocialMediaView').then(m => ({ default: m.SocialMediaView })), 'SocialMediaView');
const MeetingAttendance = safeLazy(() => import('./components/MeetingAttendance').then(m => ({ default: m.MeetingAttendance })), 'MeetingAttendance');
const FeedbackSystem = safeLazy(() => import('./components/FeedbackSystem').then(m => ({ default: m.FeedbackSystem })), 'FeedbackSystem');
const WorkPlansOKR = safeLazy(() => import('./components/WorkPlansOKR').then(m => ({ default: m.WorkPlansOKR })), 'WorkPlansOKR');
const IdeaBank = safeLazy(() => import('./components/IdeaBank').then(m => ({ default: m.IdeaBank })), 'IdeaBank');
const InternalAcademy = safeLazy(() => import('./components/InternalAcademy').then(m => ({ default: m.InternalAcademy })), 'InternalAcademy');
const ExecutiveReportBuilder = safeLazy(() => import('./components/ExecutiveReportBuilder').then(m => ({ default: m.ExecutiveReportBuilder })), 'ExecutiveReportBuilder');
const CommitteeChat = safeLazy(() => import('./components/CommitteeChat').then(m => ({ default: m.CommitteeChat })), 'CommitteeChat');
const WeeklyChallenges = safeLazy(() => import('./components/WeeklyChallenges').then(m => ({ default: m.WeeklyChallenges })), 'WeeklyChallenges');
const TemplatesHub = safeLazy(() => import('./components/TemplatesHub').then(m => ({ default: m.TemplatesHub })), 'TemplatesHub');
const RewardsShop = safeLazy(() => import('./components/RewardsShop').then(m => ({ default: m.RewardsShop })), 'RewardsShop');
const PerformanceRadar = safeLazy(() => import('./components/PerformanceRadar').then(m => ({ default: m.PerformanceRadar })), 'PerformanceRadar');
const WeeklyTrivia = safeLazy(() => import('./components/WeeklyTrivia').then(m => ({ default: m.WeeklyTrivia })), 'WeeklyTrivia');
const CertificateGenerator = safeLazy(() => import('./components/CertificateGenerator').then(m => ({ default: m.CertificateGenerator })), 'CertificateGenerator');
const ExcusesAndFreezeModal = safeLazy(() => import('./components/ExcusesAndFreezeModal').then(m => ({ default: m.ExcusesAndFreezeModal })), 'ExcusesAndFreezeModal');
const PollsManager = safeLazy(() => import('./components/PollsManager').then(m => ({ default: m.PollsManager })), 'PollsManager');
const RulesAndBylaws = safeLazy(() => import('./components/RulesAndBylaws').then(m => ({ default: m.RulesAndBylaws })), 'RulesAndBylaws');
const MemoryWall = safeLazy(() => import('./components/MemoryWall').then(m => ({ default: m.MemoryWall })), 'MemoryWall');
const MemberOfTheMonth = safeLazy(() => import('./components/MemberOfTheMonth').then(m => ({ default: m.MemberOfTheMonth })), 'MemberOfTheMonth');
const DigitalPortfolio = safeLazy(() => import('./components/DigitalPortfolio').then(m => ({ default: m.DigitalPortfolio })), 'DigitalPortfolio');
const DisciplinaryRecords = safeLazy(() => import('./components/DisciplinaryRecords').then(m => ({ default: m.DisciplinaryRecords })), 'DisciplinaryRecords');
const SocialPosterMaker = safeLazy(() => import('./components/SocialPosterMaker').then(m => ({ default: m.SocialPosterMaker })), 'SocialPosterMaker');

const ViewSkeletonLoader = () => (
  <div className="p-6 space-y-6 animate-pulse">
    <div className="h-10 bg-slate-200 dark:bg-slate-800 rounded-2xl w-1/3"></div>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded-3xl"></div>
      <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded-3xl"></div>
      <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded-3xl"></div>
    </div>
    <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded-3xl w-full"></div>
  </div>
);

export default function App() {
  const { theme } = useTheme();
  // Synchronous session initialization to prevent mobile login flicker and stall
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    try {
      return db.getCurrentUser();
    } catch {
      return null;
    }
  });

  const [currentView, setCurrentView] = useState<string>(() => {
    try {
      const href = typeof window !== 'undefined' ? window.location.href : '';
      if (href.includes('type=recovery') || href.includes('type%3Drecovery')) {
        return 'reset-password';
      }
      return db.getCurrentUser() ? 'dashboard' : 'login';
    } catch {
      return 'login';
    }
  });
  
  // Mobile Sidebar Toggler
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Ref for main scrollable content area — used to scroll-to-top on view change
  const mainScrollRef = useRef<HTMLElement>(null);
  
  // Targeted Task Focus from notification clicks or Selected Profile User ID
  const [notifTargetTaskId, setNotifTargetTaskId] = useState<string | undefined>(undefined);
  const [selectedUserId, setSelectedUserId] = useState<string | undefined>(undefined);

  // Real-time Position / Role Change Toast Banner
  const [roleChangeToast, setRoleChangeToast] = useState<{ show: boolean; newRole: string; details: string } | null>(null);
  const prevUserRef = useRef<{ role?: string; committee?: string; department?: string; subCommittee?: string } | null>(null);
  const prevUserRefId = useRef<string | null>(null);

  // Connects to Supabase and restores the logged-in session (if any)
  const [dbReady, setDbReady] = useState(false);
  const [showEmailConfirmed, setShowEmailConfirmed] = useState(false);
  const [authErrorMsg, setAuthErrorMsg] = useState<string>('');

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setDbReady(true);
      return;
    }

    let isPasswordRecovery = false;

    // 1. Listen for real-time Auth state events (specifically PASSWORD_RECOVERY)
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event: string) => {
      if (event === 'PASSWORD_RECOVERY') {
        isPasswordRecovery = true;
        setCurrentView('reset-password');
        setDbReady(true);
      } else if (event === 'SIGNED_OUT') {
        if (currentView !== 'reset-password' && currentView !== 'forgot') {
          setCurrentUser(null);
          setCurrentView('login');
        }
      }
    });

    const checkEmailConfirmation = async () => {
      const href = window.location.href;
      const hash = window.location.hash.replace(/^#/, '');
      const search = window.location.search.replace(/^\?/, '');

      const hashParams = new URLSearchParams(hash);
      const searchParams = new URLSearchParams(search);

      // Check for errors returned by Supabase Auth (e.g. expired or invalid reset link)
      const errorDesc = hashParams.get('error_description') || searchParams.get('error_description');
      const errorCode = hashParams.get('error_code') || searchParams.get('error_code');
      const errorParam = hashParams.get('error') || searchParams.get('error');

      if (errorParam || errorDesc || errorCode) {
        window.history.replaceState(null, '', window.location.pathname);
        setAuthErrorMsg(errorDesc ? decodeURIComponent(errorDesc.replace(/\+/g, ' ')) : 'رابط استعادة كلمة المرور غير صالح أو انتهت صلاحيته.');
        setCurrentView('login');
        setDbReady(true);
        return;
      }

      const hasSignupType = href.includes('type=signup') || href.includes('type%3Dsignup') || hashParams.get('type') === 'signup';
      const hasRecoveryType = href.includes('type=recovery') || href.includes('type%3Drecovery') || hashParams.get('type') === 'recovery';
      const hasAccessToken = href.includes('access_token=') || href.includes('access_token%3D') || hashParams.has('access_token');
      const hasCode = searchParams.has('code');

      if (hasRecoveryType || isPasswordRecovery) {
        isPasswordRecovery = true;
        try {
          const initTimeout = new Promise((resolve) => setTimeout(resolve, 6000));
          await Promise.race([db.init(), initTimeout]);
        } catch (err) {
          console.warn('[App] DB init warning during recovery:', err);
        }
        // Clean URL while keeping user on reset password form
        window.history.replaceState(null, '', window.location.pathname);
        setCurrentView('reset-password');
        setDbReady(true);
        return;
      }

      if (hasSignupType && (hasAccessToken || hasCode)) {
        try {
          await db.init();
          await db.logout();
        } catch {}
        // Clear hash from URL
        window.history.replaceState(null, '', window.location.pathname);
        setShowEmailConfirmed(true);
        setCurrentView('login');
        setDbReady(true);
        return;
      }

      try {
        const initTimeout = new Promise((resolve) => setTimeout(resolve, 6000));
        await Promise.race([db.init(), initTimeout]);
      } catch (err) {
        console.warn('[App] DB init warning:', err);
      } finally {
        if (!isPasswordRecovery) {
          const saved = db.getCurrentUser();
          if (saved) {
            setCurrentUser(saved);
            setCurrentView(prev => (prev === 'login' || prev === 'register' ? 'dashboard' : prev));
            db.checkDeadlineNotifications();
            setTimeout(async () => {
              await requestPushPermission(false);
              await registerServiceWorker();
              await registerPeriodicSync();
              recordUserVisit(saved.id);
            }, 1000);
          }
        }
        setDbReady(true);
      }
    };

    checkEmailConfirmation();

    // Check deadlines periodically
    const deadlineInterval = setInterval(() => {
      db.checkDeadlineNotifications();
    }, 60000);

    // Subscribe to DB changes to synchronize current user state without triggering full-app re-renders
    const unsubscribe = db.onChange(() => {
      if (!isPasswordRecovery) {
        const saved = db.getCurrentUser();
        if (saved) {
          setCurrentUser(prev => {
            if (!prev) return saved;
            if (
              prev.id === saved.id &&
              prev.fullName === saved.fullName &&
              prev.role === saved.role &&
              prev.committee === saved.committee &&
              prev.department === saved.department &&
              prev.status === saved.status &&
              prev.avatarUrl === saved.avatarUrl &&
              prev.bonusPoints === saved.bonusPoints &&
              prev.membershipCode === saved.membershipCode
            ) {
              return prev;
            }
            return saved;
          });
        }
      }
    });

    return () => {
      clearInterval(deadlineInterval);
      unsubscribe();
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  const handleAuthSuccess = (user: UserProfile) => {
    setCurrentUser(user);
    setCurrentView('dashboard');
    // Register push subscription and SW silently without intrusive prompt
    setTimeout(async () => {
      await requestPushPermission(false);
      await registerServiceWorker();
      await registerPeriodicSync();
      recordUserVisit(user.id);
    }, 1000);
  };

  // --- Push Notification bridge: fire browser push when in-app notifs arrive ---
  useEffect(() => {
    if (!currentUser) {
      prevUserRef.current = null;
      prevUserRefId.current = null;
      return;
    }

    if (prevUserRef.current && prevUserRefId.current === currentUser.id) {
      const prev = prevUserRef.current;
      const roleChanged = prev.role && prev.role !== currentUser.role;
      const committeeChanged = prev.committee && prev.committee !== currentUser.committee;
      const deptChanged = prev.department && prev.department !== currentUser.department;
      const subCommitteeChanged = prev.subCommittee && prev.subCommittee !== currentUser.subCommittee;

      if (roleChanged || committeeChanged || deptChanged || subCommitteeChanged) {
        playRoyalNotificationSound();
        setRoleChangeToast({
          show: true,
          newRole: currentUser.role,
          details: `🎉 تم تحديث منصبك الإداري وصلاحياتك فوراً إلى (${currentUser.role}) ${currentUser.committee && currentUser.committee !== 'None' ? '✦ لجنة ' + currentUser.committee : ''} ${currentUser.department ? '(' + currentUser.department + ')' : ''}`,
        });
      }
    }

    prevUserRef.current = {
      role: currentUser.role,
      committee: currentUser.committee,
      department: currentUser.department,
      subCommittee: currentUser.subCommittee,
    };
    prevUserRefId.current = currentUser.id;
  }, [currentUser?.role, currentUser?.committee, currentUser?.department, currentUser?.subCommittee, currentUser?.id]);
  // NOTE: Push notifications are now triggered directly inside addNotification/addNotificationsBulk
  // to avoid firing multiple times from the onChange listener. Removed the onChange listener here.

  // --- Deadline Reminder: check every 30 minutes for tasks due within 24h (optimized via requestIdleCallback) ---
  useEffect(() => {
    if (!currentUser || currentUser.role !== 'Member') return;
    const checkDeadlines = () => {
      const runCheck = () => {
        const now = new Date();
        const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        const tasks = db.getTasks().filter(t => t.status === 'Published');
        const subs = db.getSubmissions();
        tasks.forEach(task => {
          if (!task.deadline) return;
          const deadline = new Date(task.deadline);
          if (isNaN(deadline.getTime())) return;

          if (deadline > now && deadline <= in24h) {
            // Ensure task is targeted to current user
            const isAssigned = Array.isArray(task.assignedMemberIds) && task.assignedMemberIds.length > 0;
            if (isAssigned) {
              if (!task.assignedMemberIds.some(id => String(id).trim() === String(currentUser.id).trim())) return;
            } else {
              const isHrmTask = task.committee === 'HR' || task.committee === 'HRM';
              const isHrmUser = currentUser.committee === 'HR' || currentUser.committee === 'HRM' || currentUser.department === 'HRM';
              const matchComm = task.committee === 'All' || (isHrmTask ? isHrmUser : currentUser.committee === task.committee);
              const matchDept = !task.department || task.department === 'All' || task.department === 'General' || task.department === 'None' || currentUser.department === task.department;
              if (!matchComm || !matchDept) return;
            }

            const alreadySubmitted = subs.some(s => 
              String(s.taskId).trim() === String(task.id).trim() && 
              String(s.memberId).trim() === String(currentUser.id).trim()
            );
            if (!alreadySubmitted) {
              const emailKey = `eye_email_24h_${task.id}_${currentUser.id}_${now.toISOString().split('T')[0]}`;
              if (!localStorage.getItem(emailKey)) {
                try {
                  localStorage.setItem(emailKey, 'true');
                  const deadlineStr = deadline.toLocaleString('ar-EG');
                  const html = `
                    <div dir="rtl" style="font-family:'Cairo',Tahoma,Arial,sans-serif;text-align:right;padding:20px;border:1px solid #e2e8f0;border-radius:12px;max-width:600px;margin:0 auto;background:#fff;color:#1e293b;">
                      <div style="text-align:center;margin-bottom:20px;border-bottom:2px solid #f59e0b;padding-bottom:15px;">
                        <h2 style="color:#f59e0b;margin:0;">EYE Tasks ⏰ تذكير بالموعد النهائي</h2>
                      </div>
                      <h3>مرحباً ${currentUser.fullName}،</h3>
                      <p style="font-size:14px;line-height:1.6;">تذكير بأن مهمة <strong>${task.name}</strong> ستنتهي خلال أقل من 24 ساعة ولم تقم بالتسليم بعد.</p>
                      <div style="background:#fffbeb;padding:15px;border-radius:8px;border-right:4px solid #f59e0b;">
                        <p style="font-size:13px;color:#dc2626;"><strong>الموعد النهائي:</strong> ${deadlineStr}</p>
                      </div>
                      <div style="text-align:center;margin:25px 0 10px 0;">
                        <a href="https://eye-workflow-hub.vercel.app" style="background:#f59e0b;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:bold;display:inline-block;font-size:13px;">سارع وسلّم الآن</a>
                      </div>
                    </div>`;
                  sendEmailAlert([currentUser.email], `[EYE Tasks] تذكير: موعد ${task.name} ينتهي خلال 24 ساعة`, html);
                } catch {}
              }
            }
          }
        });
      };

      if ('requestIdleCallback' in window) {
        (window as any).requestIdleCallback(() => runCheck(), { timeout: 3000 });
      } else {
        setTimeout(runCheck, 0);
      }
    };
    checkDeadlines();
    const interval = setInterval(checkDeadlines, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [currentUser]);

  // --- Meeting Reminder: check for meetings starting within 30 minutes ---
  useEffect(() => {
    if (!currentUser) return;
    const checkMeetings = () => {
      const meetings = (db as any).getMeetings ? (db as any).getMeetings() : [];
      const now = Date.now();
      const in30m = now + 30 * 60 * 1000;

      meetings.forEach((m: any) => {
        const mTime = new Date(m.date || m.scheduledAt || '').getTime();
        if (mTime > now && mTime <= in30m && !m.reminded) {
          if (m.committee === 'All' || m.committee === currentUser.committee || currentUser.role !== 'Member') {
            m.reminded = true;
            triggerPushFromSystemNotif(
              '🗓️ تذكير اجتماع قريب',
              `اجتماع "${m.title || m.name}" سيبدأ بعد قليل! جهّز نفسك للانضمام.`,
              'info'
            );
          }
        }
      });
    };
    checkMeetings();
    const interval = setInterval(checkMeetings, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [currentUser]);

  // --- Re-engagement: record visit on each app open ---
  useEffect(() => {
    if (!currentUser) return;
    recordUserVisit(currentUser.id);
  }, [currentUser?.id]);

  const handleLogout = async () => {
    await db.logout();
    setCurrentUser(null);
    setCurrentView('login');
  };

  const [navigationHistory, setNavigationHistory] = useState<{ view: string; targetId?: string }[]>([]);

  // Automatically scroll main container and window to top on every view or target change
  useEffect(() => {
    if (mainScrollRef.current) {
      mainScrollRef.current.scrollTop = 0;
      mainScrollRef.current.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [currentView, selectedUserId, notifTargetTaskId]);

  const handleNavigateToView = (view: string, targetId?: string) => {
    if (currentView !== view) {
      setNavigationHistory(prev => [...prev, { view: currentView, targetId: selectedUserId || notifTargetTaskId }]);
      try {
        window.history.pushState({ view, targetId }, '', '');
      } catch {}
    }

    setCurrentView(view);
    if (mainScrollRef.current) {
      mainScrollRef.current.scrollTop = 0;
      mainScrollRef.current.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });

    if (view === 'profile' && targetId) {
      setSelectedUserId(targetId);
      setNotifTargetTaskId(undefined);
    } else if (targetId) {
      setNotifTargetTaskId(targetId);
      setSelectedUserId(undefined);
    } else {
      setNotifTargetTaskId(undefined);
      setSelectedUserId(undefined);
    }
  };

  const handleGoBack = () => {
    if (navigationHistory.length > 0) {
      const last = navigationHistory[navigationHistory.length - 1];
      setNavigationHistory(prev => prev.slice(0, prev.length - 1));
      setCurrentView(last.view);
      if (last.view === 'profile' && last.targetId) {
        setSelectedUserId(last.targetId);
      } else if (last.targetId) {
        setNotifTargetTaskId(last.targetId);
      }
    } else if (currentView !== 'dashboard') {
      setCurrentView('dashboard');
    }
  };

  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (e.state && e.state.view) {
        setCurrentView(e.state.view);
        if (e.state.targetId) {
          if (e.state.view === 'profile') setSelectedUserId(e.state.targetId);
          else setNotifTargetTaskId(e.state.targetId);
        }
      } else {
        handleGoBack();
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [navigationHistory, currentView]);

  // --- RENDERING ROUTER ENGINE ---
  const renderWorkspaceView = () => {
    if (!currentUser) return <LandingPage onNavigate={(view) => setCurrentView(view)} />;

    switch (currentView) {
      case 'dashboard':
      case 'committee-chat':
        return <DashboardStats currentUser={currentUser} onNavigateToView={handleNavigateToView} />;
      case 'templates-hub':
        return <TemplatesHub currentUser={currentUser} />;
      case 'tasks':
        return <TaskBoard currentUser={currentUser} selectedTaskIdFromNotification={notifTargetTaskId} onNavigateToView={handleNavigateToView} />;
      case 'announcements':
        return <Announcements currentUser={currentUser} onNavigateToView={handleNavigateToView} />;
      case 'leaderboard':
        return <FeedbackSystem currentUser={currentUser} initialTab="leaderboard" onNavigateToView={handleNavigateToView} />;
      case 'meetings':
        return <MeetingAttendance currentUser={currentUser} onNavigateToView={handleNavigateToView} />;
      case 'feedback':
        return <FeedbackSystem currentUser={currentUser} initialTab="evaluations" onNavigateToView={handleNavigateToView} />;
      case 'workplans':
        return <WorkPlansOKR currentUser={currentUser} />;
      case 'ideabank':
      case 'polls':
        return <IdeaBank currentUser={currentUser} onNavigateToView={handleNavigateToView} />;
      case 'trivia':
        return <WeeklyTrivia currentUser={currentUser} />;
      case 'academy':
      case 'challenges':
      case 'memory-wall':
        return <DashboardStats currentUser={currentUser} onNavigateToView={handleNavigateToView} />;
      case 'exec-report':
        return <ExecutiveReportBuilder currentUser={currentUser} />;
      case 'rewards':
        return <RewardsShop currentUser={currentUser} />;
      case 'radar':
        if (currentUser.role === 'Member') {
          return <DashboardStats currentUser={currentUser} onNavigateToView={handleNavigateToView} />;
        }
        return <PerformanceRadar currentUser={currentUser} />;
      case 'certificates':
        return <CertificateGenerator currentUser={currentUser} />;
      case 'excuses-freeze':
        return <ExcusesAndFreezeModal currentUser={currentUser} onNavigateToView={handleNavigateToView} />;
      case 'rules':
        return <RulesAndBylaws currentUser={currentUser} />;
      case 'member-month':
        return <MemberOfTheMonth currentUser={currentUser} />;
      case 'portfolio':
        return <DigitalPortfolio currentUser={currentUser} targetUserId={selectedUserId} />;
      case 'disciplinary':
      case 'disciplinary-members':
        return <DisciplinaryRecords currentUser={currentUser} selectedRecordId={notifTargetTaskId} />;
      case 'poster-maker':
        return <SocialPosterMaker currentUser={currentUser} />;
      case 'profile':
        return <MemberProfile currentUser={currentUser} selectedCertId={notifTargetTaskId} targetUserId={selectedUserId} onNavigateToView={handleNavigateToView} onGoBack={handleGoBack} />;
      case 'social':
        return <SocialMediaView />;
      case 'settings':
        if (!['Super Admin', 'Head', 'Vice', 'HRM'].includes(currentUser.role)) {
          return <DashboardStats currentUser={currentUser} onNavigateToView={handleNavigateToView} />;
        }
        return <SettingsPanel currentUser={currentUser} onNavigateToView={handleNavigateToView} />;
      default:
        return <DashboardStats currentUser={currentUser} onNavigateToView={handleNavigateToView} />;
    }
  };

  // Check if Supabase connection details are missing
  if (!isSupabaseConfigured) {
    return <SupabaseConfigError />;
  }

  // 1. PUBLIC VIEWS (Auth screens)
  if (!currentUser || currentView === 'landing' || currentView === 'login' || currentView === 'register' || currentView === 'reset-password' || currentView === 'forgot') {
    const activeMode = currentView === 'register' ? 'register' : currentView === 'reset-password' ? 'reset-password' : currentView === 'forgot' ? 'forgot' : 'login';
    return (
      <Auth
        initialMode={activeMode}
        onAuthSuccess={handleAuthSuccess}
        onNavigateHome={() => {
          setCurrentView('login');
          setAuthErrorMsg('');
        }}
        showEmailConfirmedMsg={showEmailConfirmed}
        initialErrorMsg={authErrorMsg}
      />
    );
  }

  // 2. PROTECTED ENTERPRISE WORKSPACE LAYOUT
  const unreadNotifCount = currentUser ? (db.getNotifications(currentUser.id) || []).filter(n => !n.isRead).length : 0;

  return (
    <div className="flex h-screen supports-[height:100dvh]:h-[100dvh] overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-250" id="eye-workspace-root">
      
      {/* Sidebar Navigation */}
      <Sidebar
        currentUser={currentUser}
        currentView={currentView}
        onViewChange={(view) => {
          handleNavigateToView(view);
        }}
        onLogout={handleLogout}
        isOpen={mobileSidebarOpen}
        setIsOpen={setMobileSidebarOpen}
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
      />

      {/* Main Workspace Body */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        
        {/* Top Header */}
        <Header
          currentUser={currentUser}
          currentView={currentView}
          onMenuToggle={() => setMobileSidebarOpen(!mobileSidebarOpen)}
          onNavigateToView={handleNavigateToView}
          onGoBack={handleGoBack}
        />

        {/* Dynamic Inner View viewport */}
        <main ref={mainScrollRef} className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900/60 relative p-4 md:p-6 pb-24 lg:pb-6 safe-pb-mobile">
          {/* Real-time Role / Position Promotion Toast Alert */}
          {roleChangeToast?.show && (
            <div className="fixed top-5 right-5 left-5 md:left-auto md:max-w-md z-50 bg-gradient-to-r from-amber-600 via-amber-500 to-amber-700 text-white p-4 rounded-2xl shadow-2xl shadow-amber-500/50 border border-amber-300/40 animate-bounce transition-all flex items-start gap-3">
              <div className="text-2xl p-2 bg-white/20 rounded-xl backdrop-blur-md shrink-0">👑</div>
              <div className="flex-1 min-w-0">
                <h4 className="font-extrabold text-sm text-amber-100">تم تحديث منصبك وصلاحياتك مباشرة!</h4>
                <p className="text-xs font-medium text-white/95 mt-1 leading-relaxed">{roleChangeToast.details}</p>
              </div>
              <button
                onClick={() => setRoleChangeToast(null)}
                className="text-amber-100 hover:text-white font-bold p-1 rounded-lg hover:bg-white/10 transition-colors shrink-0"
                title="إغلاق"
              >
                ✕
              </button>
            </div>
          )}

          {/* Missing Date of Birth Prompt Banner */}
          <DobPromptBanner currentUser={currentUser} />

          {/* Active Festive Holiday / Occasion Banner */}
          <OccasionBanner currentUser={currentUser} />

          <div key={currentView} className="animate-page-enter min-h-full">
            <ErrorBoundary fallbackTitle="تعذر تحميل محتوى هذه الصفحة">
              <Suspense fallback={<ViewSkeletonLoader />}>
                {renderWorkspaceView()}
              </Suspense>
            </ErrorBoundary>
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (Visible on phones) */}
      <MobileBottomNav
        currentView={currentView}
        onViewChange={handleNavigateToView}
        currentUser={currentUser}
        onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
        unreadAnnouncementsCount={unreadNotifCount}
      />

      {/* One-time Profile Completion Modal for members with missing data */}
      <ProfileCompletionModal
        currentUser={currentUser}
        onComplete={(updated) => setCurrentUser(updated)}
      />

      {/* Targeted Profile Update Request Modal */}
      <ProfileUpdatePromptModal
        currentUser={currentUser}
        onUpdated={(updated) => setCurrentUser(updated)}
      />

      {/* Birthday Greeting Modal */}
      <BirthdayModal currentUser={currentUser} />

      {/* Egyptian Youth Motivational Welcome Pop-up */}
      <YouthWelcomeModal currentUser={currentUser} />

      {/* Floating Developer Watermark across Platform */}
      <DeveloperWatermark variant="floating" />
    </div>
  );
}
