/**
 * EYE Gharbia Platform — Temporary 24-Hour Workshop Certificates System
 * 
 * Defines the 3 exclusive workshop certificates with a 24-hour expiration window:
 * 1. شهادة LinkedIn (LinkedIn Professional Branding Certificate)
 * 2. شهادة CV + ATS + Portfolio + Personal Branding (Career Development Skills Certificate)
 * 3. شهادة Career Development — لمن حضر الاثنين (Career Development Certificate)
 */

export interface WorkshopCertTemplate {
  id: 'linkedin_workshop' | 'career_skills_workshop' | 'career_dev_workshop';
  number: number;
  labelAr: string;
  labelEn: string;
  title: string;
  bodyTemplate: string;
  icon: string;
  color: string;
  gradient: string;
  badgeAr: string;
  badgeEn: string;
  descriptionAr: string;
}

export const WORKSHOP_CERTS_EXPIRY_KEY = 'eye_workshop_certs_expiry_v1';
export const WORKSHOP_CERTS_START_KEY = 'eye_workshop_certs_start_v1';
export const WORKSHOP_DURATION_HOURS = 24;
export const WORKSHOP_DURATION_MS = WORKSHOP_DURATION_HOURS * 60 * 60 * 1000;

export const WORKSHOP_CERT_TEMPLATES: WorkshopCertTemplate[] = [
  {
    id: 'linkedin_workshop',
    number: 1,
    labelAr: 'شهادة LinkedIn',
    labelEn: 'LinkedIn Session Certificate',
    title: 'LinkedIn Professional Branding Certificate',
    bodyTemplate:
      'This certificate is proudly presented to [Name] in recognition of their participation in the LinkedIn session, covering key practices for building and optimizing a professional LinkedIn profile and strengthening their professional presence.',
    icon: '💼',
    color: 'from-sky-500 to-blue-700',
    gradient: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
    badgeAr: 'ورشة LinkedIn',
    badgeEn: 'LinkedIn Session',
    descriptionAr: 'للمشاركين في جلسة تحسين وتطوير البروفايل المهني على LinkedIn',
  },
  {
    id: 'career_skills_workshop',
    number: 2,
    labelAr: 'شهادة CV + ATS + Portfolio + Personal Branding',
    labelEn: 'Career Development Skills Session',
    title: 'Career Development Skills Certificate',
    bodyTemplate:
      'This certificate is proudly presented to [Name] in recognition of their participation in the Career Development session, covering CV writing, ATS optimization, portfolio development, and personal branding.',
    icon: '📄',
    color: 'from-emerald-500 to-teal-700',
    gradient: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
    badgeAr: 'ورشة المهارات المهنية',
    badgeEn: 'Career Skills Session',
    descriptionAr: 'للمشاركين في ورشة كتابة الـ CV وتخطي أنظمة ATS والبورتفوليو والبراند الشخصي',
  },
  {
    id: 'career_dev_workshop',
    number: 3,
    labelAr: 'شهادة Career Development — لمن حضر الاثنين',
    labelEn: 'Career Development Comprehensive Program',
    title: 'Career Development Certificate',
    bodyTemplate:
      'This certificate is proudly presented to [Name] in recognition of their successful participation in the Career Development Program, covering LinkedIn, CV writing, ATS optimization, portfolio development, and personal branding.',
    icon: '🎯',
    color: 'from-indigo-500 to-purple-700',
    gradient: 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)',
    badgeAr: 'البرنامج الشامل (الاثنين معاً)',
    badgeEn: 'Comprehensive Program',
    descriptionAr: 'الشهادة الشاملة المخصصة لمن حضر كلا الورشتين وأتم البرنامج بالكامل',
  },
];

/**
 * Gets or initializes the 24-hour expiration timestamp
 */
export const getWorkshopCertsExpiry = (): number => {
  try {
    const stored = localStorage.getItem(WORKSHOP_CERTS_EXPIRY_KEY);
    if (stored) {
      const parsed = parseInt(stored, 10);
      if (!isNaN(parsed) && parsed > 0) {
        return parsed;
      }
    }
    const now = Date.now();
    const expiry = now + WORKSHOP_DURATION_MS;
    localStorage.setItem(WORKSHOP_CERTS_START_KEY, now.toString());
    localStorage.setItem(WORKSHOP_CERTS_EXPIRY_KEY, expiry.toString());
    return expiry;
  } catch {
    return Date.now() + WORKSHOP_DURATION_MS;
  }
};

/**
 * Checks if the 24-hour window is currently active
 */
export const isWorkshopCertsActive = (): boolean => {
  return Date.now() < getWorkshopCertsExpiry();
};

/**
 * Calculates remaining hours, minutes, seconds for countdown
 */
export const getWorkshopRemainingTime = (): {
  hours: number;
  minutes: number;
  seconds: number;
  totalSeconds: number;
  isExpired: boolean;
  formattedCountdown: string;
} => {
  const expiry = getWorkshopCertsExpiry();
  const diff = expiry - Date.now();
  if (diff <= 0) {
    return {
      hours: 0,
      minutes: 0,
      seconds: 0,
      totalSeconds: 0,
      isExpired: true,
      formattedCountdown: 'منتهية',
    };
  }

  const totalSeconds = Math.floor(diff / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  const formattedCountdown = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;

  return {
    hours,
    minutes,
    seconds,
    totalSeconds,
    isExpired: false,
    formattedCountdown,
  };
};

/**
 * Replaces [Name] in body text with recipient's actual name
 */
export const formatBodyForRecipient = (text: string, recipientName?: string): string => {
  if (!text) return '';
  const name = (recipientName || '').trim();
  if (!name) return text;
  return text.replace(/\[Name\]/g, name);
};

/**
 * Checks if a given certType is one of the temporary workshop certificates
 */
export const isWorkshopCertType = (type?: string): boolean => {
  return (
    type === 'linkedin_workshop' ||
    type === 'career_skills_workshop' ||
    type === 'career_dev_workshop'
  );
};

/**
 * Force reset the 24-hour timer (useful for testing or if admin re-activates)
 */
export const resetWorkshopCertsTimer = (hours = 24): number => {
  const now = Date.now();
  const expiry = now + hours * 60 * 60 * 1000;
  try {
    localStorage.setItem(WORKSHOP_CERTS_START_KEY, now.toString());
    localStorage.setItem(WORKSHOP_CERTS_EXPIRY_KEY, expiry.toString());
  } catch { }
  return expiry;
};
