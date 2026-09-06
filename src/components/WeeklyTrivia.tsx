import React, { useState, useEffect } from 'react';
import { db } from '../db/localDb';
import { WeeklyQuiz, QuizSubmission, UserProfile, QuizQuestionItem } from '../types';
import { useLanguage } from '../lib/LanguageContext';
import {
  Award,
  CheckCircle2,
  XCircle,
  Plus,
  HelpCircle,
  Users,
  Clock,
  Trash2,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Check,
  AlertCircle,
  HelpCircle as QuestionIcon,
  Flame,
  CheckSquare,
  ArrowRight,
  ArrowLeft,
  Info,
  UserCheck,
  ShieldCheck,
  LayoutGrid
} from 'lucide-react';

interface WeeklyTriviaProps {
  currentUser: UserProfile;
}

interface QuestionDraft {
  id: string;
  question: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
  pointsReward: number;
}

export const WeeklyTrivia: React.FC<WeeklyTriviaProps> = ({ currentUser }) => {
  const { language, isRtl } = useLanguage();
  const isAr = language === 'ar';
  const isAdmin = ['Super Admin', 'Head', 'Vice', 'Coordinator', 'Deputy Coordinator', 'Leader'].includes(currentUser.role);

  const [quizzes, setQuizzes] = useState<WeeklyQuiz[]>([]);
  const [selectedQuizId, setSelectedQuizId] = useState<string>('');
  const [submissions, setSubmissions] = useState<QuizSubmission[]>([]);
  const [showCreate, setShowCreate] = useState(false);

  // Active quiz answering state
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<number, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resultMsg, setResultMsg] = useState<{
    type: 'correct' | 'wrong' | 'partial' | 'already';
    score: number;
    total: number;
    points: number;
  } | null>(null);

  // Multi-Question Creation form state
  const [quizTitle, setQuizTitle] = useState('');
  const [quizCommittee, setQuizCommittee] = useState<string>('All');
  const [adminCommitteeFilter, setAdminCommitteeFilter] = useState<string>('All');
  const [questionsDraft, setQuestionsDraft] = useState<QuestionDraft[]>([
    {
      id: 'q-draft-1',
      question: '',
      options: ['', '', '', ''],
      correctAnswerIndex: 0,
      explanation: '',
      pointsReward: 10,
    }
  ]);

  const userCommittee = currentUser.committee || 'None';

  const load = () => {
    const list = db.getQuizzes();
    
    // Filter quizzes based on user role and committee
    let accessibleQuizzes = list;
    if (!isAdmin) {
      accessibleQuizzes = list.filter(q => {
        const comm = q.committee || 'All';
        return comm === 'All' || comm === userCommittee || (userCommittee === 'HR' && comm === 'HR');
      });
    }

    setQuizzes(accessibleQuizzes);
    if (accessibleQuizzes.length > 0) {
      const activeId = selectedQuizId && accessibleQuizzes.some(q => q.id === selectedQuizId)
        ? selectedQuizId
        : accessibleQuizzes[0].id;
      setSelectedQuizId(activeId);
      setSubmissions(db.getQuizSubmissions(activeId));
    } else {
      setSelectedQuizId('');
      setSubmissions([]);
    }
  };

  useEffect(() => {
    load();
    const unsub = db.onChange(load);
    return () => unsub();
  }, [selectedQuizId, adminCommitteeFilter]);

  const [quizTabFilter, setQuizTabFilter] = useState<'all' | 'my' | 'general'>('all');

  const handleSelectQuiz = (quizId: string) => {
    setSelectedQuizId(quizId);
    setCurrentQIndex(0);
    setUserAnswers({});
    setResultMsg(null);
    setSubmissions(db.getQuizSubmissions(quizId));
  };

  const displayedQuizzes = quizzes.filter(q => {
    if (quizTabFilter === 'my') return q.createdBy === currentUser.id;
    if (quizTabFilter === 'general') return !q.committee || q.committee === 'All';
    return true;
  });

  const activeQuiz = quizzes.find(q => q.id === selectedQuizId) || quizzes[0];

  const canDeleteActiveQuiz = isAdmin && Boolean(activeQuiz && (
    currentUser.role === 'Super Admin' ||
    ['Head', 'Vice'].includes(currentUser.role) ||
    activeQuiz.createdBy === currentUser.id
  ));

  // Normalized questions for active quiz
  const activeQuestions: QuizQuestionItem[] = activeQuiz?.questions && activeQuiz.questions.length > 0
    ? activeQuiz.questions
    : activeQuiz
      ? [{
          id: 'q-single',
          question: activeQuiz.question,
          options: activeQuiz.options || [],
          correctAnswerIndex: activeQuiz.correctAnswerIndex ?? 0,
          pointsReward: activeQuiz.pointsReward || 50,
          explanation: ''
        }]
      : [];

  const userSub = activeQuiz
    ? db.getQuizSubmissions(activeQuiz.id).find(s => s.userId === currentUser.id)
    : null;

  // Handle option select
  const handleSelectOption = (qIdx: number, optIdx: number) => {
    if (userSub) return;
    setUserAnswers(prev => ({
      ...prev,
      [qIdx]: optIdx
    }));
  };

  // Submit all answers
  const handleSubmitQuiz = () => {
    if (!activeQuiz || activeQuestions.length === 0) return;
    
    // Check if some questions are not answered
    const unansweredCount = activeQuestions.filter((_, idx) => userAnswers[idx] === undefined).length;
    if (unansweredCount > 0) {
      const confirmSubmit = confirm(
        isAr
          ? `لم تقم بالإجابة على ${unansweredCount} أسئلة بعد. هل تريد بالتأكيد تسليم الإجابات الآن؟`
          : `You have ${unansweredCount} unanswered questions. Are you sure you want to submit now?`
      );
      if (!confirmSubmit) return;
    }

    setIsSubmitting(true);
    const answersArray = activeQuestions.map((_, idx) => userAnswers[idx] ?? -1);
    const res = db.submitQuizAnswer(activeQuiz.id, answersArray, currentUser);

    setResultMsg({
      type: res.status,
      score: res.score,
      total: res.total,
      points: res.pointsEarned
    });

    setIsSubmitting(false);
    load();

    setTimeout(() => {
      setResultMsg(null);
    }, 6000);
  };

  // Create Quiz Form Actions
  const handleAddQuestionDraft = () => {
    setQuestionsDraft(prev => [
      ...prev,
      {
        id: 'q-draft-' + (prev.length + 1) + '-' + Math.random().toString(36).slice(2, 5),
        question: '',
        options: ['', '', '', ''],
        correctAnswerIndex: 0,
        explanation: '',
        pointsReward: 10,
      }
    ]);
  };

  const handleRemoveQuestionDraft = (index: number) => {
    if (questionsDraft.length <= 1) return;
    setQuestionsDraft(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpdateQuestionField = (index: number, field: keyof QuestionDraft, value: any) => {
    setQuestionsDraft(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleUpdateOption = (qIndex: number, optIndex: number, value: string) => {
    setQuestionsDraft(prev => {
      const copy = [...prev];
      const opts = [...copy[qIndex].options];
      opts[optIndex] = value;
      copy[qIndex] = { ...copy[qIndex], options: opts };
      return copy;
    });
  };

  const handleCreateQuizSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (questionsDraft.length === 0) return;

    // Validate that each question has text and at least 2 options
    for (let i = 0; i < questionsDraft.length; i++) {
      const q = questionsDraft[i];
      if (!q.question.trim()) {
        alert(isAr ? `يرجى إدخال نص السؤال رقم ${i + 1}` : `Please enter text for question ${i + 1}`);
        return;
      }
      const filledOptions = q.options.filter(o => o.trim().length > 0);
      if (filledOptions.length < 2) {
        alert(isAr ? `يرجى كتابة خيارين على الأقل للسؤال رقم ${i + 1}` : `Please provide at least 2 options for question ${i + 1}`);
        return;
      }
    }

    const totalPoints = questionsDraft.reduce((acc, q) => acc + (q.pointsReward || 10), 0);

    const questions: QuizQuestionItem[] = questionsDraft.map((q, idx) => ({
      id: `q-${idx + 1}-${Math.random().toString(36).slice(2, 6)}`,
      question: q.question.trim(),
      options: q.options.filter(o => o.trim().length > 0),
      correctAnswerIndex: Math.min(q.correctAnswerIndex, q.options.filter(o => o.trim().length > 0).length - 1),
      explanation: q.explanation.trim(),
      pointsReward: q.pointsReward || 10,
    }));

    db.createQuiz(
      {
        title: quizTitle.trim() || (isAr ? 'المسابقة الأسبوعية 🧠' : 'Weekly Trivia Quiz 🧠'),
        questions,
        pointsReward: totalPoints,
        committee: quizCommittee,
      },
      currentUser
    );

    setShowCreate(false);
    setQuizTitle('');
    setQuizCommittee('All');
    setQuestionsDraft([
      {
        id: 'q-draft-1',
        question: '',
        options: ['', '', '', ''],
        correctAnswerIndex: 0,
        explanation: '',
        pointsReward: 10,
      }
    ]);
    load();
  };

  const handleDeleteQuiz = (quizId: string) => {
    if (confirm(isAr ? 'هل أنت متأكد من حذف هذه المسابقة بالكامل؟' : 'Are you sure you want to delete this quiz?')) {
      db.deleteQuiz(quizId, currentUser);
      load();
    }
  };

  const totalAnsweredCount = Object.keys(userAnswers).length;
  const currentQuestion = activeQuestions[currentQIndex];

  return (
    <div className="p-4 sm:p-6 space-y-6 animate-fade-in max-w-7xl mx-auto" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white p-6 sm:p-8 rounded-3xl border border-purple-500/30 shadow-xl relative overflow-hidden">
        {/* Background decorative glows */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-purple-500/20 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20"></div>

        <div className="relative z-10 space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-purple-500/20 border border-purple-400/30 rounded-full text-purple-200 font-bold text-xs">
            <Flame className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            <span>{isAr ? 'المسابقات والتحديات الأسبوعية' : 'Weekly Trivia & Competitions'}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2">
            <span>{isAr ? 'تحدي المعرفة والذكاء الأسبوعي' : 'Weekly Intelligence Challenge'}</span>
            <span className="text-2xl">🧠</span>
          </h1>
          <p className="text-xs sm:text-sm text-purple-200/80 max-w-2xl font-medium">
            {isAr
              ? 'أجب عن أسئلة التحدي الأسبوعي، اختبر معلوماتك وسرعة بديهتك، واكسب نقاطاً إضافية في لوحة شرف المحافظة!'
              : 'Answer weekly trivia questions, test your knowledge, and earn leaderboard points!'}
          </p>
        </div>

        <div className="relative z-10 flex flex-wrap items-center gap-3">
          {isAdmin && (
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white rounded-2xl text-xs font-bold transition-all shadow-lg hover:shadow-purple-500/25 active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>{isAr ? 'إنشاء مسابقة جديدة' : 'Create New Quiz'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Competitions Browser & Creator Switcher Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-2xl bg-purple-100 dark:bg-purple-950/80 text-purple-600 dark:text-purple-400">
              <Sparkles className="w-4 h-4" />
            </span>
            <div>
              <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span>{isAr ? 'جميع المسابقات والتحديات المطروحة' : 'Available Competitions'}</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-black">
                  {quizzes.length}
                </span>
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                {isAr ? 'اختر مسابقة لمعرفة القائد المعد لها والبدء في خوض التحدي' : 'Select a quiz to view its leader creator and start playing'}
              </p>
            </div>
          </div>

          {/* Quick Filters */}
          <div className="flex items-center gap-1.5 self-start sm:self-auto bg-slate-100 dark:bg-slate-800/80 p-1 rounded-2xl border border-slate-200/60 dark:border-slate-700/60">
            <button
              onClick={() => setQuizTabFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                quizTabFilter === 'all'
                  ? 'bg-white dark:bg-slate-700 text-purple-700 dark:text-purple-300 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              {isAr ? 'الكل' : 'All'} ({quizzes.length})
            </button>
            {isAdmin && (
              <button
                onClick={() => setQuizTabFilter('my')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                  quizTabFilter === 'my'
                    ? 'bg-white dark:bg-slate-700 text-purple-700 dark:text-purple-300 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                <span>⭐</span>
                <span>{isAr ? 'مسابقاتي' : 'My Quizzes'}</span>
                <span className="text-[10px] opacity-80">({quizzes.filter(q => q.createdBy === currentUser.id).length})</span>
              </button>
            )}
            <button
              onClick={() => setQuizTabFilter('general')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                quizTabFilter === 'general'
                  ? 'bg-white dark:bg-slate-700 text-purple-700 dark:text-purple-300 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              {isAr ? 'العامة' : 'General'}
            </button>
          </div>
        </div>

        {/* Competitions Cards Grid */}
        {displayedQuizzes.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {displayedQuizzes.map(quiz => {
              const isSelected = quiz.id === activeQuiz?.id;
              const quizSub = db.getQuizSubmissions(quiz.id).find(s => s.userId === currentUser.id);
              const qCount = quiz.questions && quiz.questions.length > 0 ? quiz.questions.length : 1;
              const isMine = quiz.createdBy === currentUser.id;

              return (
                <div
                  key={quiz.id}
                  onClick={() => handleSelectQuiz(quiz.id)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer text-start relative flex flex-col justify-between gap-3 ${
                    isSelected
                      ? 'bg-purple-50/80 dark:bg-purple-950/40 border-purple-500 ring-2 ring-purple-400/50 shadow-md'
                      : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/80 hover:border-purple-300 dark:hover:border-purple-600 hover:shadow-sm'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700/80 text-slate-600 dark:text-slate-300 truncate max-w-[150px]">
                        {(!quiz.committee || quiz.committee === 'All') ? (isAr ? '🌐 عامة لجميع اللجان' : '🌐 All Committees') : `🎯 ${quiz.committee}`}
                      </span>
                      {quizSub ? (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center gap-1 shrink-0">
                          <Check className="w-2.5 h-2.5" />
                          <span>{isAr ? `تم الحل (${quizSub.score ?? (quizSub.isCorrect ? 1 : 0)}/${quizSub.totalQuestions || qCount})` : 'Done'}</span>
                        </span>
                      ) : (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 shrink-0">
                          {isAr ? 'تحدي جديد 🎯' : 'Available'}
                        </span>
                      )}
                    </div>

                    <h3 className="text-sm font-black text-slate-900 dark:text-white line-clamp-1">
                      {quiz.title || (isAr ? 'مسابقة أسبوعية' : 'Weekly Quiz')}
                    </h3>

                    {/* Creator Info Badge on Card */}
                    <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-700/60">
                      {quiz.creatorAvatar ? (
                        <img
                          src={quiz.creatorAvatar}
                          alt={quiz.createdByName || 'Leader'}
                          className="w-6 h-6 rounded-full object-cover border border-purple-300 shrink-0"
                        />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-600 text-white font-black text-[10px] flex items-center justify-center shrink-0">
                          {quiz.createdByName?.charAt(0) || '👤'}
                        </div>
                      )}
                      <div className="min-w-0 flex-1 flex items-center gap-1.5">
                        <span className="text-[10px] text-slate-400 font-medium shrink-0">
                          {isAr ? 'إعداد:' : 'By:'}
                        </span>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                          {quiz.createdByName || (isAr ? 'إدارة الكيان' : 'Admin')}
                        </span>
                        {quiz.creatorRole && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 shrink-0">
                            {quiz.creatorRole}
                          </span>
                        )}
                      </div>
                      {isMine && (
                        <span className="text-amber-500 text-xs shrink-0" title={isAr ? 'أنت أنشأت هذه المسابقة' : 'Created by you'}>⭐</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium pt-2 border-t border-slate-100/60 dark:border-slate-800">
                    <span>{qCount} {isAr ? 'أسئلة' : 'Q'} • {quiz.pointsReward || (qCount * 10)} {isAr ? 'نقطة' : 'pts'}</span>
                    <span className={`text-xs font-black flex items-center gap-1 ${
                      isSelected ? 'text-purple-600 dark:text-purple-400' : 'text-slate-500 group-hover:text-purple-600'
                    }`}>
                      {isSelected ? (isAr ? '✓ المحددة حالياً' : 'Active') : (isAr ? 'عرض المسابقة ←' : 'View →')}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-8 text-center text-slate-400 space-y-1">
            <p className="text-xs font-bold">{isAr ? 'لا توجد مسابقات في هذا القسم حالياً' : 'No quizzes in this category'}</p>
          </div>
        )}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Quiz Card (Takes 2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          {activeQuiz ? (
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 space-y-6 shadow-sm relative overflow-hidden">
              {/* Quiz Header & Meta */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-black bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 px-2.5 py-1 rounded-full uppercase tracking-wider">
                      {isAr ? 'التحدي النشط' : 'Active Challenge'}
                    </span>
                    {(!activeQuiz.committee || activeQuiz.committee === 'All') ? (
                      <span className="text-[11px] font-black bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 px-2.5 py-1 rounded-full flex items-center gap-1">
                        <span>🌐</span>
                        <span>{isAr ? 'عامة لجميع اللجان' : 'All Committees'}</span>
                      </span>
                    ) : (
                      <span className="text-[11px] font-black bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 px-2.5 py-1 rounded-full flex items-center gap-1">
                        <span>🎯</span>
                        <span>
                          {isAr
                            ? `موجهة للجنة: ${activeQuiz.committee === 'HR' ? 'الموارد البشرية (HR)' : activeQuiz.committee === 'PR' ? 'العلاقات العامة (PR)' : activeQuiz.committee === 'SM' ? 'السوشيال ميديا (SM)' : activeQuiz.committee === 'OR' ? 'التنظيم (OR)' : activeQuiz.committee}`
                            : `Target Committee: ${activeQuiz.committee}`}
                        </span>
                      </span>
                    )}
                    <span className="text-[11px] font-bold text-slate-400">
                      {activeQuestions.length} {isAr ? 'أسئلة' : 'Questions'}
                    </span>
                  </div>
                  <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                    {activeQuiz.title || (isAr ? 'مسابقة التفكير والذكاء الأسبوعية' : 'Weekly Intelligence Quiz')}
                  </h2>
                </div>

                <div className="flex items-center gap-2">
                  <div className="px-3 py-1.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/40 flex items-center gap-1.5 text-xs font-black text-amber-600 dark:text-amber-400">
                    <span>🪙</span>
                    <span>{activeQuiz.pointsReward || (activeQuestions.length * 10)} {isAr ? 'نقطة' : 'pts'}</span>
                  </div>

                  {canDeleteActiveQuiz && (
                    <button
                      onClick={() => handleDeleteQuiz(activeQuiz.id)}
                      className="px-3 py-1.5 rounded-2xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-all flex items-center gap-1.5 text-xs font-bold border border-red-200/60 dark:border-red-800/40"
                      title={isAr ? 'حذف المسابقة' : 'Delete Quiz'}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{isAr ? 'حذف' : 'Delete'}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Active Quiz Creator Highlight Banner */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-50/90 to-indigo-50/70 dark:from-purple-950/40 dark:to-indigo-950/30 border border-purple-200/80 dark:border-purple-800/60 flex flex-wrap items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative shrink-0">
                    {activeQuiz.creatorAvatar ? (
                      <img
                        src={activeQuiz.creatorAvatar}
                        alt={activeQuiz.createdByName || 'Creator'}
                        className="w-11 h-11 rounded-2xl object-cover border-2 border-purple-400 dark:border-purple-600 shadow-sm"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white font-black text-base flex items-center justify-center shadow-md">
                        {activeQuiz.createdByName?.charAt(0) || '👤'}
                      </div>
                    )}
                    <span className="absolute -bottom-1 -end-1 w-4 h-4 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full flex items-center justify-center text-[9px] text-white font-bold" title={isAr ? 'قائد معتمد' : 'Verified Leader'}>
                      ✓
                    </span>
                  </div>

                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-bold text-purple-900 dark:text-purple-300">
                        {isAr ? 'تم إعداد هذه المسابقة بواسطة القائد:' : 'Competition prepared by:'}
                      </span>
                      <span className="text-sm font-black text-slate-900 dark:text-white">
                        {activeQuiz.createdByName || (isAr ? 'إدارة كيان عيون الغربية' : 'Platform Administration')}
                      </span>
                      <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-purple-200/80 dark:bg-purple-900 text-purple-800 dark:text-purple-200 border border-purple-300 dark:border-purple-700">
                        {activeQuiz.creatorRole || 'Leader'}
                      </span>
                      {activeQuiz.createdBy === currentUser.id && (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800 flex items-center gap-1">
                          <span>⭐</span>
                          <span>{isAr ? 'أنت من أنشأها' : 'Created by you'}</span>
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium flex items-center gap-2 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-purple-500 shrink-0" />
                        <span>
                          {new Date(activeQuiz.createdAt).toLocaleDateString(isAr ? 'ar-EG' : 'en-US', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </span>
                      </span>
                      <span>•</span>
                      <span>{activeQuestions.length} {isAr ? 'أسئلة وتحديات مع إجابات نموذجية' : 'Questions with explanations'}</span>
                    </p>
                  </div>
                </div>

                <div className="text-end hidden sm:block">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
                    {isAr ? 'رمز التحدي' : 'Quiz ID'}
                  </span>
                  <span className="text-[11px] font-mono font-bold text-purple-600 dark:text-purple-400">
                    #{activeQuiz.id.slice(-6)}
                  </span>
                </div>
              </div>

              {/* View Mode: If User Already Submitted -> Show Results & Detailed Review */}
              {userSub ? (
                <div className="space-y-6">
                  {/* Result Summary Banner */}
                  <div className={`p-6 rounded-3xl border flex flex-col sm:flex-row items-center justify-between gap-4 ${
                    userSub.isCorrect
                      ? 'bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/20 border-emerald-300 dark:border-emerald-800'
                      : (userSub.score && userSub.score > 0)
                        ? 'bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20 border-amber-300 dark:border-amber-800'
                        : 'bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/20 border-red-300 dark:border-red-800'
                  }`}>
                    <div className="flex items-center gap-4 text-center sm:text-start">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shrink-0 shadow-inner ${
                        userSub.isCorrect
                          ? 'bg-emerald-500 text-white'
                          : (userSub.score && userSub.score > 0)
                            ? 'bg-amber-500 text-white'
                            : 'bg-red-500 text-white'
                      }`}>
                        {userSub.isCorrect ? '🏆' : (userSub.score && userSub.score > 0) ? '👏' : '💡'}
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                          {userSub.isCorrect
                            ? (isAr ? 'إجابات مثالية بالكامل! أحسنت عملًا 🎉' : 'Perfect Score! Outstanding work! 🎉')
                            : (userSub.score && userSub.score > 0)
                              ? (isAr ? `أحسنت! أجبت على ${userSub.score} من ${userSub.totalQuestions || activeQuestions.length} أسئلة صحيحة 👏` : `Great effort! ${userSub.score}/${userSub.totalQuestions || activeQuestions.length} correct!`)
                              : (isAr ? 'للأسف لم تصب هذه المرة، حظاً أوفر في التحدي القادم!' : 'No correct answers this time. Better luck next week!')}
                        </h3>
                        <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                          {isAr ? 'تم تسجيل مشاركتك وإضافة النقاط المكتسبة إلى رصيدك الشخصي' : 'Your submission is recorded and points awarded.'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-center px-4 py-2 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                        <div className="text-xs text-slate-400 font-bold uppercase">{isAr ? 'الدرجة' : 'Score'}</div>
                        <div className="text-lg font-black text-purple-600 dark:text-purple-400">
                          {userSub.score ?? (userSub.isCorrect ? activeQuestions.length : 0)} / {userSub.totalQuestions || activeQuestions.length}
                        </div>
                      </div>
                      <div className="text-center px-4 py-2 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                        <div className="text-xs text-slate-400 font-bold uppercase">{isAr ? 'النقاط' : 'Points'}</div>
                        <div className="text-lg font-black text-amber-500">
                          +{userSub.pointsEarned ?? (userSub.isCorrect ? activeQuiz.pointsReward : 0)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Detailed Question Review List */}
                  <div className="space-y-4 pt-2">
                    <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                      <CheckSquare className="w-4 h-4 text-purple-500" />
                      <span>{isAr ? 'مراجعة الأسئلة والإجابات النموذجية:' : 'Question Review & Model Answers:'}</span>
                    </h4>

                    <div className="space-y-4">
                      {activeQuestions.map((q, qIdx) => {
                        const selectedIdx = userSub.answers ? userSub.answers[qIdx] : (qIdx === 0 ? userSub.answerIndex : undefined);
                        const isCorrectAnswer = selectedIdx === q.correctAnswerIndex;

                        return (
                          <div
                            key={q.id || qIdx}
                            className={`p-5 rounded-2xl border transition-all space-y-3.5 ${
                              isCorrectAnswer
                                ? 'bg-emerald-50/40 dark:bg-slate-900 border-emerald-300/80 dark:border-emerald-800/60 shadow-sm'
                                : 'bg-red-50/40 dark:bg-slate-900 border-red-300/80 dark:border-red-800/60 shadow-sm'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-2.5 flex-1">
                                <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black shrink-0 border ${
                                  isCorrectAnswer
                                    ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                                    : 'bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800'
                                }`}>
                                  {isAr ? `سؤال ${qIdx + 1}` : `Q ${qIdx + 1}`}
                                </span>
                                <h5 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-relaxed">
                                  {q.question}
                                </h5>
                              </div>
                              {isCorrectAnswer ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[10px] font-black shrink-0">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>{isAr ? 'صحيحة' : 'Correct'}</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 text-[10px] font-black shrink-0">
                                  <XCircle className="w-3.5 h-3.5" />
                                  <span>{isAr ? 'خاطئة' : 'Wrong'}</span>
                                </span>
                              )}
                            </div>

                            {/* Options List */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                              {q.options.map((opt, optIdx) => {
                                const isSelectedByMember = selectedIdx === optIdx;
                                const isCorrectChoice = q.correctAnswerIndex === optIdx;

                                let optStyle = 'bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300';
                                let numBadgeStyle = 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300';

                                if (isCorrectChoice) {
                                  optStyle = 'bg-emerald-100/70 dark:bg-emerald-950/70 border-emerald-400 dark:border-emerald-600 text-emerald-900 dark:text-emerald-200 font-bold shadow-sm';
                                  numBadgeStyle = 'bg-emerald-200 dark:bg-emerald-800 text-emerald-900 dark:text-emerald-100 font-black';
                                } else if (isSelectedByMember && !isCorrectChoice) {
                                  optStyle = 'bg-red-100/70 dark:bg-red-950/70 border-red-400 dark:border-red-600 text-red-900 dark:text-red-200 font-semibold shadow-sm';
                                  numBadgeStyle = 'bg-red-200 dark:bg-red-800 text-red-900 dark:text-red-100 font-black';
                                }

                                return (
                                  <div
                                    key={optIdx}
                                    className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-2.5 transition-all ${optStyle}`}
                                  >
                                    <div className="flex items-center gap-2.5">
                                      <span className={`w-5 h-5 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 ${numBadgeStyle}`}>
                                        {optIdx + 1}
                                      </span>
                                      <span className="font-semibold">{opt}</span>
                                    </div>

                                    {isCorrectChoice && (
                                      <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 flex items-center gap-1 shrink-0">
                                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                                        {isAr ? 'الإجابة النموذجية' : 'Model Answer'}
                                      </span>
                                    )}
                                    {isSelectedByMember && !isCorrectChoice && (
                                      <span className="text-[10px] font-black text-red-700 dark:text-red-400 flex items-center gap-1 shrink-0">
                                        <XCircle className="w-3.5 h-3.5" />
                                        {isAr ? 'إجابتك' : 'Your Answer'}
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>

                            {/* Explanation if present */}
                            {q.explanation && (
                              <div className="p-3 bg-purple-50/70 dark:bg-purple-950/40 border border-purple-200/80 dark:border-purple-800/60 rounded-xl text-xs flex items-start gap-2 text-purple-950 dark:text-purple-200">
                                <Info className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
                                <div>
                                  <span className="font-bold">{isAr ? 'التوضيح والتفسير: ' : 'Explanation: '}</span>
                                  <span>{q.explanation}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                /* Active Answering Mode */
                <div className="space-y-6">
                  {/* Question Progress Bar and Jump Pills */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                      <span className="flex items-center gap-1.5 text-purple-600 dark:text-purple-400">
                        <Sparkles className="w-4 h-4" />
                        <span>
                          {isAr ? `السؤال ${currentQIndex + 1} من ${activeQuestions.length}` : `Question ${currentQIndex + 1} of ${activeQuestions.length}`}
                        </span>
                      </span>
                      <span>
                        {isAr ? `تمت الإجابة على (${totalAnsweredCount} / ${activeQuestions.length})` : `Answered (${totalAnsweredCount} / ${activeQuestions.length})`}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-purple-500 to-indigo-600 h-full rounded-full transition-all duration-300"
                        style={{ width: `${(totalAnsweredCount / activeQuestions.length) * 100}%` }}
                      ></div>
                    </div>

                    {/* Question Jump Pills */}
                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                      {activeQuestions.map((_, idx) => {
                        const isCurrent = idx === currentQIndex;
                        const isAnswered = userAnswers[idx] !== undefined;
                        return (
                          <button
                            key={idx}
                            onClick={() => setCurrentQIndex(idx)}
                            className={`w-8 h-8 rounded-xl text-xs font-black transition-all flex items-center justify-center ${
                              isCurrent
                                ? 'bg-purple-600 text-white ring-2 ring-purple-400 ring-offset-2 scale-110 shadow-sm'
                                : isAnswered
                                  ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-800'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200'
                            }`}
                          >
                            {idx + 1}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Active Question Box */}
                  {currentQuestion ? (
                    <div className="space-y-5 bg-slate-50 dark:bg-slate-900/90 p-5 sm:p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
                      <div className="space-y-2">
                        <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 text-[11px] font-black">
                          <span>{isAr ? `السؤال رقم ${currentQIndex + 1}` : `Question #${currentQIndex + 1}`}</span>
                        </div>
                        <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-snug">
                          {currentQuestion.question}
                        </h3>
                      </div>

                      {/* Options List */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                        {currentQuestion.options.map((opt, optIdx) => {
                          const isSelected = userAnswers[currentQIndex] === optIdx;
                          return (
                            <button
                              key={optIdx}
                              onClick={() => handleSelectOption(currentQIndex, optIdx)}
                              className={`w-full text-start p-4 rounded-2xl text-xs font-bold transition-all border flex items-center justify-between gap-3 group ${
                                isSelected
                                  ? 'bg-purple-50 dark:bg-purple-950/30 border-purple-500 text-purple-700 dark:text-purple-300 shadow-sm ring-1 ring-purple-400'
                                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-purple-300 dark:hover:border-purple-700'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <span className={`w-6 h-6 rounded-xl flex items-center justify-center text-xs font-black transition-all ${
                                  isSelected
                                    ? 'bg-purple-600 text-white'
                                    : 'bg-slate-100 dark:bg-slate-700 text-slate-500 group-hover:bg-purple-100 group-hover:text-purple-600'
                                }`}>
                                  {optIdx + 1}
                                </span>
                                <span className="text-sm">{opt}</span>
                              </div>
                              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                isSelected
                                  ? 'border-purple-600 bg-purple-600 text-white'
                                  : 'border-slate-300 dark:border-slate-600'
                              }`}>
                                {isSelected && <Check className="w-2.5 h-2.5" />}
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      {/* Navigation and Submit Buttons */}
                      <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-200/60 dark:border-slate-800">
                        <button
                          disabled={currentQIndex === 0}
                          onClick={() => setCurrentQIndex(prev => Math.max(0, prev - 1))}
                          className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                            currentQIndex === 0
                              ? 'text-slate-300 dark:text-slate-700 cursor-not-allowed'
                              : 'text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {isRtl ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                          <span>{isAr ? 'السؤال السابق' : 'Previous'}</span>
                        </button>

                        <div className="flex items-center gap-2">
                          {currentQIndex < activeQuestions.length - 1 ? (
                            <button
                              onClick={() => setCurrentQIndex(prev => Math.min(activeQuestions.length - 1, prev + 1))}
                              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
                            >
                              <span>{isAr ? 'السؤال التالي' : 'Next'}</span>
                              {isRtl ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            </button>
                          ) : (
                            <button
                              disabled={isSubmitting || totalAnsweredCount === 0}
                              onClick={handleSubmitQuiz}
                              className={`px-6 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all text-white shadow-md active:scale-95 ${
                                totalAnsweredCount > 0
                                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700'
                                  : 'bg-slate-300 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                              }`}
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              <span>{isAr ? 'تأكيد وتسليم جميع الإجابات 🚀' : 'Submit All Answers 🚀'}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-12 text-center text-slate-400 space-y-3 shadow-sm">
              <div className="w-16 h-16 rounded-full bg-purple-50 dark:bg-purple-950/40 text-purple-400 flex items-center justify-center mx-auto text-2xl">
                🧠
              </div>
              <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">
                {isAr ? 'لا توجد مسابقات نشطة حالياً' : 'No active quizzes currently.'}
              </h3>
              <p className="text-xs text-slate-500">
                {isAr ? 'ترقب المسابقات القادمة قريباً للمشاركة وكسب النقاط!' : 'Stay tuned for upcoming weekly challenges!'}
              </p>
            </div>
          )}
        </div>

        {/* Submissions & Participants Sidebar */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-2">
                <Users className="w-4 h-4 text-purple-500" />
                <span>{isAr ? 'لوحة المشاركين في التحدي' : 'Participants Leaderboard'}</span>
              </h3>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-300">
                {submissions.length} {isAr ? 'مشارك' : 'entries'}
              </span>
            </div>

            <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
              {submissions.map((sub, sIdx) => {
                const isPerfect = sub.isCorrect;
                return (
                  <div
                    key={sub.id || sIdx}
                    className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700 flex items-center justify-between gap-3 hover:border-purple-200 dark:hover:border-purple-800 transition-all"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                        {sub.userName?.charAt(0) || '👤'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                          {sub.userName}
                        </p>
                        <p className="text-[10px] text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{new Date(sub.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </p>
                      </div>
                    </div>

                    <div className="text-end shrink-0 space-y-0.5">
                      <div className="flex items-center justify-end gap-1">
                        {isPerfect ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <span className="text-[11px] font-black text-purple-600 dark:text-purple-400">
                            {sub.score ?? (sub.isCorrect ? 1 : 0)} / {sub.totalQuestions || activeQuestions.length}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-bold text-amber-500 block">
                        +{sub.pointsEarned ?? (sub.isCorrect ? activeQuiz?.pointsReward : 0)} pts
                      </span>
                    </div>
                  </div>
                );
              })}

              {submissions.length === 0 && (
                <div className="text-center py-10 text-slate-400 space-y-2">
                  <QuestionIcon className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-xs font-semibold">{isAr ? 'كن أول من يجيب على هذا التحدي!' : 'Be the first to solve this trivia!'}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Admin Multi-Question Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 my-6 modal-panel-animate max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="space-y-1">
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="p-1.5 rounded-xl bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400">
                    <Sparkles className="w-4 h-4" />
                  </span>
                  <span>{isAr ? 'إنشاء مسابقة أسبوعية جديدة (متعددة الأسئلة)' : 'Create Weekly Quiz (Multi-Question)'}</span>
                </h3>
                <p className="text-xs text-slate-500">
                  {isAr ? 'أضف عنوان المسابقة وعدداً من الأسئلة والخيارات والإجابات النموذجية' : 'Add questions, options, correct answers and explanations'}
                </p>
              </div>
              <button
                onClick={() => setShowCreate(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateQuizSubmit} className="space-y-6">
              {/* Creator Attribution Box */}
              <div className="p-4 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60 flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-sm">
                  {currentUser.fullName?.charAt(0) || '👤'}
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs font-black text-purple-900 dark:text-purple-200 flex items-center gap-1.5">
                    <span>{isAr ? 'توثيق هوية قائد المسابقة:' : 'Leader Identification:'}</span>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-purple-200 dark:bg-purple-900 text-purple-800 dark:text-purple-200">
                      {currentUser.role}
                    </span>
                  </p>
                  <p className="text-[11px] text-purple-700 dark:text-purple-300 font-medium">
                    {isAr 
                      ? `سيتم نشر المسابقة رسميًا باسمك (${currentUser.fullName}) وستظهر هويتك كقائد ومعد للمسابقة لجميع الأعضاء والمشاركين.`
                      : `This quiz will be officially published under your name (${currentUser.fullName}).`}
                  </p>
                </div>
              </div>

              {/* Quiz Title */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {isAr ? 'عنوان المسابقة الأسبوعية:' : 'Quiz Title:'}
                </label>
                <input
                  required
                  value={quizTitle}
                  onChange={e => setQuizTitle(e.target.value)}
                  placeholder={isAr ? 'مثال: مسابقة الذكاء والتفكير الأسبوعية 🧠🔥' : 'e.g. Weekly Trivia Challenge'}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 text-xs font-semibold focus:outline-none focus:border-purple-500"
                />
              </div>

              {/* Target Committee */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {isAr ? 'توجيه المسابقة للجنة معينة (اختياري):' : 'Target Committee (Optional):'}
                </label>
                <select
                  value={quizCommittee}
                  onChange={e => setQuizCommittee(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 text-xs font-bold focus:outline-none focus:border-purple-500"
                >
                  <option value="All">{isAr ? '🌐 عامة لجميع اللجان (متاحة لكل أعضاء المحافظة)' : '🌐 All Committees (General)'}</option>
                  <option value="HR">{isAr ? '👥 لجنة الموارد البشرية (HR)' : '👥 Human Resources (HR)'}</option>
                  <option value="PR">{isAr ? '🤝 لجنة العلاقات العامة (PR)' : '🤝 Public Relations (PR)'}</option>
                  <option value="SM">{isAr ? '📱 لجنة السوشيال ميديا والتسويق (SM)' : '📱 Social Media (SM)'}</option>
                  <option value="OR">{isAr ? '🎪 لجنة التنظيم (OR)' : '🎪 Organization (OR)'}</option>
                </select>
              </div>

              {/* Questions List */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    {isAr ? `الأسئلة المطروحة (${questionsDraft.length}):` : `Questions List (${questionsDraft.length}):`}
                  </label>
                  <button
                    type="button"
                    onClick={handleAddQuestionDraft}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 hover:bg-purple-100 text-xs font-bold transition-all border border-purple-200/50 dark:border-purple-800/40"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{isAr ? 'إضافة سؤال آخر' : 'Add Question'}</span>
                  </button>
                </div>

                <div className="space-y-4">
                  {questionsDraft.map((qDraft, qIdx) => (
                    <div
                      key={qDraft.id || qIdx}
                      className="p-5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80 space-y-4 relative"
                    >
                      <div className="flex items-center justify-between">
                        <span className="px-2.5 py-1 rounded-xl bg-purple-600 text-white font-black text-xs">
                          {isAr ? `السؤال رقم ${qIdx + 1}` : `Question #${qIdx + 1}`}
                        </span>

                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1 text-[11px] font-bold text-slate-500">
                            <span>{isAr ? 'النقاط:' : 'Pts:'}</span>
                            <input
                              type="number"
                              min="1"
                              value={qDraft.pointsReward}
                              onChange={e => handleUpdateQuestionField(qIdx, 'pointsReward', Number(e.target.value))}
                              className="w-14 text-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg py-0.5 text-xs font-bold"
                            />
                          </div>

                          {questionsDraft.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveQuestionDraft(qIdx)}
                              className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-all"
                              title={isAr ? 'حذف السؤال' : 'Remove question'}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Question Text */}
                      <input
                        required
                        value={qDraft.question}
                        onChange={e => handleUpdateQuestionField(qIdx, 'question', e.target.value)}
                        placeholder={isAr ? `نص السؤال رقم ${qIdx + 1}...` : `Question text #${qIdx + 1}...`}
                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:outline-none focus:border-purple-500"
                      />

                      {/* Options */}
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                          {isAr ? 'الخيارات الأربعة (حدد الإجابة الصحيحة بالضغط على الدائرة):' : 'Options (Select correct radio):'}
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {qDraft.options.map((opt, optIdx) => (
                            <div
                              key={optIdx}
                              className={`flex items-center gap-2 p-2 rounded-xl border bg-white dark:bg-slate-800 ${
                                qDraft.correctAnswerIndex === optIdx
                                  ? 'border-emerald-500 ring-1 ring-emerald-400 bg-emerald-50/20'
                                  : 'border-slate-200 dark:border-slate-700'
                              }`}
                            >
                              <input
                                type="radio"
                                name={`correct-${qIdx}`}
                                checked={qDraft.correctAnswerIndex === optIdx}
                                onChange={() => handleUpdateQuestionField(qIdx, 'correctAnswerIndex', optIdx)}
                                className="accent-emerald-600 w-4 h-4 cursor-pointer"
                                title={isAr ? 'تعيين كإجابة صحيحة' : 'Set as correct answer'}
                              />
                              <input
                                required
                                value={opt}
                                onChange={e => handleUpdateOption(qIdx, optIdx, e.target.value)}
                                placeholder={`${isAr ? 'خيار' : 'Option'} ${optIdx + 1}`}
                                className="flex-1 bg-transparent text-xs font-medium focus:outline-none"
                              />
                              {qDraft.correctAnswerIndex === optIdx && (
                                <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950">
                                  {isAr ? 'صحيحة ✅' : 'Correct'}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Explanation */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 block">
                          {isAr ? 'توضيح الإجابة / التفسير بعد الحل (اختياري):' : 'Explanation after answering (Optional):'}
                        </label>
                        <input
                          value={qDraft.explanation}
                          onChange={e => handleUpdateQuestionField(qIdx, 'explanation', e.target.value)}
                          placeholder={isAr ? 'مثال: لأنك أخذت 2 فهما اللذان معك...' : 'Explanation text...'}
                          className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total points summary & Actions */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="text-xs font-bold text-slate-500">
                  <span>{isAr ? 'إجمالي نقاط المسابقة: ' : 'Total Points: '}</span>
                  <span className="text-amber-500 font-black">
                    🪙 {questionsDraft.reduce((acc, q) => acc + (q.pointsReward || 10), 0)} pts
                  </span>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setShowCreate(false)}
                    className="flex-1 sm:flex-initial px-5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    {isAr ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    className="flex-1 sm:flex-initial px-6 py-2.5 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-md shadow-purple-500/20 active:scale-95 transition-all"
                  >
                    {isAr ? 'نشر المسابقة الآن 🚀' : 'Publish Quiz 🚀'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating feedback alert */}
      {resultMsg && (
        <div className="fixed bottom-8 inset-x-0 flex justify-center z-50 px-4 animate-bounce">
          <div className={`px-6 py-3.5 rounded-2xl shadow-2xl font-bold text-sm flex items-center gap-2.5 text-white ${
            resultMsg.type === 'correct'
              ? 'bg-emerald-600'
              : resultMsg.type === 'partial'
                ? 'bg-amber-600'
                : 'bg-red-500'
          }`}>
            {resultMsg.type === 'correct' ? (
              <>
                <CheckCircle2 className="w-5 h-5" />
                <span>
                  {isAr
                    ? `تهانينا! أحرزت الدرجة الكاملة (${resultMsg.score}/${resultMsg.total}) وكسبت ${resultMsg.points} نقطة! 🎉`
                    : `Perfect! Full score (${resultMsg.score}/${resultMsg.total}) +${resultMsg.points} pts! 🎉`}
                </span>
              </>
            ) : resultMsg.type === 'partial' ? (
              <>
                <Award className="w-5 h-5" />
                <span>
                  {isAr
                    ? `أحسنت! نتيجتك: ${resultMsg.score} من ${resultMsg.total} وكسبت ${resultMsg.points} نقطة! 👏`
                    : `Great! Score: ${resultMsg.score}/${resultMsg.total} +${resultMsg.points} pts! 👏`}
                </span>
              </>
            ) : (
              <>
                <XCircle className="w-5 h-5" />
                <span>
                  {isAr
                    ? 'للأسف لم تصب أي إجابة، حظاً أوفر في التحدي القادم!'
                    : 'Better luck next week!'}
                </span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
