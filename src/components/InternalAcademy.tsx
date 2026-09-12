import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../db/localDb';
import { AcademyCourse, UserProfile, AcademyResourceType } from '../types';
import { useLanguage } from '../lib/LanguageContext';
import {
  BookOpen,
  Plus,
  CheckCircle2,
  Video,
  FileText,
  Search,
  Trash2,
  ExternalLink,
  Play,
  X,
  Edit3,
  Clock,
  User,
  Sparkles,
  Filter,
  Bookmark,
  Share2,
  Tv,
  Library,
  BookMarked,
  Check
} from 'lucide-react';

interface InternalAcademyProps {
  currentUser: UserProfile;
}

// Helper: Extract YouTube ID cleanly from any YouTube URL format
function extractYouTubeId(url?: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  const match = trimmed.match(
    /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=|shorts\/|live\/)|youtu\.be\/)([^"&?\/ ]{11})/i
  );
  return match ? match[1] : null;
}

export const InternalAcademy: React.FC<InternalAcademyProps> = ({ currentUser }) => {
  const { language, isRtl } = useLanguage();
  const isAr = language === 'ar';

  const isAdminOrLeader = [
    'Super Admin',
    'Head',
    'Vice',
    'Coordinator',
    'Deputy Coordinator',
    'Leader',
    'HRM',
  ].includes(currentUser.role) || currentUser.department === 'HRM' || currentUser.committee === 'HR';

  const [courses, setCourses] = useState<AcademyCourse[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'video' | 'book' | 'article'>('all');
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [selectedCommittee, setSelectedCommittee] = useState<string>('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'uncompleted' | 'completed'>('all');

  // Modals state
  const [showModal, setShowModal] = useState(false);
  const [editingCourse, setEditingCourse] = useState<AcademyCourse | null>(null);

  // Form state
  const [formData, setFormData] = useState<{
    title: string;
    description: string;
    type: AcademyResourceType;
    category: string;
    committee: string;
    videoUrl: string;
    linkUrl: string;
    duration: string;
    author: string;
    pointsReward: number;
  }>({
    title: '',
    description: '',
    type: 'video',
    category: '',
    committee: 'All',
    videoUrl: '',
    linkUrl: '',
    duration: '',
    author: currentUser.fullName || '',
    pointsReward: 0,
  });

  // Active video player modal state
  const [activePlayingVideo, setActivePlayingVideo] = useState<{
    id: string;
    title: string;
    youtubeId: string;
    description?: string;
    author?: string;
    pointsReward?: number;
  } | null>(null);

  // Load courses
  const load = () => {
    let all = db.getCourses();
    // Filter by committee visibility: Members see 'All' and their own committee
    if (currentUser.role === 'Member') {
      all = all.filter(c => c.committee === 'All' || c.committee === currentUser.committee);
    }
    setCourses(all);
  };

  useEffect(() => {
    load();
    const unsub = db.onChange(load);
    return () => unsub();
  }, [currentUser]);

  // Dynamic categories derived directly from available courses added by admin
  const categories = useMemo(() => {
    const set = new Set<string>();
    courses.forEach(c => {
      if (c.category && c.category.trim()) {
        set.add(c.category.trim());
      }
    });
    return ['All', ...Array.from(set)];
  }, [courses]);

  // Handle open create/edit modal
  const handleOpenCreate = () => {
    setEditingCourse(null);
    setFormData({
      title: '',
      description: '',
      type: 'video',
      category: '',
      committee: 'All',
      videoUrl: '',
      linkUrl: '',
      duration: '',
      author: currentUser.fullName || '',
      pointsReward: 0,
    });
    setShowModal(true);
  };

  const handleOpenEdit = (course: AcademyCourse) => {
    setEditingCourse(course);
    setFormData({
      title: course.title,
      description: course.description,
      type: course.type || (course.videoUrl ? 'video' : 'reference'),
      category: course.category || '',
      committee: course.committee || 'All',
      videoUrl: course.videoUrl || '',
      linkUrl: course.linkUrl || '',
      duration: course.duration || '',
      author: course.author || '',
      pointsReward: Number(course.pointsReward || 0),
    });
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    if (editingCourse) {
      db.updateCourse(
        editingCourse.id,
        {
          title: formData.title,
          description: formData.description,
          category: formData.category.trim() || (isAr ? 'عام' : 'General'),
          committee: formData.committee,
          type: formData.type,
          videoUrl: formData.videoUrl,
          linkUrl: formData.linkUrl,
          duration: formData.duration,
          author: formData.author,
          pointsReward: Number(formData.pointsReward || 0),
        },
        currentUser
      );
    } else {
      db.createCourse(
        formData.title,
        formData.description,
        formData.category.trim() || (isAr ? 'عام' : 'General'),
        formData.committee,
        currentUser,
        {
          type: formData.type,
          videoUrl: formData.videoUrl,
          linkUrl: formData.linkUrl,
          duration: formData.duration,
          author: formData.author,
          pointsReward: Number(formData.pointsReward || 0),
        }
      );
    }

    setShowModal(false);
    load();
  };

  // Filter courses
  const filteredCourses = useMemo(() => {
    return courses.filter(c => {
      // Tab filter (Type)
      if (activeTab === 'video') {
        if (c.type !== 'video' && !c.videoUrl) return false;
      } else if (activeTab === 'book') {
        if (c.type !== 'book' && c.type !== 'reference') return false;
      } else if (activeTab === 'article') {
        if (c.type !== 'article' && c.type !== 'guide') return false;
      }

      // Category filter
      if (activeCategory !== 'All' && c.category !== activeCategory) {
        return false;
      }

      // Committee filter
      if (selectedCommittee !== 'All' && c.committee !== selectedCommittee) {
        return false;
      }

      // Completed / Uncompleted filter
      const isCompleted = c.completedBy.includes(currentUser.id);
      if (statusFilter === 'completed' && !isCompleted) return false;
      if (statusFilter === 'uncompleted' && isCompleted) return false;

      // Search term
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesTitle = c.title.toLowerCase().includes(q);
        const matchesDesc = c.description.toLowerCase().includes(q);
        const matchesAuthor = c.author?.toLowerCase().includes(q);
        const matchesCategory = c.category?.toLowerCase().includes(q);
        return matchesTitle || matchesDesc || matchesAuthor || matchesCategory;
      }

      return true;
    });
  }, [courses, activeTab, activeCategory, selectedCommittee, statusFilter, searchTerm, currentUser.id]);

  const completedCount = courses.filter(c => c.completedBy.includes(currentUser.id)).length;
  const totalCount = courses.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="p-4 md:p-8 space-y-8 animate-fade-in max-w-7xl mx-auto" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* ── TOP HERO HEADER ── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/20 p-6 md:p-8 text-white shadow-xl shadow-indigo-950/20">
        {/* Decorative background blurs */}
        <div className="absolute -top-24 -right-24 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-bold tracking-wide">
              <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              <span>{isAr ? 'بنك التطوير والتعلم الذاتي • غير إجباري' : 'Self-Paced Resources & Knowledge'}</span>
            </div>
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-black tracking-tight text-white flex items-center gap-3">
              <span>{isAr ? 'حاجات هتفيدك 💡' : 'Helpful Resources 💡'}</span>
            </h1>
            <p className="text-xs md:text-sm text-slate-300 font-medium leading-relaxed">
              {isAr
                ? 'مساحتك الخاصة لمشاهدة فيديوهات يوتيوب والاستفادة من الكتب والمراجع المفيدة براحتك وفي أي وقت.'
                : 'Your dedicated space for YouTube learning sessions, books, and references to boost your knowledge at your own pace.'}
            </p>

            {/* Micro stats banner */}
            <div className="flex flex-wrap items-center gap-4 pt-2 text-xs font-semibold text-slate-300">
              <div className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-xl backdrop-blur-md">
                <Library className="w-4 h-4 text-indigo-400" />
                <span>{totalCount} {isAr ? 'مرجع ومادة' : 'Resources'}</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-xl backdrop-blur-md">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>{completedCount} {isAr ? 'تم الإطلاع عليها' : 'Completed'}</span>
              </div>
              {totalCount > 0 && (
                <div className="flex items-center gap-2 bg-emerald-500/20 border border-emerald-500/30 px-3 py-1.5 rounded-xl text-emerald-300">
                  <span>{isAr ? `إنجازك: ${progressPercent}%` : `Progress: ${progressPercent}%`}</span>
                </div>
              )}
            </div>
          </div>

          {/* Right Action */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            {isAdminOrLeader && (
              <button
                onClick={handleOpenCreate}
                className="px-5 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-2xl text-xs md:text-sm font-black shadow-lg shadow-emerald-600/30 hover:shadow-emerald-600/50 transition-all flex items-center justify-center gap-2 transform active:scale-95"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>{isAr ? 'إضافة مادة أو فيديو جديد' : 'Add New Resource'}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── CONTROLS & FILTERING ── */}
      <div className="space-y-4">
        {/* Main Tabs (All / Videos / Books / Articles) */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'all'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Library className="w-4 h-4" />
              <span>{isAr ? 'الكل' : 'All'}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/20">{courses.length}</span>
            </button>

            <button
              onClick={() => setActiveTab('video')}
              className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'video'
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-600/25'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Tv className="w-4 h-4" />
              <span>{isAr ? 'فيديوهات يوتيوب 🎬' : 'YouTube Videos 🎬'}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/20">
                {courses.filter(c => c.type === 'video' || c.videoUrl).length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('book')}
              className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'book'
                  ? 'bg-amber-600 text-white shadow-md shadow-amber-600/25'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>{isAr ? 'كتب ومراجع 📚' : 'Books & References 📚'}</span>
            </button>

            <button
              onClick={() => setActiveTab('article')}
              className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'article'
                  ? 'bg-teal-600 text-white shadow-md shadow-teal-600/25'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>{isAr ? 'مقالات وأدلة 📑' : 'Articles & Guides 📑'}</span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-72">
            <input
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder={isAr ? 'ابحث في المراجع والفيديوهات...' : 'Search resources & videos...'}
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500 shadow-sm transition-all"
            />
            {searchTerm ? (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute left-3 rtl:left-auto rtl:right-3 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            ) : (
              <Search className="absolute left-3 rtl:left-auto rtl:right-3 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
            )}
          </div>
        </div>

        {/* Sub-Filters: Categories & Committee & Status */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Categories */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
            <span className="text-slate-400 font-bold ml-1 rtl:ml-0 rtl:mr-1">{isAr ? 'المجال:' : 'Field:'}</span>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all border ${
                  activeCategory === cat
                    ? 'bg-slate-800 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-800 dark:border-slate-100'
                    : 'bg-white dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Committee & Status Dropdowns */}
          <div className="flex items-center gap-2">
            <select
              value={selectedCommittee}
              onChange={e => setSelectedCommittee(e.target.value)}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:border-indigo-500 shadow-sm text-xs"
            >
              <option value="All">{isAr ? 'كل اللجان' : 'All Committees'}</option>
              {['HR', 'PR', 'SM', 'OR'].map(c => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as any)}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:border-indigo-500 shadow-sm text-xs"
            >
              <option value="all">{isAr ? 'كل الحالات' : 'All Status'}</option>
              <option value="uncompleted">{isAr ? 'لم أشاهده بعد ⏳' : 'To Watch / Read ⏳'}</option>
              <option value="completed">{isAr ? 'تم الإطلاع عليه ✅' : 'Completed ✅'}</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── RESOURCES GRID ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCourses.map(course => {
          const isCompleted = course.completedBy.includes(currentUser.id);
          const ytId = extractYouTubeId(course.videoUrl);
          const isVideo = (course.type === 'video' || !!ytId) && !!course.videoUrl;
          const isBook = course.type === 'book' || course.type === 'reference';
          const ytThumbnail = ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : null;

          return (
            <div
              key={course.id}
              className={`group bg-white dark:bg-slate-900/90 rounded-3xl border transition-all duration-300 flex flex-col justify-between overflow-hidden shadow-sm hover:shadow-xl ${
                isCompleted
                  ? 'border-emerald-500/30 dark:border-emerald-500/20'
                  : 'border-slate-200/80 dark:border-slate-800 hover:border-indigo-500/40'
              }`}
            >
              {/* Card Header / Thumbnail */}
              <div>
                {/* Visual Thumbnail / Banner */}
                {isVideo && ytThumbnail ? (
                  <div
                    onClick={() =>
                      setActivePlayingVideo({
                        id: course.id,
                        title: course.title,
                        youtubeId: ytId!,
                        description: course.description,
                        author: course.author,
                      })
                    }
                    className="relative aspect-video w-full bg-slate-950 overflow-hidden cursor-pointer group-hover:brightness-105 transition-all"
                  >
                    <img
                      src={ytThumbnail}
                      alt={course.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-slate-950/40 group-hover:bg-slate-950/20 transition-all flex items-center justify-center">
                      <div className="w-14 h-14 rounded-2xl bg-rose-600/90 hover:bg-rose-600 text-white flex items-center justify-center shadow-xl shadow-rose-900/40 transform group-hover:scale-110 transition-transform">
                        <Play className="w-6 h-6 fill-current translate-x-0.5" />
                      </div>
                    </div>

                    {/* Duration badge */}
                    {course.duration && (
                      <div className="absolute bottom-3 right-3 rtl:right-auto rtl:left-3 bg-slate-900/80 backdrop-blur-md text-white text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1">
                        <Clock className="w-3 h-3 text-amber-400" />
                        <span>{course.duration}</span>
                      </div>
                    )}

                    {/* YouTube Brand badge */}
                    <div className="absolute top-3 left-3 rtl:left-auto rtl:right-3 bg-rose-600 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 shadow-md">
                      <Tv className="w-3 h-3" />
                      <span>YouTube</span>
                    </div>
                  </div>
                ) : (
                  <div className="p-6 pb-2 bg-gradient-to-br from-slate-50 to-indigo-50/40 dark:from-slate-800/40 dark:to-indigo-950/20 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-sm ${
                            isBook ? 'bg-amber-600' : 'bg-teal-600'
                          }`}
                        >
                          {isBook ? <BookOpen className="w-4.5 h-4.5" /> : <FileText className="w-4.5 h-4.5" />}
                        </span>
                        <div>
                          <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            {course.category}
                          </span>
                        </div>
                      </div>

                      {course.duration && (
                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-indigo-500" />
                          <span>{course.duration}</span>
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Body Content */}
                <div className="p-5 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-extrabold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2.5 py-0.5 rounded-lg border border-indigo-200/50 dark:border-indigo-800/50">
                      {course.committee === 'All' ? (isAr ? 'متاح للجميع' : 'All Teams') : `${course.committee} Team`}
                    </span>

                    <div className="flex items-center gap-2">
                      {/* Points badge if admin assigned points */}
                      {Number(course.pointsReward || 0) > 0 ? (
                        <span className="text-[10px] font-black text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-lg border border-amber-300/60 dark:border-amber-700/60 flex items-center gap-1">
                          <Sparkles className="w-3 h-3 fill-amber-400 text-amber-500" />
                          <span>+{course.pointsReward} {isAr ? 'نقطة' : 'pts'}</span>
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg">
                          {isAr ? 'بدون نقاط' : 'No Points'}
                        </span>
                      )}

                      {/* Read count */}
                      <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                        <span>👁️</span>
                        <span>{course.readsCount || 0}</span>
                      </span>
                    </div>
                  </div>

                  <h3 className="text-base font-black text-slate-900 dark:text-white leading-snug group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    {course.title}
                  </h3>

                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed line-clamp-3">
                    {course.description}
                  </p>

                  {/* Author / Instructor info */}
                  {course.author && (
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 dark:text-slate-300 pt-1">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span>{course.author}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="p-5 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-900/50">
                {/* Left side: Completed toggle & Admin edit/delete */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => db.trackRead(course.id, currentUser.id)}
                    title={isAr ? 'تحديد كـ تمت المشاهدة أو الإلغاء' : 'Toggle Completed'}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                      isCompleted
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {isCompleted ? (
                      <>
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                        <span>{isAr ? 'تم الإطلاع' : 'Done'}</span>
                      </>
                    ) : (
                      <>
                        <Bookmark className="w-3.5 h-3.5" />
                        <span>{isAr ? 'تحديد كمكتمل' : 'Mark Done'}</span>
                      </>
                    )}
                  </button>

                  {isAdminOrLeader && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEdit(course)}
                        title={isAr ? 'تعديل المادة' : 'Edit Resource'}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-lg transition-colors"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={async () => {
                          if (confirm(isAr ? 'هل أنت متأكد من حذف هذه المادة نهائياً من قاعدة البيانات؟' : 'Permanently delete this resource from database?')) {
                            await db.deleteCourse(course.id, currentUser);
                            load();
                          }
                        }}
                        title={isAr ? 'حذف المادة نهائياً' : 'Delete Resource'}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Right side: Primary launch action */}
                {isVideo && ytId ? (
                  <button
                    onClick={() =>
                      setActivePlayingVideo({
                        id: course.id,
                        title: course.title,
                        youtubeId: ytId,
                        description: course.description,
                        author: course.author,
                        pointsReward: course.pointsReward,
                      })
                    }
                    className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black shadow-md shadow-rose-600/20 transition-all flex items-center gap-1.5 shrink-0"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>{isAr ? 'تشغيل' : 'Play'}</span>
                  </button>
                ) : course.linkUrl ? (
                  <a
                    href={course.linkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => {
                      if (!isCompleted) db.trackRead(course.id, currentUser.id);
                    }}
                    className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-md shadow-indigo-600/20 transition-all flex items-center gap-1.5 shrink-0"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>{isAr ? 'فتح المرجع' : 'Open Link'}</span>
                  </a>
                ) : (
                  <button
                    onClick={() => db.trackRead(course.id, currentUser.id)}
                    className="px-3.5 py-1.5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-black transition-all flex items-center gap-1"
                  >
                    <span>{isAr ? 'تفاصيل' : 'Details'}</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {filteredCourses.length === 0 && (
          <div className="col-span-full bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-16 text-center shadow-sm space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-500 flex items-center justify-center mx-auto">
              <Sparkles className="w-8 h-8 text-amber-400" />
            </div>
            <div className="space-y-1">
              <h4 className="text-base font-black text-slate-800 dark:text-slate-200">
                {isAr ? 'لا توجد عناصر مضافة بعد' : 'No items added yet'}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                {isAr
                  ? 'هذا القسم فارغ حالياً، فقط ما يقوم المسؤولون بإضافته سيظهر هنا للمستفيدين مع إمكانية التحكم الكامل في النقاط والمجالات.'
                  : 'This section is currently empty. Only items published by administrators will appear here.'}
              </p>
            </div>
            {isAdminOrLeader && (
              <button
                onClick={handleOpenCreate}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>{isAr ? 'إضافة أول مادة في هذا القسم' : 'Add First Resource'}</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── IN-APP YOUTUBE THEATRE PLAYER MODAL ── */}
      {activePlayingVideo && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-fade-in">
          <div className="w-full max-w-4xl bg-slate-900 border border-slate-700/80 rounded-3xl overflow-hidden shadow-2xl space-y-0 text-white flex flex-col max-h-[90vh]">
            {/* Player Header */}
            <div className="p-4 px-6 border-b border-slate-800 flex items-center justify-between gap-4 bg-slate-900/80">
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-8 h-8 rounded-xl bg-rose-600/20 text-rose-500 flex items-center justify-center shrink-0">
                  <Play className="w-4 h-4 fill-current" />
                </span>
                <div className="min-w-0">
                  <h3 className="text-sm md:text-base font-black text-white truncate">
                    {activePlayingVideo.title}
                  </h3>
                  {activePlayingVideo.author && (
                    <p className="text-xs text-slate-400 truncate">{activePlayingVideo.author}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={`https://www.youtube.com/watch?v=${activePlayingVideo.youtubeId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>{isAr ? 'فتح في يوتيوب' : 'Open in YouTube'}</span>
                </a>

                <button
                  onClick={() => setActivePlayingVideo(null)}
                  className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Embedded YouTube Iframe (Protected with origin & playsinline) */}
            <div className="relative aspect-video w-full bg-black">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${activePlayingVideo.youtubeId}?autoplay=1&playsinline=1&rel=0&modestbranding=1`}
                title={activePlayingVideo.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="w-full h-full border-0"
              />
            </div>

            {/* Modal Bottom Details */}
            <div className="p-4 px-6 bg-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-slate-800">
              <p className="text-xs text-slate-400 max-w-xl line-clamp-2">
                {activePlayingVideo.description || (isAr ? 'فيديو تدريبي إثرائي مخصص للتعلم الذاتي.' : 'Self-paced training video.')}
              </p>

              <button
                onClick={() => {
                  db.trackRead(activePlayingVideo.id, currentUser.id);
                  setActivePlayingVideo(null);
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all shadow-md shrink-0"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {Number(activePlayingVideo.pointsReward || 0) > 0
                    ? isAr
                      ? `أتممت المشاهدة (+${activePlayingVideo.pointsReward} نقطة)`
                      : `Mark as Watched (+${activePlayingVideo.pointsReward} pts)`
                    : isAr
                    ? 'أتممت المشاهدة'
                    : 'Mark as Watched'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CREATE / EDIT RESOURCE MODAL (ADMIN CONTROL) ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5 animate-fade-in max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm md:text-base font-black text-slate-900 dark:text-white">
                    {editingCourse
                      ? isAr
                        ? 'تعديل بيانات المادة'
                        : 'Edit Resource'
                      : isAr
                      ? 'إضافة مادة أو فيديو جديد 💡'
                      : 'Add New Resource 💡'}
                  </h3>
                  <p className="text-[11px] text-slate-400 font-medium">
                    {isAr
                      ? 'أنت المتحكم الكامل: اختر المجال واكتبه بنفسك، وحدد النقاط إن أردت مكافأة الأعضاء'
                      : 'Full admin control: define custom field/category and set bonus points optionally'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Resource Type Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  {isAr ? 'نوع المرجع أو المادة:' : 'Resource Type:'}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'video' })}
                    className={`py-2.5 px-3 rounded-2xl border text-xs font-black flex items-center justify-center gap-2 transition-all ${
                      formData.type === 'video'
                        ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-500 text-rose-600 dark:text-rose-400 shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <Tv className="w-4 h-4" />
                    <span>{isAr ? 'فيديو يوتيوب' : 'YouTube Video'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'book' })}
                    className={`py-2.5 px-3 rounded-2xl border text-xs font-black flex items-center justify-center gap-2 transition-all ${
                      formData.type === 'book'
                        ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-500 text-amber-600 dark:text-amber-400 shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <BookOpen className="w-4 h-4" />
                    <span>{isAr ? 'كتاب أو مرجع' : 'Book / Ref'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'article' })}
                    className={`py-2.5 px-3 rounded-2xl border text-xs font-black flex items-center justify-center gap-2 transition-all ${
                      formData.type === 'article'
                        ? 'bg-teal-50 dark:bg-teal-950/40 border-teal-500 text-teal-600 dark:text-teal-400 shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <FileText className="w-4 h-4" />
                    <span>{isAr ? 'مقال أو دليل' : 'Article / Guide'}</span>
                  </button>
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {isAr ? 'عنوان المادة / المرجع *' : 'Title *'}
                </label>
                <input
                  required
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  placeholder={isAr ? 'مثال: أسرار القيادة والتأثير الفعال' : 'e.g. Masterclass on Team Leadership'}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* URL Field (YouTube vs Reference Link) */}
              {formData.type === 'video' ? (
                <div>
                  <label className="block text-xs font-bold text-rose-600 dark:text-rose-400 mb-1 flex items-center gap-1.5">
                    <Tv className="w-3.5 h-3.5" />
                    <span>{isAr ? 'رابط فيديو يوتيوب (YouTube URL) *' : 'YouTube Video Link *'}</span>
                  </label>
                  <input
                    required
                    type="url"
                    value={formData.videoUrl}
                    onChange={e => setFormData({ ...formData, videoUrl: e.target.value })}
                    placeholder="https://www.youtube.com/watch?v=... أو https://youtu.be/..."
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-rose-500"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    {isAr
                      ? 'يدعم تلقائياً روابط يوتيوب العادية، الشورتس، والمختصرة، ويعمل داخل المنصة مباشرة.'
                      : 'Supports standard YouTube links, Shorts, and youtu.be links. Plays in-app.'}
                  </p>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-indigo-600 dark:text-indigo-400 mb-1 flex items-center gap-1.5">
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>{isAr ? 'رابط المرجع الخارجي أو الكتاب *' : 'External Reference / Book URL *'}</span>
                  </label>
                  <input
                    required
                    type="url"
                    value={formData.linkUrl}
                    onChange={e => setFormData({ ...formData, linkUrl: e.target.value })}
                    placeholder="https://drive.google.com/... أو رابط المقال أو الكتاب"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              )}

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {isAr ? 'نبذة عن المحتوى / ماذا سيتعلم العضو؟ *' : 'Brief Summary / What will they learn? *'}
                </label>
                <textarea
                  required
                  rows={3}
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder={isAr ? 'ملخص بسيط وسريع يوضح فائدة هذا المرجع...' : 'Short overview of the content...'}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              {/* Category (Custom Admin Defined) & Committee */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {isAr ? 'المجال / التصنيف (أنت من تحدده)' : 'Custom Category / Field'}
                  </label>
                  <input
                    list="category-suggestions"
                    value={formData.category}
                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                    placeholder={isAr ? 'اكتب اسم المجال مثلاً: قيادة، برمجة، تصميم...' : 'e.g. Leadership, Coding, Design...'}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                  <datalist id="category-suggestions">
                    {categories.filter(c => c !== 'All').map(c => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {isAr ? 'يمكنك كتابة أي مجال جديد أو اختياره من المقترحات' : 'Type any custom field or pick an existing one'}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {isAr ? 'اللجنة المستهدفة' : 'Target Committee'}
                  </label>
                  <select
                    value={formData.committee}
                    onChange={e => setFormData({ ...formData, committee: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="All">{isAr ? 'كل اللجان (متاح للجميع)' : 'All Committees'}</option>
                    {['HR', 'PR', 'SM', 'OR'].map(c => (
                      <option key={c} value={c}>
                        {c} Committee
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Bonus Points Reward Setting (Admin controlled) */}
              <div className="bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <label className="text-xs font-black text-slate-800 dark:text-slate-200">
                      {isAr ? 'مكافأة نقاط الإنجاز (اختياري)' : 'Bonus Points Reward (Optional)'}
                    </label>
                  </div>
                  <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400">
                    {formData.pointsReward > 0
                      ? isAr
                        ? `+${formData.pointsReward} نقطة للعضو`
                        : `+${formData.pointsReward} pts`
                      : isAr
                      ? 'بدون نقاط (للفائدة فقط)'
                      : '0 Points (For Knowledge)'}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={0}
                    max={500}
                    step={5}
                    value={formData.pointsReward}
                    onChange={e => setFormData({ ...formData, pointsReward: Math.max(0, parseInt(e.target.value) || 0) })}
                    className="w-32 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-black text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                  />
                  <div className="flex items-center gap-1.5">
                    {[0, 10, 25, 50].map(pt => (
                      <button
                        key={pt}
                        type="button"
                        onClick={() => setFormData({ ...formData, pointsReward: pt })}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all border ${
                          formData.pointsReward === pt
                            ? 'bg-amber-500 text-white border-amber-500'
                            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {pt === 0 ? (isAr ? '0 نقاط' : '0 pts') : `+${pt}`}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-[10px] text-slate-400">
                  {isAr
                    ? 'إذا وضعت 0، لن يحصل العضو على نقاط وستكون المادة للاستفادة فقط. إذا حددت نقاطاً، ستضاف لحسابه فور تأكيد المشاهدة.'
                    : 'If 0, no points awarded. If points set, credited upon user completion.'}
                </p>
              </div>

              {/* Duration & Author */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {isAr ? 'الوقت المقدر' : 'Estimated Time'}
                  </label>
                  <input
                    value={formData.duration}
                    onChange={e => setFormData({ ...formData, duration: e.target.value })}
                    placeholder={isAr ? 'مثال: 15 دقيقة / قراءة 10 د' : 'e.g. 15 mins / 10 min read'}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {isAr ? 'المؤلف / المحاضر' : 'Author / Speaker'}
                  </label>
                  <input
                    value={formData.author}
                    onChange={e => setFormData({ ...formData, author: e.target.value })}
                    placeholder={isAr ? 'اسم المحاضر أو الناشر' : 'Speaker or author name'}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-xl transition-all"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md shadow-indigo-600/25 transition-all"
                >
                  {editingCourse
                    ? isAr
                      ? 'حفظ التعديلات'
                      : 'Save Changes'
                    : isAr
                    ? 'نشر المرجع للجميع'
                    : 'Publish Resource'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
