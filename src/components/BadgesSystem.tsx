import React, { useState, useEffect } from 'react';
import { db } from '../db/localDb';
import { UserProfile, Badge, BadgeId } from '../types';
import { Award, Flame, Star, Zap, Shield, Trophy, Lock } from 'lucide-react';
import { useLanguage } from '../lib/LanguageContext';

interface BadgesSystemProps { currentUser: UserProfile; }

const RARITY_STYLES: Record<string, string> = {
  Common: 'bg-slate-100 dark:bg-slate-850 border-slate-400 dark:border-slate-700 text-slate-900 dark:text-white',
  Rare: 'bg-blue-50 dark:bg-blue-950/80 border-blue-400 dark:border-blue-700 text-blue-900 dark:text-blue-100',
  Epic: 'bg-purple-50 dark:bg-purple-950/80 border-purple-400 dark:border-purple-700 text-purple-900 dark:text-purple-100',
  Legendary: 'bg-amber-50 dark:bg-amber-950/80 border-amber-400 dark:border-amber-700 text-amber-900 dark:text-amber-100',
};

const RARITY_GLOW: Record<string, string> = {
  Common: 'shadow-sm',
  Rare: 'shadow-blue-500/15 shadow-md',
  Epic: 'shadow-purple-500/20 shadow-lg',
  Legendary: 'shadow-amber-500/25 shadow-xl ring-2 ring-amber-400/50',
};

export const BadgesSystem: React.FC<BadgesSystemProps> = ({ currentUser }) => {
  const { language } = useLanguage();
  const ar = language === 'ar';
  const [tab, setTab] = useState<'my' | 'all'>('my');

  useEffect(() => {
    db.checkAndAwardBadges(currentUser.id);
    db.updateStreak(currentUser.id);
  }, [currentUser.id]);

  const allDefs = db.getAllBadgeDefinitions();
  const myBadges = db.getUserBadges(currentUser.id);
  const myBadgeIds = new Set(myBadges.map(b => b.badgeId));
  const streak = db.getUserStreak(currentUser.id);

  const allUserBadges = db.getAllUserBadges();
  const users = db.getUsers();

  // Leaderboard: who has most badges
  const userBadgeCounts = users.map(u => ({
    user: u,
    count: allUserBadges.filter(b => b.userId === u.id).length,
    badges: allUserBadges.filter(b => b.userId === u.id),
  })).sort((a, b) => b.count - a.count).slice(0, 5);

  const rarityLabel: Record<string, string> = {
    Common: ar ? 'شائع' : 'Common',
    Rare: ar ? 'نادر' : 'Rare',
    Epic: ar ? 'ملحمي' : 'Epic',
    Legendary: ar ? 'أسطوري' : 'Legendary',
  };

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6" dir={ar ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center gap-3 bg-white dark:bg-slate-900 p-5 rounded-3xl border-2 border-amber-300 dark:border-slate-800 shadow-sm">
        <div className="p-3 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 shadow-md">
          <Award className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white">
            {ar ? 'الشارات والإنجازات' : 'Badges & Achievements'}
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-300 font-semibold">{ar ? 'اجمع الشارات وسجّل سلاسل إنجازك' : 'Collect badges and build your achievement streaks'}</p>
        </div>
      </div>

      {/* Streak + Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl p-4 text-white text-center shadow-md">
          <Flame className="w-6 h-6 mx-auto mb-1" />
          <p className="text-2xl font-black">{streak}</p>
          <p className="text-[10px] font-black">{ar ? 'أسابيع متتالية 🔥' : 'Week Streak 🔥'}</p>
        </div>
        <div className="bg-gradient-to-br from-amber-500 to-yellow-600 rounded-2xl p-4 text-white text-center shadow-md">
          <Trophy className="w-6 h-6 mx-auto mb-1" />
          <p className="text-2xl font-black">{myBadges.length}</p>
          <p className="text-[10px] font-black">{ar ? 'شارة مكتسبة' : 'Badges Earned'}</p>
        </div>
        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-4 text-white text-center shadow-md">
          <Star className="w-6 h-6 mx-auto mb-1" />
          <p className="text-2xl font-black">{myBadges.reduce((s, b) => { const def = allDefs.find(d => d.id === b.badgeId); return s + (def?.pointsBonus || 0); }, 0)}</p>
          <p className="text-[10px] font-black">{ar ? 'نقاط من الشارات' : 'Badge Points'}</p>
        </div>
        <div className="bg-gradient-to-br from-purple-500 to-violet-600 rounded-2xl p-4 text-white text-center shadow-md">
          <Zap className="w-6 h-6 mx-auto mb-1" />
          <p className="text-2xl font-black">{allDefs.length - myBadges.length}</p>
          <p className="text-[10px] font-black">{ar ? 'شارة متبقية' : 'Yet to Unlock'}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex rounded-2xl bg-white dark:bg-slate-900 p-1.5 w-fit border-2 border-slate-200 dark:border-slate-800 shadow-sm">
        {[
          { id: 'my', label: ar ? 'شاراتي' : 'My Badges' },
          { id: 'all', label: ar ? 'أفضل الأعضاء' : 'Top Earners' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            className={`px-5 py-2 text-xs font-black rounded-xl transition-all cursor-pointer ${tab === t.id ? 'bg-amber-500 text-white shadow-md' : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'}`}
          >{t.label}</button>
        ))}
      </div>

      {/* My Badges Grid */}
      {tab === 'my' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {allDefs.map(def => {
            const owned = myBadgeIds.has(def.id);
            const awarded = myBadges.find(b => b.badgeId === def.id);
            return (
              <div key={def.id} className={`relative rounded-3xl border-2 p-4 text-center transition-all duration-300 ${owned ? `${RARITY_STYLES[def.rarity]} ${RARITY_GLOW[def.rarity]}` : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm'}`}>
                {!owned && (
                  <div className="absolute top-2.5 end-2.5">
                    <Lock className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                )}
                <div className={`text-4xl mb-2 ${owned ? '' : 'grayscale opacity-50'}`}>{def.emoji}</div>
                <p className={`text-xs font-black leading-tight ${owned ? '' : 'text-slate-900 dark:text-white'}`}>
                  {ar ? def.nameAr : def.name}
                </p>
                {owned && (
                  <span className="inline-block mt-1.5 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-black/10 dark:bg-white/20">
                    {rarityLabel[def.rarity]}
                  </span>
                )}
                <p className={`text-[10px] mt-1.5 leading-relaxed font-semibold ${owned ? 'opacity-80' : 'text-slate-600 dark:text-slate-300'}`}>
                  {ar ? def.descriptionAr : def.description}
                </p>
                {owned && awarded && (
                  <p className="text-[10px] font-bold text-slate-600 dark:text-slate-300 mt-1">
                    {new Date(awarded.awardedAt).toLocaleDateString(ar ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric' })}
                  </p>
                )}
                <div className="mt-2">
                  <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-800">
                    +{def.pointsBonus} pts
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Top Earners Leaderboard */}
      {tab === 'all' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-sm font-black text-slate-800 dark:text-white">{ar ? '🏆 أكثر الأعضاء شارات' : '🏆 Top Badge Earners'}</h3>
          </div>
          <div className="divide-y divide-slate-50 dark:divide-slate-800">
            {userBadgeCounts.map((item, i) => (
              <div key={item.user.id} className={`flex items-center gap-3 px-4 py-3 ${item.user.id === currentUser.id ? 'bg-blue-50/40 dark:bg-blue-950/10' : ''}`}>
                <span className={`text-lg font-black w-6 text-center ${i === 0 ? 'text-amber-500' : i === 1 ? 'text-slate-400' : i === 2 ? 'text-orange-400' : 'text-slate-300'}`}>
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                </span>
                <img
                  src={item.user.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(item.user.fullName)}&backgroundColor=0b59b1`}
                  className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-700"
                  alt={item.user.fullName}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-black text-slate-800 dark:text-slate-100 truncate">{item.user.fullName}</p>
                  <div className="flex gap-1 mt-0.5 flex-wrap">
                    {item.badges.slice(0, 5).map(b => {
                      const def = allDefs.find(d => d.id === b.badgeId);
                      return def ? <span key={b.id} title={ar ? def.nameAr : def.name} className="text-xs">{def.emoji}</span> : null;
                    })}
                    {item.count > 5 && <span className="text-[10px] text-slate-400">+{item.count - 5}</span>}
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-base font-black text-eye-brand">{item.count}</p>
                  <p className="text-[9px] text-slate-400">{ar ? 'شارة' : 'badges'}</p>
                </div>
              </div>
            ))}
            {userBadgeCounts.length === 0 && (
              <div className="p-8 text-center text-slate-400 text-sm">{ar ? 'لا يوجد أعضاء لديهم شارات بعد' : 'No badges earned yet'}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
