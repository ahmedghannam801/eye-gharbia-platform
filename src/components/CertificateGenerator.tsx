import React, { useState, useEffect, useCallback, useRef } from 'react';
import html2canvas from 'html2canvas';
import ExcelJS from 'exceljs';
import { db } from '../db/localDb';
import { UserProfile, CertificateType, IssuedCertificate, getUserRoleTitle } from '../types';
import { Award, Download, User, Star, CheckCircle, Eye, Mail, X, Search, FileText, CheckSquare, Square, Loader2, Sparkles, Clock, Trash2, AlertTriangle, Filter, Check, Upload, FileSpreadsheet, CheckCircle2, RefreshCw } from 'lucide-react';
import { useLanguage } from '../lib/LanguageContext';
import { downloadCertificate, downloadBulkCertificatesAsPdf, downloadCertificateAsPdf, printCertificate, getCommitteeSignatories, formatArabicConjunctions } from '../lib/certificateGenerator';
import {
  WORKSHOP_CERT_TEMPLATES,
  WorkshopCertTemplate,
  isWorkshopCertsActive,
  getWorkshopRemainingTime,
  formatBodyForRecipient,
  isWorkshopCertType,
} from '../lib/workshopCerts';
import QRCode from 'qrcode';

interface CertificateGeneratorProps { currentUser: UserProfile; }

const BASE_CERT_TYPES: { id: CertificateType; labelAr: string; label: string; color: string; icon: string }[] = [
  { id: 'appreciation', labelAr: 'شهادة تقدير وعرفان', label: 'Certificate of Appreciation', color: 'from-amber-400 to-orange-500', icon: '🌟' },
  { id: 'excellence', labelAr: 'شهادة تميز وإتقان', label: 'Certificate of Excellence', color: 'from-purple-500 to-indigo-600', icon: '🏆' },
  { id: 'training', labelAr: 'شهادة إتمام تدريب', label: 'Certificate of Training Completion', color: 'from-blue-500 to-cyan-500', icon: '📚' },
  { id: 'leadership', labelAr: 'شهادة القيادة المتميزة', label: 'Leadership Excellence Certificate', color: 'from-emerald-500 to-teal-600', icon: '👑' },
  { id: 'custom', labelAr: 'شهادة مخصصة', label: 'Custom Certificate', color: 'from-rose-400 to-pink-500', icon: '✨' },
];

const WORKSHOP_TYPES_LIST: { id: CertificateType; labelAr: string; label: string; color: string; icon: string }[] = WORKSHOP_CERT_TEMPLATES.map(t => ({
  id: t.id,
  labelAr: `${t.labelAr} (مؤقتة ⏳)`,
  label: t.title,
  color: t.color,
  icon: t.icon,
}));

const ALL_KNOWN_CERT_TYPES = [...BASE_CERT_TYPES, ...WORKSHOP_TYPES_LIST];
const CERT_TYPES = ALL_KNOWN_CERT_TYPES;

export interface SheetRecipient {
  id: string;
  name: string;
  code?: string;
  email?: string;
  committee?: string;
  role?: string;
  grade?: number;
  customTitle?: string;
  customBody?: string;
  matchedUser?: UserProfile;
  status: 'matched' | 'unmatched';
  selected: boolean;
}

export const normalizeArabicName = (str: string): string => {
  return (str || '')
    .trim()
    .toLowerCase()
    .replace(/[إأآا]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\u064B-\u065F]/g, '')
    .replace(/\s+/g, ' ');
};

export const matchMember = (
  rawName: string,
  rawCode: string,
  rawEmail: string,
  allUsers: UserProfile[]
): UserProfile | undefined => {
  const cleanCode = (rawCode || '').trim().toLowerCase();
  const cleanEmail = (rawEmail || '').trim().toLowerCase();
  const cleanName = normalizeArabicName(rawName);

  // 1. Exact code match
  if (cleanCode) {
    const byCode = allUsers.find(u => (u.membershipCode || '').trim().toLowerCase() === cleanCode);
    if (byCode) return byCode;
  }

  // 2. Exact email match
  if (cleanEmail) {
    const byEmail = allUsers.find(u => (u.email || '').trim().toLowerCase() === cleanEmail);
    if (byEmail) return byEmail;
  }

  // 3. Name match
  if (cleanName && cleanName.length >= 3) {
    const exact = allUsers.find(u => normalizeArabicName(u.fullName) === cleanName);
    if (exact) return exact;

    const words = cleanName.split(' ').filter(Boolean);
    if (words.length >= 2) {
      const partial = allUsers.find(u => {
        const uNorm = normalizeArabicName(u.fullName);
        const uWords = uNorm.split(' ').filter(Boolean);
        if (words.length >= 2 && uWords.length >= 2) {
          if (words[0] === uWords[0] && words[1] === uWords[1]) {
            if (words.length >= 3 && uWords.length >= 3) {
              return words[2] === uWords[2];
            }
            return true;
          }
        }
        return false;
      });
      if (partial) return partial;
    }
  }

  return undefined;
};

export const CERT_STYLES = [
  { id: 'style1' as const, labelAr: 'القالب الأصلي المعتمد 👑', label: 'Original Approved Template', descAr: 'الإطار الأزرق الملكي المعتمد لجميع شهادات الكيان', icon: '👑', color: 'from-blue-600 to-indigo-700' },
];

const CertPreview: React.FC<{ cert: IssuedCertificate; onPrint: () => void; transparentLogo: string }> = ({ cert, onPrint, transparentLogo }) => {
  const isEn = cert.lang === 'en';
  const date = new Date(cert.issuedAt).toLocaleDateString(isEn ? 'en-US' : 'ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
  const certDef = CERT_TYPES.find(c => c.id === cert.certType);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const certId = cert.id;

  useEffect(() => {
    if (certId === 'preview-0000') return; // Skip QR for draft previews
    const verifyUrl = `${window.location.origin}?verify=${certId}`;
    QRCode.toDataURL(verifyUrl, {
      width: 80,
      margin: 1,
      color: { dark: '#1b4cd3', light: '#f0f5ff' },
      errorCorrectionLevel: 'M',
    }).then(setQrDataUrl).catch(() => { });
  }, [certId]);

  // جلب توقيعات المحافظة ديناميكياً من قاعدة البيانات
  const certGovernorate = cert.governorate ||
    (() => { try { return localStorage.getItem('eye_current_governorate') || 'الغربية'; } catch { return 'الغربية'; } })();
  const govSigs = db.getGovernorateSignatories(certGovernorate, isEn ? 'en' : 'ar');

  // 1. رئيس الكيان / Entity President
  // 2. رئيس المحافظة / Governorate Head
  const headDisplayName = isEn ? 'Mahmoud Rabie' : (govSigs.headName || 'محمود ربيع');
  const headDisplayTitle = isEn ? 'GOVERNORATE HEAD' : 'رئيس الغربية';
  // 3. مسئول لجنة الموارد البشرية / HR Committee Head
  const viceDisplayName = isEn ? 'Ahmed Ibrahim' : 'أحمد إبراهيم';
  const viceDisplayTitle = isEn ? 'HR COMMITTEE HEAD' : 'مسئول لجنة الموارد البشرية';

  const sigs = getCommitteeSignatories('HR', isEn ? 'en' : 'ar');
  const roleDisplay = isEn
    ? (cert.recipientRole === 'Super Admin' ? 'HR Committee Manager'
      : cert.recipientRole === 'Vice' ? 'Vice President'
      : cert.recipientRole === 'Head' ? 'Governorate Head'
      : cert.recipientRole === 'Coordinator' ? 'Governorate Coordinator'
      : cert.recipientRole === 'Deputy Coordinator' ? 'Deputy Coordinator'
      : cert.recipientRole === 'Leader' ? 'Team Leader'
      : cert.recipientRole === 'HRM' ? 'HR Manager'
      : 'Distinguished Member')
    : cert.recipientRole;
  const commDisplay = isEn ? (cert.committee?.includes('OR') ? 'Organization & Relations Committee' : cert.committee?.includes('SM') ? 'Social Media Committee' : 'Human Resources Committee') : cert.committee;

  // ════════════════════════════════════════════════════════════════
  // ORIGINAL APPROVED CERTIFICATE LAYOUT (STYLE 1 ONLY)
  // ════════════════════════════════════════════════════════════════
  const theme1 = {
    background: 'linear-gradient(135deg, #f0f5ff 0%, #e8f0fe 50%, #dce8ff 100%)',
    border: '4px double #1b4cd3',
    innerBorder: '1px solid rgba(43, 102, 255, 0.2)',
    textColor: '#0f172a',
    titleColor: '#1b4cd3',
    accentColor: '#2b66ff',
    badgeBg: 'rgba(43, 102, 255, 0.08)',
    badgeBorder: 'rgba(43, 102, 255, 0.3)',
    nameColor: '#0c1e4d',
    bodyColor: '#334155',
    cornerColor: '#1b4cd3',
  };

  return (
    <div className="bg-white dark:bg-slate-900 p-2 sm:p-3 rounded-2xl border border-blue-300 dark:border-blue-800 shadow-2xl max-w-3xl mx-auto">
      <div
        className="cert-print-area text-center relative overflow-hidden p-5 sm:p-8 rounded-lg"
        style={{
          fontFamily: isEn ? 'Georgia, serif' : 'Georgia, serif',
          direction: isEn ? 'ltr' : 'rtl',
          background: theme1.background,
          border: theme1.border,
          boxShadow: '0 10px 30px -5px rgba(27, 76, 211, 0.2)',
          color: theme1.textColor,
        }}
      >

        {/* Inner Decorative Accent Frame Line */}
        <div className="absolute inset-3 border rounded-md pointer-events-none" style={{ border: theme1.innerBorder }} />

        {/* L-shaped Corner Brackets */}
        <div className="absolute top-2 left-2 w-5 h-5 border-t-2 border-l-2 pointer-events-none" style={{ borderColor: theme1.cornerColor }} />
        <div className="absolute top-2 right-2 w-5 h-5 border-t-2 border-r-2 pointer-events-none" style={{ borderColor: theme1.cornerColor }} />
        <div className="absolute bottom-2 left-2 w-5 h-5 border-b-2 border-l-2 pointer-events-none" style={{ borderColor: theme1.cornerColor }} />
        <div className="absolute bottom-2 right-2 w-5 h-5 border-b-2 border-r-2 pointer-events-none" style={{ borderColor: theme1.cornerColor }} />

        {/* Blue ink seal stamp — logo cropped to circular badge only */}
        <div className={`absolute bottom-6 ${isEn ? 'right-6' : 'right-6'} w-24 h-24 rounded-full border-2 border-double flex items-center justify-center -rotate-12 select-none pointer-events-none overflow-hidden`}
          style={{ borderColor: theme1.accentColor, background: 'transparent' }}>
          <img
            src={transparentLogo}
            className="w-14 h-14"
            style={{
              objectFit: 'cover',
              objectPosition: 'center top',
              filter: 'brightness(0.9) sepia(1) saturate(6) hue-rotate(195deg)',
            }}
            alt="seal"
          />
        </div>

        {/* QR Code — scan to verify certificate authenticity */}
        {qrDataUrl && (
          <div className={`absolute bottom-5 ${isEn ? 'left-5' : 'left-5'} flex flex-col items-center select-none pointer-events-none`} style={{ zIndex: 10 }}>
            <div className="p-1 rounded-lg bg-white shadow-xs">
              <img src={qrDataUrl} alt="verify" className="w-12 h-12 rounded-xs" />
            </div>
            <p className="text-[7px] font-bold mt-0.5" style={{ color: theme1.accentColor, letterSpacing: '0.05em' }}>{isEn ? 'VERIFY' : 'تحقق'}</p>
          </div>
        )}

        {/* Top-Left Hanging Royal Blue Ribbon with EYE Rosette Seal Medal Badge */}
        <div className="absolute top-0 left-5 sm:left-8 z-30 flex flex-col items-center pointer-events-none select-none">
          {/* Hanging Ribbon Tail */}
          <div className="w-11 sm:w-15 h-26 sm:h-34 bg-gradient-to-b from-blue-950 via-blue-800 to-blue-900 shadow-2xl relative flex flex-col items-center justify-end pb-3 rounded-b-sm border-x border-blue-400/40">
            <div className="w-0.5 h-full bg-blue-300/30" />
            {/* Ribbon V-notch at bottom */}
            <div className="absolute -bottom-3.5 left-0 right-0 h-4 bg-gradient-to-b from-blue-900 to-blue-950" style={{ clipPath: 'polygon(0 0, 100% 0, 50% 100%)' }} />
          </div>
          {/* Circular EYE Rosette Seal Medal with Bright White Container & Transparent Cutout Logo */}
          <div className="absolute top-8 sm:top-12 w-16 h-16 sm:w-22 sm:h-22 rounded-full bg-gradient-to-br from-blue-500 via-blue-700 to-blue-950 p-1 sm:p-1.5 shadow-2xl flex items-center justify-center border-2 border-amber-300">
            <div className="w-full h-full rounded-full border-2 border-amber-400 bg-white flex items-center justify-center p-1 shadow-md">
              <img
                src={transparentLogo}
                className="w-13 h-13 sm:w-19 sm:h-19 object-contain filter brightness-105 contrast-125 drop-shadow-xs"
                alt="EYE Rosette Seal"
              />
            </div>
          </div>
        </div>

        {/* Large, elegant official EYE LOGO background watermark image */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden z-0" aria-hidden>
          <img
            src={transparentLogo}
            alt="EYE Background Watermark Logo"
            className="w-[340px] h-[340px] sm:w-[440px] sm:h-[440px] object-contain opacity-[0.08] filter brightness-110 contrast-125"
          />
        </div>

        {/* TOP HEADER METADATA — Pinned explicitly to Top-Right to prevent any ribbon collision in both Arabic & English */}
        <div className="absolute top-4 right-5 sm:right-8 z-20 text-end space-y-0.5 pointer-events-none" dir="ltr">
          <p className="text-[10.5px] font-black" style={{ color: theme1.titleColor }}>
            {isEn ? '• Official Certified Document •' : '• وثيقة رسمية معتمدة •'}
          </p>
          <p className="text-[9.5px] font-bold text-slate-700 dark:text-slate-200">Egyptian Youth Entity — EYE</p>
          <div className="flex items-center justify-end gap-2.5 text-[9px] font-bold text-slate-500 pt-0.5">
            <span>{isEn ? `Date: ${date}` : `تاريخ الإصدار: ${date}`}</span>
            <span>•</span>
            <span className="font-mono">ID: EYE-CERT-{cert.id.slice(-8, -4).toUpperCase()}{cert.id.slice(-4).toUpperCase()}</span>
          </div>
        </div>

        {/* Title & Top Section Container with Safe Top Clearance below Ribbon */}
        <div className="pt-14 sm:pt-18 relative z-10">
          {/* Top divider with center diamond */}
          <div className="relative my-3">
            <div className="h-px" style={{ background: `linear-gradient(to right, transparent 0%, ${theme1.accentColor} 50%, transparent 100%)` }} />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rotate-45" style={{ background: theme1.accentColor }} />
          </div>

          {/* Title */}
          <div>
            <h2 className="text-2xl sm:text-3xl font-black mb-1" style={{ color: theme1.titleColor }}>{cert.title}</h2>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-3 opacity-80">{certDef?.label}</p>
          </div>
        </div>

        {/* MIDDLE: كيان المصريون الشباب EYE */}
        <div className="relative z-10 my-4">
          <p className="text-[10px] font-bold mb-1" style={{ color: theme1.accentColor }}>{isEn ? '— ISSUED BY —' : '— يصدرها —'}</p>

          {/* Circular logo & name */}
          <div className={`flex items-center justify-center gap-3 ${isEn ? 'dir-ltr' : 'dir-rtl'}`}>
            <img
              src={transparentLogo}
              className="w-10 h-10 object-contain shrink-0"
              alt="EYE Logo"
            />
            <p className="text-2xl font-black flex items-center gap-2" style={{ color: theme1.textColor }}>
              <span>{isEn ? 'Egyptian Youth Entity' : 'كيان المصريون الشباب'}</span>
              <span style={{ color: theme1.accentColor }}>EYE</span>
            </p>
          </div>

          <p className="text-[10px] italic mt-0.5 text-center font-semibold opacity-75">Egyptian Youth Entity — EYE</p>

          {/* Underline with diamond */}
          <div className="relative w-64 h-px mx-auto mt-2" style={{ background: `linear-gradient(to right, transparent 0%, ${theme1.accentColor} 50%, transparent 100%)` }}>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rotate-45" style={{ background: theme1.accentColor }} />
          </div>
        </div>

        {/* RECIPIENT */}
        <div className="relative z-10 my-3">
          <p className="text-xs sm:text-sm font-black mb-1" style={{ color: theme1.titleColor }}>
            {isEn ? 'The Egyptian Youth Entity EYE is honored to present this certificate to' : 'يتشرف كيان المصريون الشباب EYE بتكريم العضو المتميز'}
          </p>

          {/* Name with Ornate Wing Flourishes */}
          <div className="flex items-center justify-center gap-2 sm:gap-3 my-2 dir-ltr">
            <div className="flex items-center gap-1 shrink-0" style={{ color: theme1.accentColor }}>
              <span className="text-xs">✦</span>
              <div className="w-8 sm:w-16 h-0.5 rounded-full" style={{ background: `linear-gradient(to left, ${theme1.accentColor}, transparent)` }} />
              <span className="text-xs">❖</span>
            </div>

            {/* Recipient Member Name */}
            <p className="text-2xl sm:text-3.5xl font-black tracking-tight px-1.5 drop-shadow-xs" style={{ color: theme1.nameColor }}>
              {cert.recipientName}
            </p>

            <div className="flex items-center gap-1 shrink-0" style={{ color: theme1.accentColor }}>
              <span className="text-xs">❖</span>
              <div className="w-8 sm:w-16 h-0.5 rounded-full" style={{ background: `linear-gradient(to right, ${theme1.accentColor}, transparent)` }} />
              <span className="text-xs">✦</span>
            </div>
          </div>

          {/* Position & Committee Pill */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full font-black text-xs sm:text-sm shadow-2xs mt-0.5"
            style={{ background: theme1.badgeBg, border: `1px solid ${theme1.badgeBorder}`, color: theme1.titleColor }}>
            <span style={{ color: theme1.textColor }}>{roleDisplay}</span>
            <span style={{ color: theme1.accentColor }} className="font-serif">✦</span>
            <span style={{ color: theme1.titleColor }}>{commDisplay}</span>
          </div>
        </div>

        {/* Body */}
        <div className="relative z-10 my-3">
          <p className="text-[12px] leading-6 px-4 font-semibold" style={{ color: theme1.bodyColor }}>{isEn ? cert.body : formatArabicConjunctions(cert.body)}</p>
        </div>

        {/* Grade Rating Stars */}
        {cert.grade !== undefined && cert.grade !== null && (
          <div className="relative z-10 my-4">
            <div className="flex items-center justify-between px-8">
              <div className="text-sm font-black tracking-widest" style={{ color: theme1.accentColor }}>★ ★ ★ ★</div>
              <div className="flex flex-col items-center justify-center">
                <div className="flex gap-0.5 mb-1">
                  {[1, 2, 3, 4, 5].map(s => (
                    <Star key={s} className="w-3 h-3"
                      style={{
                        fill: cert.grade! >= s * 20 ? theme1.accentColor : 'none',
                        color: theme1.accentColor,
                      }}
                    />
                  ))}
                </div>
                <div className="w-12 h-12 rounded-full border-2 border-double flex items-center justify-center bg-white shadow-xs"
                  style={{ borderColor: theme1.accentColor }}>
                  <span className="text-sm font-black" style={{ color: theme1.titleColor }}>
                    {cert.grade}
                  </span>
                </div>
                <p className="text-[9px] font-bold mt-0.5 opacity-75">{isEn ? 'Performance Rating' : 'تقييم الأداء'}</p>
              </div>
              <div className="text-sm font-black tracking-widest" style={{ color: theme1.accentColor }}>★ ★ ★ ★</div>
            </div>
          </div>
        )}

        {/* Date and Clean Official 3 Signatures Grid Container */}
        <div className="relative z-10 pt-3 mt-3" style={{ borderTop: `1px solid ${theme1.badgeBorder}` }}>
          <div className="flex justify-between items-center mb-2 px-2">
            <div className="flex items-center gap-1.5 text-[9px] font-bold" style={{ color: theme1.titleColor }}>
              <span>{isEn ? 'Accreditation Date:' : 'تاريخ الاعتماد:'}</span>
              <span className="font-mono text-[10px] font-black">{date}</span>
            </div>
            <div className="text-[8px] font-black tracking-wider uppercase px-2.5 py-0.5 rounded-full"
              style={{ color: theme1.titleColor, background: theme1.badgeBg, border: `1px solid ${theme1.badgeBorder}` }}>
              {isEn ? '• Official Accreditation & Signatures •' : '• الاعتماد والتوقيعات الرسمية •'}
            </div>
          </div>

          {/* 3 Official Signatories Grid Container */}
          <div className="w-full overflow-x-auto pb-1 scrollbar-none">
            <div className="grid grid-cols-3 gap-2 sm:gap-6 items-end text-center px-1 min-w-[340px]">
              {isEn ? (
                <>
                  {/* 1. Entity President */}
                  <div className="flex flex-col items-center justify-end relative text-center">
                    <div className="min-h-[20px] flex items-center justify-center mb-0.5">
                      <span className="px-1.5 py-0.5 rounded-md text-[7px] sm:text-[9px] font-black uppercase tracking-tight shadow-2xs whitespace-nowrap"
                        style={{ background: theme1.badgeBg, color: theme1.titleColor, border: `1px solid ${theme1.badgeBorder}` }}>
                        Entity President
                      </span>
                    </div>
                    <div className="min-h-[28px] flex flex-col items-center justify-center my-0.5 leading-none text-center">
                      <span className="text-[14px] sm:text-[16px] select-none font-bold block" style={{ fontFamily: "'Great Vibes', 'Dancing Script', 'Segoe Script', cursive" }}>Mohamed Metwally</span>
                    </div>
                    <div className="w-10 sm:w-16 h-px my-1" style={{ background: theme1.accentColor }} />
                    <div className="text-[8px] sm:text-[10px] font-black leading-tight text-center">
                      <span className="block">Mr. Mohamed Metwally</span>
                    </div>
                  </div>

                  {/* 2. Governorate Head */}
                  <div className="flex flex-col items-center justify-end relative text-center">
                    <div className="min-h-[20px] flex items-center justify-center mb-0.5">
                      <span className="px-1.5 py-0.5 rounded-md text-[7px] sm:text-[9px] font-black uppercase tracking-tight shadow-2xs whitespace-nowrap"
                        style={{ background: theme1.badgeBg, color: theme1.titleColor, border: `1px solid ${theme1.badgeBorder}` }}>
                        GOVERNORATE HEAD
                      </span>
                    </div>
                    <div className="min-h-[28px] flex flex-col items-center justify-center my-0.5 leading-none text-center">
                      <span className="text-[14px] sm:text-[16px] select-none font-bold block" style={{ fontFamily: "'Great Vibes', 'Dancing Script', 'Segoe Script', cursive" }}>Mahmoud Rabie</span>
                    </div>
                    <div className="w-10 sm:w-16 h-px my-1" style={{ background: theme1.accentColor }} />
                    <div className="text-[8px] sm:text-[10px] font-black leading-tight text-center">
                      <span className="block">Mr. Mahmoud Rabie</span>
                    </div>
                  </div>

                  {/* 3. HR Committee Head */}
                  <div className="flex flex-col items-center justify-end relative text-center">
                    <div className="min-h-[20px] flex items-center justify-center mb-0.5">
                      <span className="px-1.5 py-0.5 rounded-md text-[7px] sm:text-[9px] font-black uppercase tracking-tight shadow-2xs whitespace-nowrap"
                        style={{ background: theme1.badgeBg, color: theme1.titleColor, border: `1px solid ${theme1.badgeBorder}` }}>
                        HR COMMITTEE HEAD
                      </span>
                    </div>
                    <div className="min-h-[28px] flex flex-col items-center justify-center my-0.5 leading-none text-center">
                      <span className="text-[14px] sm:text-[16px] select-none font-bold block" style={{ fontFamily: "'Great Vibes', 'Dancing Script', 'Segoe Script', cursive" }}>Ahmed Ibrahim</span>
                    </div>
                    <div className="w-10 sm:w-16 h-px my-1" style={{ background: theme1.accentColor }} />
                    <div className="text-[8px] sm:text-[10px] font-black leading-tight text-center">
                      <span className="block">Mr. Ahmed Ibrahim</span>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* 1. رئيس الكيان — توقيع ثابت دائماً */}
                  <div className="flex flex-col items-center justify-end relative text-center">
                    <div className="min-h-[20px] flex items-center justify-center mb-0.5">
                      <span className="px-1.5 py-0.5 rounded-md text-[8px] sm:text-[10px] font-black shadow-2xs whitespace-nowrap"
                        style={{ background: theme1.badgeBg, color: theme1.titleColor, border: `1px solid ${theme1.badgeBorder}` }}>
                        رئيس الكيان
                      </span>
                    </div>
                    <div className="min-h-[28px] flex flex-col items-center justify-center my-0.5 leading-none text-center">
                      <span className="text-[13px] sm:text-[15px] select-none font-black block" style={{ fontFamily: "'Aldhabi', 'Aref Ruqaa', 'Amiri', serif" }}>محمد متولي</span>
                    </div>
                    <div className="w-10 sm:w-16 h-px my-1" style={{ background: theme1.accentColor }} />
                    <div className="text-[8px] sm:text-[10px] font-black leading-tight text-center">
                      <span className="block">أ. محمد متولي</span>
                    </div>
                  </div>

                  {/* 2. رئيس الغربية */}
                  <div className="flex flex-col items-center justify-end relative text-center">
                    <div className="min-h-[20px] flex items-center justify-center mb-0.5">
                      <span className="px-1.5 py-0.5 rounded-md text-[8px] sm:text-[10px] font-black shadow-2xs whitespace-nowrap"
                        style={{ background: theme1.badgeBg, color: theme1.titleColor, border: `1px solid ${theme1.badgeBorder}` }}>
                        رئيس الغربية
                      </span>
                    </div>
                    <div className="min-h-[28px] flex flex-col items-center justify-center my-0.5 leading-none text-center">
                      <span className="text-[13px] sm:text-[15px] select-none font-black block" style={{ fontFamily: "'Aldhabi', 'Aref Ruqaa', 'Amiri', serif" }}>محمود ربيع</span>
                    </div>
                    <div className="w-10 sm:w-16 h-px my-1" style={{ background: theme1.accentColor }} />
                    <div className="text-[8px] sm:text-[10px] font-black leading-tight text-center">
                      <span className="block">أ. محمود ربيع</span>
                    </div>
                  </div>

                  {/* 3. مسؤول لجنة الموارد البشرية */}
                  <div className="flex flex-col items-center justify-end relative text-center">
                    <div className="min-h-[20px] flex items-center justify-center mb-0.5">
                      <span className="px-1.5 py-0.5 rounded-md text-[8px] sm:text-[10px] font-black shadow-2xs whitespace-nowrap"
                        style={{ background: theme1.badgeBg, color: theme1.titleColor, border: `1px solid ${theme1.badgeBorder}` }}>
                        مسؤول لجنة الموارد البشرية
                      </span>
                    </div>
                    <div className="min-h-[28px] flex flex-col items-center justify-center my-0.5 leading-none text-center">
                      <span className="text-[13px] sm:text-[15px] select-none font-black block" style={{ fontFamily: "'Aldhabi', 'Aref Ruqaa', 'Amiri', serif" }}>أحمد إبراهيم</span>
                    </div>
                    <div className="w-10 sm:w-16 h-px my-1" style={{ background: theme1.accentColor }} />
                    <div className="text-[8px] sm:text-[10px] font-black leading-tight text-center">
                      <span className="block">أ. أحمد إبراهيم</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={onPrint}
          className="mt-5 flex items-center gap-1.5 text-xs font-bold rounded-xl px-4 py-2 mx-auto transition-all cursor-pointer"
          style={{
            color: '#ffffff',
            background: 'linear-gradient(135deg, #2b66ff 0%, #1b4cd3 100%)',
            border: '1px solid #1b4cd3',
          }}
          id="cert-download-btn"
        >
          <Download className="w-3.5 h-3.5" />
          {isEn ? 'Download / Print Certificate' : 'تحميل / طباعة الشهادة'}
        </button>
      </div>
    </div>
  );
};

export const CertificateGenerator: React.FC<CertificateGeneratorProps> = ({ currentUser }) => {
  const { language } = useLanguage();
  const ar = language === 'ar';
  const canIssue = ['Super Admin', 'Head', 'Vice', 'Coordinator', 'Deputy Coordinator', 'Leader', 'HRM'].includes(currentUser.role);
  const canApprove = ['Super Admin', 'Head', 'Vice', 'HRM'].includes(currentUser.role);
  const [tab, setTab] = useState<'issue' | 'my' | 'all' | 'pending'>(canIssue ? 'issue' : 'my');
  const [selectedRecipient, setSelectedRecipient] = useState('');
  const [certType, setCertType] = useState<CertificateType>('appreciation');
  const [selectedStyle, setSelectedStyle] = useState<'style1' | 'style2' | 'style3' | 'style4' | 'style5'>('style1');
  const [certLang, setCertLang] = useState<'ar' | 'en'>('ar');
  const [customTitle, setCustomTitle] = useState('');
  const [customBody, setCustomBody] = useState('');
  const [certGrade, setCertGrade] = useState<string>('');
  const [issueSuccess, setIssueSuccess] = useState<IssuedCertificate | null>(null);
  const [previewCert, setPreviewCert] = useState<IssuedCertificate | null>(null);
  const [livePreview, setLivePreview] = useState<IssuedCertificate | null>(null);
  const [fullScreenModalCert, setFullScreenModalCert] = useState<IssuedCertificate | null>(null);
  const [issuedSearchQuery, setIssuedSearchQuery] = useState('');
  const [error, setError] = useState('');

  // 24-Hour Workshop Certificates Countdown & Lifecycle
  const [workshopRemaining, setWorkshopRemaining] = useState(getWorkshopRemainingTime());
  const isWorkshopActive = !workshopRemaining.isExpired;

  useEffect(() => {
    const timer = setInterval(() => {
      setWorkshopRemaining(getWorkshopRemainingTime());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const activeCertTypes = isWorkshopActive
    ? [...BASE_CERT_TYPES, ...WORKSHOP_TYPES_LIST]
    : BASE_CERT_TYPES;

  const handleApplyWorkshopTemplate = (tpl: WorkshopCertTemplate) => {
    setCertType(tpl.id);
    setCertLang('en');
    setCustomTitle(tpl.title);
    const recipient = users.find(u => u.id === selectedRecipient);
    const resolvedBody = formatBodyForRecipient(tpl.bodyTemplate, recipient?.fullName || '[Name]');
    setCustomBody(resolvedBody);
  };

  const toCertGeneratorData = (cert: IssuedCertificate) => ({
    memberName: cert.recipientName,
    recipientRole: cert.recipientRole,
    certTitle: cert.title,
    certType: cert.certType,
    body: cert.body || '',
    grade: cert.grade ?? undefined,
    reviewerName: cert.issuedByName,
    issuedByTitle: cert.issuedByTitle,
    committee: cert.committee || '',
    date: new Date(cert.issuedAt).toLocaleDateString(cert.lang === 'en' ? 'en-US' : 'ar-EG', { year: 'numeric', month: 'long', day: 'numeric' }),
    lang: cert.lang || 'ar',
  });

  const downloadLiveElement = async (certId: string, recipientName: string, title: string) => {
    const el = document.getElementById(`certificate-preview-card-${certId}`);
    if (!el) return false;
    try {
      const canvas = await html2canvas(el, {
        scale: 3,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
      });
      const dataUrl = canvas.toDataURL('image/png', 1.0);
      const link = document.createElement('a');
      link.download = `EYE_Certificate_${(recipientName || 'Member').replace(/\s+/g, '_')}_${(title || 'Certificate').replace(/\s+/g, '_')}.png`;
      link.href = dataUrl;
      link.click();
      return true;
    } catch (err) {
      console.warn('[Download Live Element Error]', err);
      return false;
    }
  };

  const printLiveElement = async (certId: string) => {
    const el = document.getElementById(`certificate-preview-card-${certId}`);
    if (!el) return false;
    try {
      const canvas = await html2canvas(el, {
        scale: 3,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
      });
      const dataUrl = canvas.toDataURL('image/png', 1.0);
      const printWindow = window.open('', '_blank');
      if (!printWindow) return false;
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>EYE Certificate Print</title>
            <style>
              @page { size: landscape; margin: 0; }
              body { margin: 0; padding: 0; display: flex; align-items: center; justify-content: center; background: #fff; height: 100vh; }
              img { max-width: 98vw; max-height: 98vh; object-fit: contain; }
            </style>
          </head>
          <body onload="window.print(); window.close();">
            <img src="${dataUrl}" />
          </body>
        </html>
      `);
      printWindow.document.close();
      return true;
    } catch (err) {
      console.warn('[Print Live Element Error]', err);
      return false;
    }
  };

  const handlePrint = async (cert: IssuedCertificate) => {
    if (cert.status === 'pending' && !canApprove) {
      alert(ar ? '⚠️ هذه الشهادة بانتظار موافقة واقتران الإدارة (مسئول لجنة الموارد البشرية) أولاً. لا يمكن طباعتها قبل الاعتماد الرسمي.' : 'Pending admin approval.');
      return;
    }
    const ok = await printLiveElement(cert.id);
    if (!ok) printCertificate(toCertGeneratorData(cert));
  };

  const handleDownload = async (cert: IssuedCertificate) => {
    if (cert.status === 'pending' && !canApprove) {
      alert(ar ? '⚠️ هذه الشهادة بانتظار موافقة واقتران الإدارة (مسئول لجنة الموارد البشرية) أولاً. لا يمكن تحميلها قبل الاعتماد الرسمي.' : 'Pending admin approval.');
      return;
    }
    const ok = await downloadLiveElement(cert.id, cert.recipientName, cert.title);
    if (!ok) downloadCertificate(toCertGeneratorData(cert));
  };

  const handleDownloadPdf = async (cert: IssuedCertificate) => {
    if (cert.status === 'pending' && !canApprove) {
      alert(ar ? '⚠️ هذه الشهادة بانتظار موافقة واقتران الإدارة (مسئول لجنة الموارد البشرية) أولاً. لا يمكن تحميلها قبل الاعتماد الرسمي.' : 'Pending admin approval.');
      return;
    }
    await downloadCertificateAsPdf(toCertGeneratorData(cert));
  };

  const [emailToast, setEmailToast] = useState(false);
  const [transparentLogo, setTransparentLogo] = useState<string>('/eye-logo.png');

  // Multi-select & Batch PDF Export state
  const [selectedCertIds, setSelectedCertIds] = useState<string[]>([]);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfProgress, setPdfProgress] = useState<{ current: number; total: number } | null>(null);
  const [lastBulkIssuedCerts, setLastBulkIssuedCerts] = useState<IssuedCertificate[]>([]);

  // Bulk Deletion & Deduplication states
  const [bulkSkippedCount, setBulkSkippedCount] = useState<number>(0);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [bulkDeleteSuccessMsg, setBulkDeleteSuccessMsg] = useState<string | null>(null);
  const [customSelectCount, setCustomSelectCount] = useState<string>('');
  const [allowDuplicateOverride, setAllowDuplicateOverride] = useState(false);

  const handleBulkDelete = async () => {
    if (selectedCertIds.length === 0) return;
    setIsDeletingBulk(true);
    try {
      const countToDelete = selectedCertIds.length;
      await db.deleteCertificatesBulk(selectedCertIds, currentUser);
      setSelectedCertIds([]);
      setShowBulkDeleteModal(false);
      setBulkDeleteSuccessMsg(
        ar
          ? `✅ تم مسح ${countToDelete} شهادة بنجاح وبشكل نهائي من قاعدة البيانات وكافة السجلات والإشعارات!`
          : `✅ Successfully purged ${countToDelete} certificates completely from all records!`
      );
      setTimeout(() => setBulkDeleteSuccessMsg(null), 8000);
    } catch (err: any) {
      console.error('Bulk delete failed:', err);
      alert(ar ? `حدث خطأ أثناء مسح الشهادات: ${err.message}` : `Failed to delete certificates: ${err.message}`);
    } finally {
      setIsDeletingBulk(false);
    }
  };

  const handleDownloadBatchPdf = async (certsList: IssuedCertificate[], customFilename?: string) => {
    const validCerts = certsList.filter(c => c.status !== 'pending' || canApprove);
    if (validCerts.length === 0) {
      alert(ar ? 'لا توجد شهادات معتمدة جاهزة للتحميل.' : 'No approved certificates available to download.');
      return;
    }
    setIsGeneratingPdf(true);
    setPdfProgress({ current: 1, total: validCerts.length });
    try {
      const dataList = validCerts.map(toCertGeneratorData);
      const dateStr = new Date().toISOString().slice(0, 10);
      const filename = customFilename || `شهادات_كيان_المصريون_الشباب_${dateStr}.pdf`;
      await downloadBulkCertificatesAsPdf(dataList, filename, (current, total) => {
        setPdfProgress({ current, total });
      });
    } catch (err) {
      console.error('Failed to generate batch PDF:', err);
      alert(ar ? 'حدث خطأ أثناء إنشاء ملف الـ PDF المجمع.' : 'Failed to export batch PDF.');
    } finally {
      setIsGeneratingPdf(false);
      setPdfProgress(null);
    }
  };

  useEffect(() => {
    const img = new Image();
    img.src = '/eye-logo.png';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const minColor = Math.min(r, g, b);
        if (r > 190 && g > 190 && b > 190) {
          data[i + 3] = 0; // 100% pure transparent cutout!
        }
      }
      ctx.putImageData(imgData, 0, 0);
      setTransparentLogo(canvas.toDataURL('image/png'));
    };
  }, []);

  const users = db.getUsers(currentUser).filter(u => u.id !== currentUser.id);
  const myCerts = db.getMyCertificates(currentUser.id);
  const selectedDef = ALL_KNOWN_CERT_TYPES.find(c => c.id === certType) || BASE_CERT_TYPES[0];
  const [memberSearch, setMemberSearch] = useState('');

  const buildDefaultBody = (recipientId: string, type: CertificateType, lang: 'ar' | 'en' = 'ar') => {
    const r = users.find(u => u.id === recipientId);
    const name = r?.fullName || '[Name]';
    if (lang === 'en' || isWorkshopCertType(type)) {
      if (type === 'linkedin_workshop') {
        return `This certificate is proudly presented to ${name} in recognition of their participation in the LinkedIn session, covering key practices for building and optimizing a professional LinkedIn profile and strengthening their professional presence.`;
      }
      if (type === 'career_skills_workshop') {
        return `This certificate is proudly presented to ${name} in recognition of their participation in the Career Development session, covering CV writing, ATS optimization, portfolio development, and personal branding.`;
      }
      if (type === 'career_dev_workshop') {
        return `This certificate is proudly presented to ${name} in recognition of their successful participation in the Career Development Program, covering LinkedIn, CV writing, ATS optimization, portfolio development, and personal branding.`;
      }
      if (type === 'appreciation') return `The Egyptian Youth Entity (EYE) presents this certificate in recognition and appreciation of member ${name} for outstanding efforts and sincere dedication in serving the team and achieving the entity's goals.`;
      if (type === 'excellence') return `The Egyptian Youth Entity (EYE) certifies that ${name} has demonstrated exceptional performance and high level of excellence, reflecting true competence and high volunteer spirit deserving of appreciation.`;
      if (type === 'training') return `This is to certify that ${name} has successfully completed the specified training program within the EYE entity and passed all required standards with efficiency.`;
      if (type === 'leadership') return `The Egyptian Youth Entity (EYE) honors ${name} for distinguished leadership, management, and inspiring team members, contributing to elevated performance and honorable results.`;
      return '';
    }
    if (type === 'appreciation') return `يشهد كيان المصريون الشباب EYE بأن العضو ${name} قد بذل جهوداً متميزة وعطاءً صادقاً في خدمة فريق العمل وتحقيق أهداف الكيان، وتكريماً لجهوده وتفانيه يُمنح هذه الشهادة.`;
    if (type === 'excellence') return `يشهد كيان المصريون الشباب EYE بأن العضو ${name} قد أثبت تميزاً استثنائياً وأداءً رفيعاً يعبّر عن كفاءة عالية وروح تطوعية متميزة تستحق التقدير والإشادة.`;
    if (type === 'training') return `يشهد كيان المصريون الشباب EYE بأن العضو ${name} قد أتمّ بنجاح متطلبات البرنامج التدريبي واجتاز كافة معاييره المطلوبة بكفاءة واقتدار.`;
    if (type === 'leadership') return `يشهد كيان المصريون الشباب EYE ويُكرّم العضو ${name} تقديراً لقيادته المتميزة وحسن إدارته وإلهامه لأعضاء فريقه، مما أسهم في رفع مستوى الأداء وتحقيق نتائج مشرّفة.`;
    return `يشهد كيان المصريون الشباب EYE بتميز واستحقاق العضو ${name}.`;
  };

  // Issue Mode: single | bulk | sheet
  const [issueMode, setIssueMode] = useState<'single' | 'bulk' | 'sheet'>('single');
  const isBulkMode = issueMode === 'bulk';

  // Sheet Import State
  const [sheetRecipients, setSheetRecipients] = useState<SheetRecipient[]>([]);
  const [sheetFileName, setSheetFileName] = useState<string>('');
  const [sheetParseError, setSheetParseError] = useState<string>('');
  const [isParsingSheet, setIsParsingSheet] = useState<boolean>(false);
  const [isDraggingSheet, setIsDraggingSheet] = useState<boolean>(false);
  const [sheetFilter, setSheetFilter] = useState<'all' | 'matched' | 'unmatched'>('all');
  const [sheetSearch, setSheetSearch] = useState<string>('');
  const sheetFileInputRef = useRef<HTMLInputElement>(null);

  const downloadSampleCertificatesSheet = () => {
    const csvContent = `اسم العضو,كود العضو,البريد الإلكتروني,اللجنة,الدرجة
أحمد محمد إبراهيم,EYE-HR-0001,ahmed@example.com,HR,95
سارة محمود علي,EYE-PR-0002,sara@example.com,PR,90
محمود خالد حسن,EYE-SM-0003,mahmoud@example.com,SM,88
فاطمة مصطفى أحمد,EYE-OR-0004,fatma@example.com,OR,92`;

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'نموذج_شيت_الشهادات_EYE.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const parseSheetFile = async (file: File) => {
    setSheetParseError('');
    setSheetFileName(file.name);
    setIsParsingSheet(true);

    const isCSV = file.name.toLowerCase().endsWith('.csv');
    const isExcel = file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls');

    if (!isCSV && !isExcel) {
      setSheetParseError(ar ? 'صيغة الملف غير مدعومة. يُرجى رفع ملف إكسيل (.xlsx / .csv)' : 'Unsupported format. Please upload .xlsx or .csv');
      setIsParsingSheet(false);
      return;
    }

    try {
      let rawRows: Array<Record<string, string>> = [];

      if (isCSV) {
        const text = await file.text();
        const lines = text.split(/\r?\n/).filter(line => line.trim());
        if (lines.length === 0) {
          setSheetParseError(ar ? 'الملف فارغ ولا يحتوي على بيانات.' : 'File is empty.');
          setIsParsingSheet(false);
          return;
        }

        const parseCSVLine = (line: string) => {
          const result: string[] = [];
          let cur = '';
          let inQuotes = false;
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              result.push(cur.trim().replace(/^"|"$/g, ''));
              cur = '';
            } else {
              cur += char;
            }
          }
          result.push(cur.trim().replace(/^"|"$/g, ''));
          return result;
        };

        const headers = parseCSVLine(lines[0]);
        rawRows = lines.slice(1).map(line => {
          const cols = parseCSVLine(line);
          const obj: Record<string, string> = {};
          headers.forEach((h, i) => {
            obj[h || `col_${i}`] = cols[i] || '';
          });
          return obj;
        });
      } else {
        const buffer = await file.arrayBuffer();
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer);
        const worksheet = workbook.worksheets[0];
        if (!worksheet) {
          setSheetParseError(ar ? 'الملف لا يحتوي على صفحات بيانات.' : 'No worksheet found.');
          setIsParsingSheet(false);
          return;
        }

        const grid: string[][] = [];
        worksheet.eachRow((row) => {
          const rowData: string[] = [];
          row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            let val = '';
            if (cell.value !== null && cell.value !== undefined) {
              if (typeof cell.value === 'object' && 'text' in cell.value) {
                val = String((cell.value as any).text || '');
              } else if (typeof cell.value === 'object' && 'result' in cell.value) {
                val = String((cell.value as any).result || '');
              } else {
                val = String(cell.value);
              }
            }
            rowData[colNumber - 1] = val.trim();
          });
          grid.push(rowData);
        });

        if (grid.length === 0) {
          setSheetParseError(ar ? 'الملف فارغ ولا يحتوي على بيانات.' : 'File is empty.');
          setIsParsingSheet(false);
          return;
        }

        const headers = grid[0];
        rawRows = grid.slice(1).map(row => {
          const obj: Record<string, string> = {};
          headers.forEach((h, i) => {
            obj[h || `col_${i}`] = row[i] || '';
          });
          return obj;
        });
      }

      if (rawRows.length === 0) {
        setSheetParseError(ar ? 'الملف لا يحتوي على أي صفوف بعد رأس الجدول.' : 'No data rows found.');
        setIsParsingSheet(false);
        return;
      }

      const getColVal = (row: Record<string, string>, possibleNames: string[]): string => {
        const keys = Object.keys(row);
        for (const name of possibleNames) {
          const norm = name.trim().toLowerCase();
          const k = keys.find(key => key.trim().toLowerCase() === norm || key.trim().toLowerCase().includes(norm));
          if (k && row[k]?.trim()) return row[k].trim();
        }
        return '';
      };

      const allUsers = db.getUsers();
      const recipients: SheetRecipient[] = [];

      rawRows.forEach((row, idx) => {
        const rawName = getColVal(row, ['اسم العضو', 'الاسم', 'اسم', 'الاسم بالكامل', 'الاسم الثلاثي', 'name', 'member name', 'full name', 'student name', 'fullname', 'recipient']);
        const rawCode = getColVal(row, ['كود العضو', 'كود', 'الكود', 'كود العضوية', 'code', 'membership code', 'id', 'member code']);
        const rawEmail = getColVal(row, ['البريد الإلكتروني', 'الإيميل', 'البريد', 'email', 'e-mail', 'mail']);
        const rawGrade = getColVal(row, ['الدرجة', 'التقييم', 'درجة التقييم', 'grade', 'rating', 'score']);
        const rawCommittee = getColVal(row, ['اللجنة', 'القسم', 'committee', 'dept', 'department']);
        const rawRole = getColVal(row, ['المنصب', 'الدور', 'role', 'position']);
        const rawTitle = getColVal(row, ['عنوان الشهادة', 'عنوان', 'title', 'cert title']);
        const rawBody = getColVal(row, ['نص الشهادة', 'النص', 'body', 'cert body']);

        if (!rawName && !rawCode && !rawEmail) return;

        const matched = matchMember(rawName, rawCode, rawEmail, allUsers);
        const gradeNum = rawGrade ? parseInt(rawGrade.replace(/[^0-9]/g, '')) : undefined;

        recipients.push({
          id: `sheet-${idx + 1}-${Math.random().toString(36).slice(2, 6)}`,
          name: matched ? matched.fullName : (rawName || rawCode || 'عضو'),
          code: matched?.membershipCode || rawCode || undefined,
          email: matched?.email || rawEmail || undefined,
          committee: matched?.committee || rawCommittee || 'General',
          role: matched?.role || rawRole || 'Member',
          grade: !isNaN(Number(gradeNum)) ? gradeNum : undefined,
          customTitle: rawTitle || undefined,
          customBody: rawBody || undefined,
          matchedUser: matched,
          status: matched ? 'matched' : 'unmatched',
          selected: true,
        });
      });

      if (recipients.length === 0) {
        setSheetParseError(ar ? 'لم يتم العثور على أي أسماء أو أكواد صالحة في الشيت. تأكد من وجود عمود باسم العضو أو الكود.' : 'No valid recipient names found in sheet.');
        setIsParsingSheet(false);
        return;
      }

      setSheetRecipients(recipients);
    } catch (err: any) {
      console.error('Error parsing sheet:', err);
      setSheetParseError(ar ? `حدث خطأ أثناء قراءة الملف: ${err.message || err}` : `Failed to parse sheet: ${err.message || err}`);
    } finally {
      setIsParsingSheet(false);
    }
  };

  const handleIssueSheet = async (downloadPdfDirectly: boolean = false) => {
    setError('');
    const toIssue = sheetRecipients.filter(r => r.selected);
    if (toIssue.length === 0) {
      setError(ar ? 'يرجى تحديد شخص واحد على الأقل من الشيت لإصدار الشهادات.' : 'Please select at least one person from sheet.');
      return;
    }

    const isEnCert = certLang === 'en' || isWorkshopCertType(certType);
    const workshopTpl = WORKSHOP_CERT_TEMPLATES.find(t => t.id === certType);
    const baseTitle = workshopTpl
      ? (customTitle || workshopTpl.title)
      : certType === 'custom'
        ? customTitle
        : (isEnCert ? (selectedDef?.label || 'Certificate') : (selectedDef?.labelAr || 'شهادة'));
    if (certType === 'custom' && !customTitle) {
      setError(ar ? 'يرجى كتابة عنوان الشهادة.' : 'Please enter a certificate title.');
      return;
    }

    if (downloadPdfDirectly) {
      setIsGeneratingPdf(true);
      setPdfProgress({ current: 0, total: toIssue.length });
    }

    try {
      let count = 0;
      let skippedDuplicateCount = 0;
      const newlyIssued: IssuedCertificate[] = [];

      for (let i = 0; i < toIssue.length; i++) {
        const item = toIssue[i];
        const recipientId = item.matchedUser ? item.matchedUser.id : `ext-${item.id}`;
        const recipientName = item.name;
        const recipientRole = item.role || item.matchedUser?.role || 'Member';
        const committee = item.committee || item.matchedUser?.committee || 'General';
        const title = item.customTitle || baseTitle;
        const rawBody = item.customBody || customBody || buildDefaultBody(recipientId, certType, certLang);
        const body = formatBodyForRecipient(rawBody, recipientName);
        const grade = item.grade !== undefined ? item.grade : (certGrade ? parseInt(certGrade) : undefined);

        // Deduplication Check
        if (!allowDuplicateOverride) {
          const existing = db.findDuplicateCertificate({
            recipientId,
            recipientName,
            certType,
            title,
            body,
          });
          if (existing) {
            skippedDuplicateCount++;
            continue;
          }
        }

        const cert = await db.issueCertificate(
          recipientId,
          recipientName,
          recipientRole,
          certType,
          title,
          body,
          currentUser,
          committee,
          grade,
          certLang,
          selectedStyle,
          {
            allowDuplicate: allowDuplicateOverride,
            recipientEmail: item.email || item.matchedUser?.email,
          }
        );
        newlyIssued.push(cert);
        count++;

        if (downloadPdfDirectly) {
          setPdfProgress({ current: count, total: toIssue.length });
        }
      }

      if (count === 0 && skippedDuplicateCount > 0) {
        if (downloadPdfDirectly) setIsGeneratingPdf(false);
        setError(
          ar
            ? `⚠️ لم يتم إصدار أي شهادات؛ لأن جميع الأشخاص المحددين من الشيت (${skippedDuplicateCount}) حصلوا على هذه الشهادة مسبقاً بنفس البيانات.`
            : `No certificates issued. All ${skippedDuplicateCount} selected people already received this certificate.`
        );
        return;
      }

      setBulkCountSuccess(count);
      setBulkSkippedCount(skippedDuplicateCount);
      setLastBulkIssuedCerts(newlyIssued);
      setSheetRecipients([]);
      setSheetFileName('');

      if (downloadPdfDirectly && newlyIssued.length > 0) {
        const certsData = newlyIssued.map(toCertGeneratorData);
        const dateStr = new Date().toISOString().slice(0, 10);
        const filename = `شهادات_شيت_${sheetFileName ? sheetFileName.replace(/\.[^/.]+$/, '') : 'دفعة'}_${dateStr}.pdf`;
        await downloadBulkCertificatesAsPdf(certsData, filename, (cur, tot) => {
          setPdfProgress({ current: cur, total: tot });
        });
      }

      setTimeout(() => {
        setBulkCountSuccess(null);
        setBulkSkippedCount(0);
      }, 10000);
    } catch (err: any) {
      console.error(err);
      setError(ar ? `فشل إصدار الشهادات من الشيت: ${err.message}` : `Sheet issue failed: ${err.message}`);
    } finally {
      setIsGeneratingPdf(false);
      setPdfProgress(null);
    }
  };

  // Build live preview cert object whenever form fields change
  useEffect(() => {
    let previewName = '';
    let previewRole = 'Member';
    let previewCommittee = 'General';
    let previewId = 'preview-0000';
    let previewGrade = certGrade ? parseInt(certGrade) : undefined;

    if (issueMode === 'sheet') {
      const firstSelected = sheetRecipients.find(r => r.selected);
      if (firstSelected) {
        previewName = firstSelected.name;
        previewRole = firstSelected.role || 'Member';
        previewCommittee = firstSelected.committee || 'General';
        previewId = firstSelected.matchedUser?.id || 'preview-0000';
        if (firstSelected.grade !== undefined) previewGrade = firstSelected.grade;
      } else {
        setLivePreview(null);
        return;
      }
    } else if (isBulkMode) {
      if (selectedRecipients.length > 0) {
        const u = users.find(user => user.id === selectedRecipients[0]);
        if (u) {
          previewName = u.fullName;
          previewRole = u.role;
          previewCommittee = u.committee;
          previewId = u.id;
        }
      } else {
        setLivePreview(null);
        return;
      }
    } else {
      if (!selectedRecipient) { setLivePreview(null); return; }
      const recipient = users.find(u => u.id === selectedRecipient);
      if (!recipient) return;
      previewName = recipient.fullName;
      previewRole = recipient.role;
      previewCommittee = recipient.committee;
      previewId = recipient.id;
    }

    const isEnCert = certLang === 'en' || isWorkshopCertType(certType);
    const workshopTpl = WORKSHOP_CERT_TEMPLATES.find(t => t.id === certType);
    const title = workshopTpl
      ? (customTitle || workshopTpl.title)
      : certType === 'custom'
        ? (customTitle || (isEnCert ? 'Custom Certificate' : 'شهادة مخصصة'))
        : (isEnCert ? (selectedDef?.label || 'Certificate') : (selectedDef?.labelAr || 'شهادة'));
    const rawBody = customBody || buildDefaultBody(previewId, certType, certLang);
    const body = formatBodyForRecipient(rawBody, previewName);
    const preview: IssuedCertificate = {
      id: 'preview-0000',
      recipientId: previewId,
      recipientName: previewName,
      recipientRole: previewRole,
      certType,
      designStyle: selectedStyle,
      title,
      body,
      committee: previewCommittee,
      issuedBy: currentUser.id,
      issuedByName: currentUser.fullName,
      issuedByTitle: getUserRoleTitle(currentUser, certLang),
      issuedAt: new Date().toISOString(),
      grade: previewGrade,
      lang: certLang,
    };
    setLivePreview(preview);
  }, [selectedRecipient, selectedRecipients, sheetRecipients, issueMode, isBulkMode, certType, selectedStyle, certLang, customTitle, customBody, certGrade]);

  // Bulk issue state
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [bulkCountSuccess, setBulkCountSuccess] = useState<number | null>(null);

  const handleToggleSelectMember = (id: string) => {
    setSelectedRecipients(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllFiltered = (filteredMembers: UserProfile[]) => {
    const allIds = filteredMembers.map(u => u.id);
    const isAllSelected = allIds.every(id => selectedRecipients.includes(id));
    if (isAllSelected) {
      setSelectedRecipients(prev => prev.filter(id => !allIds.includes(id)));
    } else {
      const combined = Array.from(new Set([...selectedRecipients, ...allIds]));
      setSelectedRecipients(combined);
    }
  };

  const handleIssue = async () => {
    setError('');
    setIssueSuccess(null);

    // Sheet Mode Issue
    if (issueMode === 'sheet') {
      await handleIssueSheet(false);
      return;
    }

    // Bulk Mode Issue
    if (isBulkMode) {
      if (selectedRecipients.length === 0) {
        setError(ar ? 'يرجى تحديد عضو واحد على الأقل لإصدار الشهادات.' : 'Please select at least one recipient.');
        return;
      }
      const isEnCert = certLang === 'en' || isWorkshopCertType(certType);
      const workshopTpl = WORKSHOP_CERT_TEMPLATES.find(t => t.id === certType);
      const title = workshopTpl
        ? (customTitle || workshopTpl.title)
        : certType === 'custom'
          ? customTitle
          : (isEnCert ? (selectedDef?.label || 'Certificate') : (selectedDef?.labelAr || 'شهادة'));
      if (certType === 'custom' && !customTitle) {
        setError(ar ? 'يرجى كتابة عنوان الشهادة.' : 'Please enter a certificate title.');
        return;
      }

      try {
        let count = 0;
        let skippedDuplicateCount = 0;
        const newlyIssued: IssuedCertificate[] = [];
        for (const recipientId of selectedRecipients) {
          const recipient = users.find(u => u.id === recipientId);
          if (!recipient) continue;
          const rawBody = customBody || buildDefaultBody(recipientId, certType, certLang);
          const body = formatBodyForRecipient(rawBody, recipient.fullName);

          // Deduplication Check
          if (!allowDuplicateOverride) {
            const existing = db.findDuplicateCertificate({
              recipientId: recipient.id,
              recipientName: recipient.fullName,
              certType,
              title,
              body,
            });
            if (existing) {
              skippedDuplicateCount++;
              continue;
            }
          }

          const cert = await db.issueCertificate(
            recipient.id,
            recipient.fullName,
            recipient.role,
            certType,
            title,
            body,
            currentUser,
            recipient.committee,
            certGrade ? parseInt(certGrade) : undefined,
            certLang,
            selectedStyle,
            { allowDuplicate: allowDuplicateOverride }
          );
          newlyIssued.push(cert);
          count++;
        }

        if (count === 0 && skippedDuplicateCount > 0) {
          setError(
            ar
              ? `⚠️ لم يتم إصدار أي شهادات؛ لأن جميع الأعضاء المحددين (${skippedDuplicateCount}) حصلوا على هذه الشهادة مسبقاً بنفس البيانات لمنع التكرار.`
              : `No certificates issued. All ${skippedDuplicateCount} selected members already received this certificate.`
          );
          return;
        }

        setBulkCountSuccess(count);
        setBulkSkippedCount(skippedDuplicateCount);
        setLastBulkIssuedCerts(newlyIssued);
        setSelectedRecipients([]);
        setCustomBody('');
        setCustomTitle('');
        setCertGrade('');
        setTimeout(() => {
          setBulkCountSuccess(null);
          setBulkSkippedCount(0);
        }, 9000);
      } catch (err: any) {
        console.error(err);
        setError(ar ? `فشل الإصدار الجماعي: ${err.message}` : `Bulk issue failed: ${err.message}`);
      }
      return;
    }

    // Single Recipient Issue
    if (!selectedRecipient) { setError(ar ? 'يرجى اختيار العضو.' : 'Please select a recipient.'); return; }
    const isEnCert = certLang === 'en' || isWorkshopCertType(certType);
    const workshopTpl = WORKSHOP_CERT_TEMPLATES.find(t => t.id === certType);
    const title = workshopTpl
      ? (customTitle || workshopTpl.title)
      : certType === 'custom'
        ? customTitle
        : (isEnCert ? (selectedDef?.label || 'Certificate') : (selectedDef?.labelAr || 'شهادة'));
    if (certType === 'custom' && !customTitle) { setError(ar ? 'يرجى كتابة عنوان الشهادة.' : 'Please enter a certificate title.'); return; }
    const recipient = users.find(u => u.id === selectedRecipient)!;
    const rawBody = customBody || buildDefaultBody(selectedRecipient, certType, certLang);
    const body = formatBodyForRecipient(rawBody, recipient.fullName);

    // Single Deduplication Check
    if (!allowDuplicateOverride) {
      const duplicate = db.findDuplicateCertificate({
        recipientId: recipient.id,
        recipientName: recipient.fullName,
        certType,
        title,
        body,
      });
      if (duplicate) {
        setError(
          ar
            ? `⚠️ تم إصدار هذه الشهادة للعضو (${recipient.fullName}) مسبقاً بنفس البيانات بعنوان "${duplicate.title}" بتاريخ ${new Date(duplicate.issuedAt).toLocaleDateString('ar-EG')}. تم إلغاء الإصدار لحمايته من تكرار الاستلام.`
            : `Duplicate certificate detected for ${recipient.fullName}. Issue prevented to avoid duplicate delivery.`
        );
        return;
      }
    }

    try {
      const cert = await db.issueCertificate(
        recipient.id,
        recipient.fullName,
        recipient.role,
        certType,
        title,
        body,
        currentUser,
        recipient.committee,
        certGrade ? parseInt(certGrade) : undefined,
        certLang,
        selectedStyle,
        { allowDuplicate: allowDuplicateOverride }
      );
      setIssueSuccess(cert);
      setPreviewCert(cert);
      setLivePreview(null);
      setSelectedRecipient('');
      setCustomBody('');
      setCustomTitle('');
      setCertGrade('');
      if (recipient.email) {
        setEmailToast(true);
        setTimeout(() => setEmailToast(false), 4000);
      }
    } catch (err: any) {
      console.error(err);
      setError(ar ? `فشل إصدار الشهادة وحفظها في قاعدة البيانات: ${err.message}` : `Failed to issue certificate and save to database: ${err.message}`);
    }
  };

  const handleIssueAndDownloadBulkPdf = async () => {
    if (selectedRecipients.length === 0) {
      setError(ar ? 'يرجى تحديد عضو واحد على الأقل لإصدار الشهادات.' : 'Please select at least one recipient.');
      return;
    }
    const isEnCert = certLang === 'en' || isWorkshopCertType(certType);
    const workshopTpl = WORKSHOP_CERT_TEMPLATES.find(t => t.id === certType);
    const title = workshopTpl
      ? (customTitle || workshopTpl.title)
      : certType === 'custom'
        ? customTitle
        : (isEnCert ? (selectedDef?.label || 'Certificate') : (selectedDef?.labelAr || 'شهادة'));
    if (certType === 'custom' && !customTitle) {
      setError(ar ? 'يرجى كتابة عنوان الشهادة.' : 'Please enter a certificate title.');
      return;
    }

    try {
      setIsGeneratingPdf(true);
      setPdfProgress({ current: 0, total: selectedRecipients.length });
      let count = 0;
      let skippedDuplicateCount = 0;
      const newlyIssued: IssuedCertificate[] = [];
      for (let i = 0; i < selectedRecipients.length; i++) {
        const recipientId = selectedRecipients[i];
        const recipient = users.find(u => u.id === recipientId);
        if (!recipient) continue;
        const rawBody = customBody || buildDefaultBody(recipientId, certType, certLang);
        const body = formatBodyForRecipient(rawBody, recipient.fullName);

        // Deduplication Check
        if (!allowDuplicateOverride) {
          const existing = db.findDuplicateCertificate({
            recipientId: recipient.id,
            recipientName: recipient.fullName,
            certType,
            title,
            body,
          });
          if (existing) {
            skippedDuplicateCount++;
            continue;
          }
        }

        const cert = await db.issueCertificate(
          recipient.id,
          recipient.fullName,
          recipient.role,
          certType,
          title,
          body,
          currentUser,
          recipient.committee,
          certGrade ? parseInt(certGrade) : undefined,
          certLang,
          selectedStyle,
          { allowDuplicate: allowDuplicateOverride }
        );
        newlyIssued.push(cert);
        count++;
        setPdfProgress({ current: count, total: selectedRecipients.length });
      }

      if (count === 0 && skippedDuplicateCount > 0) {
        setIsGeneratingPdf(false);
        setError(
          ar
            ? `⚠️ لم يتم إصدار أي شهادات؛ لأن جميع الأعضاء المحددين (${skippedDuplicateCount}) استلموا هذه الشهادة مسبقاً بنفس البيانات.`
            : `No certificates issued. All ${skippedDuplicateCount} selected members already received this certificate.`
        );
        return;
      }

      setBulkCountSuccess(count);
      setBulkSkippedCount(skippedDuplicateCount);
      setLastBulkIssuedCerts(newlyIssued);
      setSelectedRecipients([]);
      setCustomBody('');
      setCustomTitle('');
      setCertGrade('');

      // Generate and download the multi-page PDF document
      const certsData = newlyIssued.map(toCertGeneratorData);
      const dateStr = new Date().toISOString().slice(0, 10);
      const filename = `شهادات_دفعة_${dateStr}.pdf`;
      await downloadBulkCertificatesAsPdf(certsData, filename, (current, total) => {
        setPdfProgress({ current, total });
      });
    } catch (err: any) {
      console.error(err);
      setError(ar ? `فشل الإصدار الجماعي: ${err.message}` : `Bulk issue failed: ${err.message}`);
    } finally {
      setIsGeneratingPdf(false);
      setPdfProgress(null);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6 relative" dir={ar ? 'rtl' : 'ltr'}>

      {/* Email Toast */}
      {emailToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-bold shadow-2xl animate-bounce"
          style={{ background: 'linear-gradient(135deg, #059669, #047857)', color: '#fff', minWidth: 260 }}>
          <Mail className="w-4 h-4 shrink-0" />
          {ar ? '📧 تم إرسال الشهادة بالبريد الإلكتروني للعضو!' : '📧 Certificate emailed to the member!'}
        </div>
      )}
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-2xl shadow-lg" style={{ background: 'linear-gradient(135deg, #2b66ff, #1b4cd3)', boxShadow: '0 8px 20px rgba(43,102,255,0.3)' }}>
          <Award className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-black text-slate-900 dark:text-white">{ar ? 'منشئ الشهادات' : 'Certificate Generator'}</h1>
          <p className="text-xs text-slate-500">{ar ? 'إصدار شهادات التقدير للأعضاء المتميزين' : 'Issue appreciation certificates to outstanding members'}</p>
        </div>
      </div>

      {/* Tabs — Horizontally Scrollable Slider on Mobile */}
      <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-2xl overflow-x-auto max-w-full whitespace-nowrap scrollbar-none touch-pan-x">
        {canIssue && (
          <button
            onClick={() => setTab('issue')}
            className={`px-4 py-2.5 text-xs font-black rounded-xl transition-all shrink-0 cursor-pointer ${
              tab === 'issue' ? 'bg-white dark:bg-slate-900 text-eye-brand shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            {ar ? '+ طلب / إصدار شهادة' : '+ Request Certificate'}
          </button>
        )}
        {canApprove && (
          <button
            onClick={() => setTab('pending')}
            className={`px-4 py-2.5 text-xs font-black rounded-xl transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
              tab === 'pending' ? 'bg-amber-500 text-white shadow-sm' : 'text-amber-600 dark:text-amber-400 font-bold hover:bg-amber-500/10'
            }`}
          >
            <span>{ar ? 'طلبات بانتظار الموافقة' : 'Pending Approvals'}</span>
            <span className="px-1.5 py-0.5 rounded-full bg-amber-600 text-white text-[10px] font-black">
              {db.getCertificates().filter(c => c.status === 'pending').length}
            </span>
          </button>
        )}
        {canIssue && (
          <button
            onClick={() => setTab('all')}
            className={`px-4 py-2.5 text-xs font-black rounded-xl transition-all shrink-0 cursor-pointer ${
              tab === 'all' ? 'bg-white dark:bg-slate-900 text-eye-brand shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            {ar ? `إدارة جميع الشهادات (${db.getCertificates().length})` : `All Certificates (${db.getCertificates().length})`}
          </button>
        )}
        <button
          onClick={() => setTab('my')}
          className={`px-4 py-2.5 text-xs font-black rounded-xl transition-all shrink-0 cursor-pointer ${
            tab === 'my' ? 'bg-white dark:bg-slate-900 text-eye-brand shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          {ar ? `شهاداتي (${myCerts.length})` : `My Certificates (${myCerts.length})`}
        </button>
      </div>

      {/* Issue Form */}
      {tab === 'issue' && canIssue && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 p-6 space-y-4">
            <h3 className="text-sm font-black text-slate-800 dark:text-white">{ar ? 'بيانات الشهادة' : 'Certificate Details'}</h3>

            {error && <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-xs font-bold text-red-600">{error}</div>}
            {issueSuccess && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-xs font-bold text-emerald-700 flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                {ar ? `تم إصدار الشهادة لـ ${issueSuccess.recipientName} بنجاح!` : `Certificate issued to ${issueSuccess.recipientName}!`}
              </div>
            )}

            {/* Mode Switch: Single vs Bulk vs Sheet */}
            <div className="grid grid-cols-3 gap-1.5 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl">
              <button
                type="button"
                onClick={() => { setIssueMode('single'); setSelectedRecipients([]); }}
                className={`py-2 px-1 text-center text-xs font-black rounded-xl transition-all cursor-pointer ${issueMode === 'single'
                    ? 'bg-white dark:bg-slate-900 text-eye-brand shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
              >
                {ar ? '👤 إصدار فردي' : '👤 Single Issue'}
              </button>
              <button
                type="button"
                onClick={() => { setIssueMode('bulk'); setSelectedRecipient(''); }}
                className={`py-2 px-1 text-center text-xs font-black rounded-xl transition-all cursor-pointer ${issueMode === 'bulk'
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
              >
                {ar ? '👥 إصدار جماعي' : '👥 Bulk Issue'}
              </button>
              <button
                type="button"
                onClick={() => { setIssueMode('sheet'); setSelectedRecipient(''); setSelectedRecipients([]); }}
                className={`py-2 px-1 text-center text-xs font-black rounded-xl transition-all cursor-pointer ${issueMode === 'sheet'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
              >
                {ar ? '📊 استيراد شيت' : '📊 Import Sheet'}
              </button>
            </div>

            {bulkCountSuccess && (
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border-2 border-emerald-300 dark:border-emerald-700 text-xs font-black text-emerald-800 dark:text-emerald-200 space-y-2.5">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span>{ar ? `🎉 تم إصدار وإرسال ${bulkCountSuccess} شهادة معتمدة بنجاح لجميع الأشخاص المحددين!` : `🎉 Successfully issued ${bulkCountSuccess} certificates!`}</span>
                </div>
                {bulkSkippedCount > 0 && (
                  <div className="text-[11px] text-amber-700 dark:text-amber-300 font-bold bg-amber-100/50 dark:bg-amber-950/40 p-2 rounded-xl border border-amber-300">
                    {ar ? `⚠️ تم تخطي (${bulkSkippedCount}) شهادة مكررة استلم أصحابها نفس الشهادة مسبقاً لحمايتهم من التكرار.` : `⚠️ Skipped ${bulkSkippedCount} duplicate certificates.`}
                  </div>
                )}
                {lastBulkIssuedCerts.length > 0 && canApprove && (
                  <button
                    type="button"
                    onClick={() => handleDownloadBatchPdf(lastBulkIssuedCerts, `شهادات_الدفعة_${new Date().toISOString().slice(0, 10)}.pdf`)}
                    disabled={isGeneratingPdf}
                    className="w-full py-2.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <FileText className="w-4 h-4" />
                    <span>{ar ? `📥 تنزيل جميع شهادات هذه الدفعة في ملف PDF واحد (${lastBulkIssuedCerts.length} شهادة)` : `📥 Download All ${lastBulkIssuedCerts.length} Certificates in Single PDF`}</span>
                  </button>
                )}
              </div>
            )}

            {/* Certificate Language Selector */}
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                {ar ? 'لغة الشهادة' : 'Certificate Language'}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setCertLang('ar')}
                  className={`py-2 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${certLang === 'ar'
                      ? 'bg-amber-500/10 border-amber-500 text-amber-700 dark:text-amber-300'
                      : 'border-slate-200 dark:border-slate-700 text-slate-500'
                    }`}
                >
                  <span>🇸🇦 العربية (Arabic)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCertLang('en')}
                  className={`py-2 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${certLang === 'en'
                      ? 'bg-amber-500/10 border-amber-500 text-amber-700 dark:text-amber-300'
                      : 'border-slate-200 dark:border-slate-700 text-slate-500'
                    }`}
                >
                  <span>🇬🇧 English (الإنجليزية)</span>
                </button>
              </div>
            </div>

            {/* 24-Hour Temporary Workshop Certificates Showcase Banner & Quick Selectors */}
            {isWorkshopActive && (
              <div className="relative overflow-hidden rounded-2xl p-3.5 sm:p-4 bg-gradient-to-br from-amber-500/10 via-blue-500/5 to-indigo-500/10 border-2 border-amber-400/60 dark:border-amber-500/40 shadow-lg space-y-3">
                {/* Glow decor */}
                <div className="absolute top-0 end-0 -mt-6 -me-6 w-24 h-24 bg-amber-400/20 rounded-full blur-2xl pointer-events-none" />

                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-300/40 dark:border-amber-500/30 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center justify-center w-7 h-7 rounded-xl bg-amber-500 text-white shadow-sm font-black text-xs">
                      ⚡
                    </span>
                    <div>
                      <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                        <span>{ar ? 'نماذج ورش العمل المعتمدة مؤقتاً' : 'Exclusive Workshop Certificate Templates'}</span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-400/40">
                          {ar ? 'متاحة 24 ساعة فقط ⏳' : '24h Limited Edition ⏳'}
                        </span>
                      </h4>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">
                        {ar
                          ? 'اضغط على أي نموذج لتطبيقه وتوليد نصه بالإنجليزية مع دمج اسم العضو المختار تلقائياً'
                          : 'Click any template to auto-populate English content with dynamic member name'}
                      </p>
                    </div>
                  </div>

                  {/* Live Countdown Timer */}
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 text-amber-400 font-mono text-xs font-black shadow-inner border border-amber-500/30 ms-auto">
                    <Clock className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                    <span>{ar ? 'متبقي:' : 'Left:'} {workshopRemaining.formattedCountdown}</span>
                  </div>
                </div>

                {/* The 3 Workshop Certificate Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {WORKSHOP_CERT_TEMPLATES.map(tpl => {
                    const isSelected = certType === tpl.id;
                    return (
                      <div
                        key={tpl.id}
                        onClick={() => handleApplyWorkshopTemplate(tpl)}
                        className={`cursor-pointer group relative rounded-xl p-3 border-2 transition-all flex flex-col justify-between gap-2 bg-white dark:bg-slate-900 ${
                          isSelected
                            ? 'border-eye-brand ring-2 ring-eye-brand/30 shadow-md scale-[1.01]'
                            : 'border-slate-200 dark:border-slate-800 hover:border-amber-400 hover:shadow-xs'
                        }`}
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-xl">{tpl.icon}</span>
                            <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-sans">
                              {tpl.badgeAr}
                            </span>
                          </div>
                          <div>
                            <p className="text-xs font-black text-slate-900 dark:text-white group-hover:text-eye-brand transition-colors leading-tight">
                              {tpl.number}. {tpl.labelAr}
                            </p>
                            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 font-mono mt-0.5 truncate">
                              {tpl.title}
                            </p>
                          </div>
                          <p className="text-[10px] text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed bg-slate-50 dark:bg-slate-800/60 p-1.5 rounded-lg border border-slate-200/50 dark:border-slate-700/50">
                            {tpl.descriptionAr}
                          </p>
                        </div>

                        <div className="pt-1 flex items-center justify-between text-[11px] font-black">
                          <button
                            type="button"
                            className={`w-full py-1.5 px-2 rounded-lg text-center font-bold text-[10px] transition-all flex items-center justify-center gap-1 ${
                              isSelected
                                ? 'bg-eye-brand text-white shadow-xs'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 group-hover:bg-amber-500 group-hover:text-white'
                            }`}
                          >
                            {isSelected ? (ar ? '✓ النموذج المختار' : '✓ Selected') : (ar ? 'تطبيق النموذج ⚡' : 'Apply Template ⚡')}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Recipient Search & Selector */}
            {(() => {
              // Sheet Import Mode View
              if (issueMode === 'sheet') {
                const selectedCount = sheetRecipients.filter(r => r.selected).length;
                const matchedCount = sheetRecipients.filter(r => r.status === 'matched').length;
                const unmatchedCount = sheetRecipients.filter(r => r.status === 'unmatched').length;
                const activeTitle = (WORKSHOP_CERT_TEMPLATES.find(t => t.id === certType)?.title) || (certType === 'custom' ? customTitle : (certLang === 'en' ? selectedDef?.label : selectedDef?.labelAr));

                const duplicateCount = sheetRecipients.filter(r => {
                  return db.findDuplicateCertificate({
                    recipientId: r.matchedUser?.id,
                    recipientName: r.name,
                    certType,
                    title: r.customTitle || activeTitle,
                  });
                }).length;

                const filteredSheetList = sheetRecipients.filter(r => {
                  if (sheetFilter === 'matched' && r.status !== 'matched') return false;
                  if (sheetFilter === 'unmatched' && r.status !== 'unmatched') return false;
                  if (sheetSearch.trim()) {
                    const q = sheetSearch.toLowerCase().trim();
                    const matchName = r.name.toLowerCase().includes(q);
                    const matchCode = r.code?.toLowerCase().includes(q);
                    const matchEmail = r.email?.toLowerCase().includes(q);
                    const matchComm = r.committee?.toLowerCase().includes(q);
                    if (!matchName && !matchCode && !matchEmail && !matchComm) return false;
                  }
                  return true;
                });

                return (
                  <div className="space-y-3">
                    {/* Hidden file input */}
                    <input
                      type="file"
                      ref={sheetFileInputRef}
                      accept=".xlsx,.xls,.csv"
                      className="hidden"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) parseSheetFile(file);
                        e.target.value = '';
                      }}
                    />

                    {sheetRecipients.length === 0 ? (
                      <div
                        onDragOver={e => { e.preventDefault(); setIsDraggingSheet(true); }}
                        onDragLeave={() => setIsDraggingSheet(false)}
                        onDrop={e => {
                          e.preventDefault();
                          setIsDraggingSheet(false);
                          const file = e.dataTransfer.files?.[0];
                          if (file) parseSheetFile(file);
                        }}
                        className={`border-2 border-dashed rounded-3xl p-6 sm:p-8 text-center transition-all flex flex-col items-center justify-center gap-3 ${
                          isDraggingSheet
                            ? 'border-emerald-500 bg-emerald-500/10 scale-[1.01]'
                            : 'border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 hover:border-emerald-500 hover:bg-emerald-50/20'
                        }`}
                      >
                        <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-inner">
                          <FileSpreadsheet className="w-8 h-8 animate-pulse" />
                        </div>

                        <div className="space-y-1 max-w-md">
                          <h4 className="text-sm font-black text-slate-800 dark:text-white">
                            {ar ? 'ارفع شيت الإكسيل أو CSV للشهادات' : 'Upload Certificates Sheet (Excel / CSV)'}
                          </h4>
                          <p className="text-[11px] text-slate-500 leading-relaxed font-semibold">
                            {ar
                              ? 'اسحب الملف وأفلته هنا أو اضغط للاختيار. يقوم النظام تلقائياً بالتعرف على أسماء المكرمين ومطابقتهم بالكود أو الاسم أو الإيميل مع بيانات المنصة!'
                              : 'Drag & drop or browse sheet file. The system automatically matches recipients with platform members!'}
                          </p>
                        </div>

                        {isParsingSheet ? (
                          <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-4 py-2 rounded-xl border border-emerald-300">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>{ar ? 'جاري فحص ومطابقة بيانات الشيت مع قاعدة البيانات...' : 'Inspecting & matching sheet data...'}</span>
                          </div>
                        ) : (
                          <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
                            <button
                              type="button"
                              onClick={() => sheetFileInputRef.current?.click()}
                              className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
                            >
                              <Upload className="w-4 h-4" />
                              <span>{ar ? 'اختيار ملف إكسيل / CSV' : 'Browse Excel / CSV'}</span>
                            </button>

                            <button
                              type="button"
                              onClick={downloadSampleCertificatesSheet}
                              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl border border-slate-200 dark:border-slate-700 transition-all flex items-center gap-2 cursor-pointer"
                            >
                              <Download className="w-4 h-4 text-slate-500" />
                              <span>{ar ? '📥 تحميل نموذج الشيت (CSV Template)' : '📥 Download Sample Template'}</span>
                            </button>
                          </div>
                        )}

                        {sheetParseError && (
                          <div className="w-full mt-2 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-bold flex items-center justify-between gap-2">
                            <span>⚠️ {sheetParseError}</span>
                            <button
                              type="button"
                              onClick={() => setSheetParseError('')}
                              className="text-red-500 hover:text-red-800"
                            >
                              ✕
                            </button>
                          </div>
                        )}

                        <div className="text-[10px] text-slate-400 font-medium pt-1">
                          {ar
                            ? '💡 الأعمدة المقترحة: اسم العضو، كود العضو، البريد الإلكتروني، اللجنة، الدرجة (اختياري)'
                            : '💡 Recognized columns: Name, Code, Email, Committee, Grade (optional)'}
                        </div>
                      </div>
                    ) : (
                      /* Sheet Loaded View */
                      <div className="space-y-3">
                        {/* Header Card with File info & stats */}
                        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-blue-500/10 border border-emerald-400/50 space-y-2.5 shadow-xs">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                                <FileSpreadsheet className="w-4 h-4" />
                              </div>
                              <div className="min-w-0">
                                <h4 className="text-xs font-black text-slate-900 dark:text-white truncate" title={sheetFileName}>
                                  {sheetFileName}
                                </h4>
                                <p className="text-[10px] text-slate-500">
                                  {ar ? `تم استخراج ${sheetRecipients.length} شخص من الشيت` : `${sheetRecipients.length} recipients parsed`}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 ms-auto">
                              <button
                                type="button"
                                onClick={() => sheetFileInputRef.current?.click()}
                                className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-[11px] font-bold border border-slate-200 dark:border-slate-700 hover:border-emerald-500 shadow-2xs transition-all flex items-center gap-1 cursor-pointer"
                              >
                                <RefreshCw className="w-3 h-3 text-emerald-600" />
                                <span>{ar ? 'استبدال الشيت' : 'Replace'}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setSheetRecipients([]);
                                  setSheetFileName('');
                                }}
                                className="px-2.5 py-1.5 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-600 text-[11px] font-bold border border-red-200 dark:border-red-900/50 hover:bg-red-100 shadow-2xs transition-all flex items-center gap-1 cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>{ar ? 'مسح' : 'Clear'}</span>
                              </button>
                            </div>
                          </div>

                          {/* Quick Badges Counter */}
                          <div className="flex flex-wrap items-center gap-1.5 pt-1">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 text-[10px] font-bold border border-slate-200 dark:border-slate-800">
                              <span>👥 الإجمالي:</span>
                              <strong className="text-slate-900 dark:text-white">{sheetRecipients.length}</strong>
                            </span>

                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold border border-emerald-300 dark:border-emerald-800">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>أعضاء بالمنصة:</span>
                              <strong>{matchedCount}</strong>
                            </span>

                            {unmatchedCount > 0 && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-[10px] font-bold border border-blue-300 dark:border-blue-800">
                                <span>🌐 خارجي / غير مسجل:</span>
                                <strong>{unmatchedCount}</strong>
                              </span>
                            )}

                            {duplicateCount > 0 && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 text-[10px] font-bold border border-amber-300 dark:border-amber-800">
                                <span>⚠️ مستلم مسبقاً:</span>
                                <strong>{duplicateCount}</strong>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Search + Filter Tabs */}
                        <div className="flex flex-col sm:flex-row gap-2">
                          <div className="relative flex-1">
                            <input
                              type="text"
                              value={sheetSearch}
                              onChange={e => setSheetSearch(e.target.value)}
                              placeholder={ar ? '🔍 بحث في أسماء أو أكواد أو إيميلات الشيت...' : 'Search sheet recipients...'}
                              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 font-bold focus:outline-none focus:border-emerald-500"
                            />
                          </div>

                          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                            <button
                              type="button"
                              onClick={() => setSheetFilter('all')}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                                sheetFilter === 'all'
                                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                                  : 'text-slate-500 hover:text-slate-900'
                              }`}
                            >
                              {ar ? `الكل (${sheetRecipients.length})` : `All (${sheetRecipients.length})`}
                            </button>
                            <button
                              type="button"
                              onClick={() => setSheetFilter('matched')}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                                sheetFilter === 'matched'
                                  ? 'bg-emerald-600 text-white shadow-2xs'
                                  : 'text-slate-500 hover:text-slate-900'
                              }`}
                            >
                              {ar ? `مسجلين (${matchedCount})` : `Matched (${matchedCount})`}
                            </button>
                            {unmatchedCount > 0 && (
                              <button
                                type="button"
                                onClick={() => setSheetFilter('unmatched')}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                                  sheetFilter === 'unmatched'
                                    ? 'bg-blue-600 text-white shadow-2xs'
                                    : 'text-slate-500 hover:text-slate-900'
                                }`}
                              >
                                {ar ? `خارجي (${unmatchedCount})` : `External (${unmatchedCount})`}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Selection Actions Bar */}
                        <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold">
                          <span className="text-slate-600 dark:text-slate-300">
                            {ar ? `تم تحديد (${selectedCount}) من (${sheetRecipients.length})` : `Selected (${selectedCount}) of (${sheetRecipients.length})`}
                          </span>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setSheetRecipients(prev => prev.map(r => {
                                  const dup = db.findDuplicateCertificate({
                                    recipientId: r.matchedUser?.id,
                                    recipientName: r.name,
                                    certType,
                                    title: r.customTitle || activeTitle,
                                  });
                                  return { ...r, selected: !dup };
                                }));
                              }}
                              className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer flex items-center gap-1"
                            >
                              <span>✨ {ar ? 'تحديد غير المستلمين فقط' : 'Select Unawarded Only'}</span>
                            </button>
                            <span className="text-slate-300 dark:text-slate-600">|</span>
                            <button
                              type="button"
                              onClick={() => {
                                const filteredIds = new Set(filteredSheetList.map(r => r.id));
                                const allSelected = filteredSheetList.every(r => r.selected);
                                setSheetRecipients(prev => prev.map(r => {
                                  if (filteredIds.has(r.id)) {
                                    return { ...r, selected: !allSelected };
                                  }
                                  return r;
                                }));
                              }}
                              className="text-[11px] font-black text-slate-700 dark:text-slate-300 hover:underline cursor-pointer"
                            >
                              {filteredSheetList.every(r => r.selected)
                                ? (ar ? 'إلغاء تحديد المفلتر' : 'Deselect Filtered')
                                : (ar ? 'تحديد كل المفلتر' : 'Select All Filtered')}
                            </button>
                          </div>
                        </div>

                        {/* Recipient Rows List */}
                        <div className="max-h-60 overflow-y-auto space-y-1.5 pe-1 border border-slate-200 dark:border-slate-700 rounded-2xl p-2 bg-slate-50/50 dark:bg-slate-800/40">
                          {filteredSheetList.length === 0 ? (
                            <div className="text-center py-6 text-slate-400 text-xs font-bold">
                              {ar ? 'لا يوجد أشخاص متطابقين مع البحث' : 'No recipients match search'}
                            </div>
                          ) : (
                            filteredSheetList.map(r => {
                              const isDup = db.findDuplicateCertificate({
                                recipientId: r.matchedUser?.id,
                                recipientName: r.name,
                                certType,
                                title: r.customTitle || activeTitle,
                              });

                              return (
                                <div
                                  key={r.id}
                                  onClick={() => {
                                    setSheetRecipients(prev => prev.map(item => item.id === r.id ? { ...item, selected: !item.selected } : item));
                                  }}
                                  className={`flex items-center justify-between p-2.5 rounded-xl text-xs font-bold cursor-pointer transition-all border ${
                                    r.selected
                                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-400 text-emerald-900 dark:text-emerald-200'
                                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <input
                                      type="checkbox"
                                      checked={r.selected}
                                      onChange={() => {}}
                                      className="rounded text-emerald-600 focus:ring-emerald-500 shrink-0 w-4 h-4"
                                    />
                                    <div className="min-w-0 space-y-0.5">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="truncate font-black text-slate-900 dark:text-white">{r.name}</span>
                                        {r.matchedUser ? (
                                          <span className="text-[9px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 font-black px-1.5 py-0.5 rounded-md shrink-0 border border-emerald-300 flex items-center gap-0.5">
                                            <Check className="w-2.5 h-2.5" />
                                            <span>{ar ? 'عضو مسجل' : 'Registered'}</span>
                                          </span>
                                        ) : (
                                          <span className="text-[9px] bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 font-bold px-1.5 py-0.5 rounded-md shrink-0 border border-blue-200">
                                            <span>{ar ? 'خارجي' : 'External'}</span>
                                          </span>
                                        )}

                                        {isDup && (
                                          <span className="text-[9px] bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 font-black px-1.5 py-0.5 rounded-md shrink-0 border border-amber-300">
                                            {ar ? 'مستلم مسبقاً ⚠️' : 'Received ⚠️'}
                                          </span>
                                        )}
                                      </div>

                                      <div className="flex items-center gap-2 text-[10px] text-slate-400 font-medium">
                                        {r.code && <span>كود: {r.code}</span>}
                                        {r.email && <span>• {r.email}</span>}
                                        {r.committee && <span>• {r.committee}</span>}
                                        {r.grade !== undefined && <span>• درجة: {r.grade}</span>}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="text-[10px] text-end text-slate-400 font-medium shrink-0 ps-2">
                                    {r.matchedUser?.role || r.role}
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>

                        {/* Duplicate Override Checkbox */}
                        {duplicateCount > 0 && (
                          <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 text-xs font-bold text-amber-800 dark:text-amber-200 flex items-start gap-2.5 shadow-2xs">
                            <span className="text-base leading-none">⚠️</span>
                            <div className="space-y-1 min-w-0">
                              <p className="font-black text-amber-900 dark:text-amber-100">
                                {ar ? `يوجد (${duplicateCount}) شخص في الشيت استلموا هذه الشهادة مسبقاً!` : `${duplicateCount} recipients already received this certificate!`}
                              </p>
                              <p className="text-[11px] leading-relaxed opacity-90">
                                {ar
                                  ? 'سيقوم النظام تلقائياً بتخطي المكرر وحماية العضو من استلام شهادته مرتين إلا في حالة تفعيل خيار الاستثناء أدناه.'
                                  : 'System will safely skip duplicates unless override is checked.'}
                              </p>
                              <label className="flex items-center gap-1.5 pt-1 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={allowDuplicateOverride}
                                  onChange={e => setAllowDuplicateOverride(e.target.checked)}
                                  className="rounded text-amber-600 focus:ring-amber-500 w-3.5 h-3.5"
                                />
                                <span className="text-[10px] text-amber-900 dark:text-amber-200 font-black">
                                  {ar ? 'السماح بإصدار النسخ المكررة لجميع المحددين استثنائياً' : 'Allow duplicate override exceptionally'}
                                </span>
                              </label>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              }

              // Normal Single or Bulk Recipient Selector
              const filteredMembers = users.filter(u =>
                u.fullName.toLowerCase().includes(memberSearch.toLowerCase()) ||
                u.role.toLowerCase().includes(memberSearch.toLowerCase()) ||
                (u.membershipCode && u.membershipCode.toLowerCase().includes(memberSearch.toLowerCase()))
              );

              return (
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                      {isBulkMode ? (ar ? 'اختر الأعضاء المكرمين (تحديد جماعي)' : 'Select Members (Bulk)') : (ar ? 'العضو المُكرَّم' : 'Recipient')}
                    </label>
                    <span className="text-[9px] text-slate-400 font-mono font-bold">
                      {filteredMembers.length} {ar ? 'عضو متوفر' : 'members'}
                    </span>
                  </div>

                  {/* Quick Search Input */}
                  <div className="relative">
                    <input
                      type="text"
                      value={memberSearch}
                      onChange={e => setMemberSearch(e.target.value)}
                      placeholder={ar ? '🔍 بحث باسم العضو أو كوده أو دوره...' : '🔍 Search by name, code or role...'}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 min-h-[44px] text-xs sm:text-sm text-slate-800 dark:text-slate-100 font-bold leading-normal focus:outline-none focus:border-eye-brand transition-all"
                    />
                  </div>

                  {isBulkMode ? (
                    <div className="space-y-2 border border-slate-200 dark:border-slate-700 rounded-2xl p-3 bg-slate-50/50 dark:bg-slate-800/40">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-slate-600 dark:text-slate-300 pb-2 border-b border-slate-200 dark:border-slate-700">
                        <span>{ar ? `تم تحديد (${selectedRecipients.length}) عضو` : `Selected (${selectedRecipients.length})`}</span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const activeTitle = (WORKSHOP_CERT_TEMPLATES.find(t => t.id === certType)?.title) || (certType === 'custom' ? customTitle : (certLang === 'en' ? selectedDef?.label : selectedDef?.labelAr));
                              const unawarded = filteredMembers.filter(u => !db.findDuplicateCertificate({
                                recipientId: u.id,
                                recipientName: u.fullName,
                                certType,
                                title: activeTitle,
                              })).map(u => u.id);
                              setSelectedRecipients(unawarded);
                            }}
                            className="text-xs font-black text-eye-brand hover:underline cursor-pointer flex items-center gap-1"
                          >
                            <span>✨ {ar ? 'تحديد غير المستلمين فقط' : 'Select Unawarded Only'}</span>
                          </button>
                          <span className="text-slate-300 dark:text-slate-600">|</span>
                          <button
                            type="button"
                            onClick={() => handleSelectAllFiltered(filteredMembers)}
                            className="text-xs font-black text-amber-600 hover:text-amber-700 underline cursor-pointer"
                          >
                            {filteredMembers.every(u => selectedRecipients.includes(u.id))
                              ? (ar ? 'إلغاء تحديد الكل' : 'Deselect All')
                              : (ar ? 'تحديد الكل المفلتر' : 'Select All Filtered')}
                          </button>
                        </div>
                      </div>

                      <div className="max-h-52 overflow-y-auto space-y-1.5 pe-1">
                        {filteredMembers.map(u => {
                          const isSelected = selectedRecipients.includes(u.id);
                          const activeTitle = (WORKSHOP_CERT_TEMPLATES.find(t => t.id === certType)?.title) || (certType === 'custom' ? customTitle : (certLang === 'en' ? selectedDef?.label : selectedDef?.labelAr));
                          const memberDuplicate = db.findDuplicateCertificate({
                            recipientId: u.id,
                            recipientName: u.fullName,
                            certType,
                            title: activeTitle,
                          });

                          return (
                            <div
                              key={u.id}
                              onClick={() => handleToggleSelectMember(u.id)}
                              className={`flex items-center justify-between p-2 rounded-xl text-xs font-bold cursor-pointer transition-all border ${isSelected
                                  ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-400 text-amber-900 dark:text-amber-300'
                                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                                }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => { }}
                                  className="rounded text-amber-600 focus:ring-amber-500 shrink-0"
                                />
                                <span className="truncate">{u.fullName}</span>
                                {memberDuplicate && (
                                  <span className="text-[9px] bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 font-black px-1.5 py-0.5 rounded-md shrink-0 border border-amber-300">
                                    {ar ? 'مستلم مسبقاً ⚠️' : 'Received ⚠️'}
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-400 font-medium shrink-0">{u.role} ({u.committee})</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="relative">
                        <User className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        <select value={selectedRecipient} onChange={e => setSelectedRecipient(e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl ps-9 pe-3 py-2.5 min-h-[44px] text-xs sm:text-sm text-slate-800 dark:text-slate-100 font-bold leading-normal focus:outline-none focus:border-eye-brand transition-all">
                          <option value="">{ar ? '-- اختر عضواً --' : '-- Select Recipient --'}</option>
                          {filteredMembers.map(u => (
                            <option key={u.id} value={u.id} className="bg-slate-900 text-white py-1">{u.fullName} ({u.role} — {u.committee}) {u.membershipCode ? `[${u.membershipCode}]` : ''}</option>
                          ))}
                        </select>
                      </div>

                      {/* Single Recipient Duplicate Alert */}
                      {(() => {
                        if (!selectedRecipient) return null;
                        const activeTitle = (WORKSHOP_CERT_TEMPLATES.find(t => t.id === certType)?.title) || (certType === 'custom' ? customTitle : (certLang === 'en' ? selectedDef?.label : selectedDef?.labelAr));
                        const duplicate = db.findDuplicateCertificate({
                          recipientId: selectedRecipient,
                          certType,
                          title: activeTitle,
                        });
                        if (!duplicate) return null;
                        return (
                          <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 text-xs font-bold text-amber-800 dark:text-amber-200 flex items-start gap-2.5 shadow-xs animate-in fade-in duration-200">
                            <span className="text-base leading-none">⚠️</span>
                            <div className="space-y-1 min-w-0">
                              <p className="font-black text-amber-900 dark:text-amber-100">
                                {ar ? 'تنبيه منع التكرار: هذا العضو استلم هذه الشهادة مسبقاً!' : 'Duplicate Alert: Member already received this certificate!'}
                              </p>
                              <p className="text-[11px] leading-relaxed opacity-90">
                                {ar
                                  ? `حصل العضو على شهادة "${duplicate.title}" بتاريخ ${new Date(duplicate.issuedAt).toLocaleDateString('ar-EG')}. النظام سيمنع التكرار تلقائياً لعدم وصول نفس الشهادة مرتين.`
                                  : `Issued on ${new Date(duplicate.issuedAt).toLocaleDateString()}. Duplicate delivery is prevented.`}
                              </p>
                              <label className="flex items-center gap-1.5 pt-1 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={allowDuplicateOverride}
                                  onChange={e => setAllowDuplicateOverride(e.target.checked)}
                                  className="rounded text-amber-600 focus:ring-amber-500 w-3.5 h-3.5"
                                />
                                <span className="text-[10px] text-amber-900 dark:text-amber-200 font-black">
                                  {ar ? 'السماح بإصدار نسخة مكررة استثنائياً' : 'Allow duplicate override exceptionally'}
                                </span>
                              </label>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Cert Type */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">{ar ? 'نوع الشهادة' : 'Certificate Type'}</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {activeCertTypes.map(ct => (
                  <button key={ct.id} onClick={() => {
                    setCertType(ct.id);
                    const wTpl = WORKSHOP_CERT_TEMPLATES.find(t => t.id === ct.id);
                    if (wTpl) {
                      setCertLang('en');
                      setCustomTitle(wTpl.title);
                      const recipient = users.find(u => u.id === selectedRecipient);
                      setCustomBody(formatBodyForRecipient(wTpl.bodyTemplate, recipient?.fullName || '[Name]'));
                    }
                  }}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border-2 text-start transition-all text-xs font-bold ${certType === ct.id ? `border-eye-brand bg-blue-50 dark:bg-blue-950/20 text-eye-brand` : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'}`}>
                    <span className="text-xl">{ct.icon}</span>
                    <span>{ar ? ct.labelAr : ct.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {certType === 'custom' && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase">{ar ? 'عنوان الشهادة' : 'Certificate Title'}</label>
                  <input type="text" value={customTitle} onChange={e => setCustomTitle(e.target.value)} placeholder={ar ? 'شهادة تقدير خاصة...' : 'Special recognition...'}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-eye-brand font-semibold" />
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-500 uppercase">{ar ? 'نص الشهادة (اختياري)' : 'Certificate Body (optional)'}</label>
              <textarea value={customBody} onChange={e => setCustomBody(e.target.value)}
                rows={3} placeholder={ar ? 'اتركه فارغاً للنص الافتراضي...' : 'Leave empty for default text...'}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-eye-brand font-semibold resize-none" />
            </div>

            {/* Certificate Grade */}
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-500 uppercase">{ar ? 'الدرجة التقييمية للشهادة (0 - 100)' : 'Certificate Performance Grade (0 - 100)'}</label>
              <input type="number" min="0" max="100" value={certGrade} onChange={e => setCertGrade(e.target.value)} placeholder="90"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-eye-brand font-semibold" />
            </div>



            {issueMode === 'sheet' ? (
              <div className="space-y-2 pt-1">
                {(() => {
                  const selectedCount = sheetRecipients.filter(r => r.selected).length;
                  return (
                    <>
                      <button
                        type="button"
                        onClick={handleIssue}
                        disabled={isGeneratingPdf || selectedCount === 0}
                        className="w-full text-white font-black py-3 rounded-xl text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{
                          background: 'linear-gradient(135deg, #059669, #0d9488)',
                          boxShadow: '0 4px 15px rgba(5,150,105,0.35)'
                        }}
                      >
                        <Award className="w-4 h-4" />
                        <span>
                          {ar
                            ? (canApprove
                                ? `🚀 إصدار وإرسال الشهادات لـ (${selectedCount}) شخص من الشيت`
                                : `📤 إرسال طلبات اعتماد الشهادات لـ (${selectedCount}) شخص من الشيت`)
                            : `Issue & Send to (${selectedCount}) from Sheet`}
                        </span>
                      </button>

                      {canApprove && selectedCount > 0 && (
                        <button
                          type="button"
                          onClick={() => handleIssueSheet(true)}
                          disabled={isGeneratingPdf}
                          className="w-full text-white font-black py-3 rounded-xl text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50"
                          style={{ boxShadow: '0 4px 15px rgba(43,102,255,0.35)' }}
                        >
                          <FileText className="w-4 h-4" />
                          <span>
                            {ar
                              ? `📥 إصدار وتحميل الكل في ملف PDF واحد (${selectedCount}) 📄`
                              : `Issue & Download All as Single PDF (${selectedCount}) 📄`}
                          </span>
                        </button>
                      )}
                    </>
                  );
                })()}
              </div>
            ) : (
              <div className="space-y-2 pt-1">
                <button onClick={handleIssue}
                  disabled={isGeneratingPdf}
                  className="w-full text-white font-black py-3 rounded-xl text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                  style={{
                    background: isBulkMode ? 'linear-gradient(135deg, #d97706, #b45309)' : (canApprove ? 'linear-gradient(135deg, #2b66ff, #1b4cd3)' : 'linear-gradient(135deg, #d97706, #b45309)'),
                    boxShadow: isBulkMode ? '0 4px 15px rgba(217,119,6,0.35)' : '0 4px 15px rgba(43,102,255,0.35)'
                  }}>
                  <Award className="w-4 h-4" />
                  {isBulkMode
                    ? (ar ? (canApprove ? `إصدار وإرسال الشهادات لـ (${selectedRecipients.length}) عضو 👥` : `إرسال طلبات اعتماد الشهادات لـ (${selectedRecipients.length}) عضو 📤`) : `Issue to (${selectedRecipients.length}) Members 👥`)
                    : (ar ? (canApprove ? 'إصدار الشهادة 📜' : 'إرسال طلب اعتماد الشهادة للإدارة 📤') : 'Issue Certificate 📜')}
                </button>

                {isBulkMode && canApprove && selectedRecipients.length > 0 && (
                  <button
                    type="button"
                    onClick={handleIssueAndDownloadBulkPdf}
                    disabled={isGeneratingPdf}
                    className="w-full text-white font-black py-3 rounded-xl text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                    style={{ boxShadow: '0 4px 15px rgba(43,102,255,0.35)' }}
                  >
                    <FileText className="w-4 h-4" />
                    <span>{ar ? `إصدار وتحميل الكل في ملف PDF واحد (${selectedRecipients.length}) 📄` : `Issue & Download All as Single PDF (${selectedRecipients.length}) 📄`}</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Preview — updates live as you fill the form */}
          <div>
            <h3 className="text-sm font-black text-slate-800 dark:text-white mb-3 flex items-center gap-1.5">
              <Eye className="w-4 h-4 text-amber-500" />
              {ar ? 'معاينة مباشرة' : 'Live Preview'}
              {livePreview && !previewCert && (
                <span className="text-[10px] font-bold text-amber-500 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 rounded-full ms-1">
                  {ar ? 'مسودة' : 'Draft'}
                </span>
              )}
            </h3>
            {previewCert ? (
              <div className="space-y-3">
                <CertPreview cert={previewCert} onPrint={() => handlePrint(previewCert)} transparentLogo={transparentLogo} />
                {previewCert.status === 'pending' && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-center text-amber-800 dark:text-amber-200 text-xs font-bold">
                    ⏳ تم رفع طلب الشهادة بنجاح! الشهادة الآن بانتظار موافقة واقتران الإدارة (Super Admin) قبل تفعيل إمكانية الطباعة والتصدير.
                  </div>
                )}
              </div>
            ) : livePreview ? (
              <div className="relative">
                <div className="absolute inset-0 z-10 rounded-3xl" style={{ background: 'rgba(251,246,232,0.15)', backdropFilter: 'none', pointerEvents: 'none' }} />
                <CertPreview cert={livePreview} onPrint={() => { }} transparentLogo={transparentLogo} />
                
                {!canApprove && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-center text-amber-800 dark:text-amber-300 text-xs font-bold mt-2">
                    ⚠️ بصفتك ليدر، عند الضغط على "إرسال طلب اعتماد الشهادة للإدارة"، سيتلقى رئيس الكيان/الإدارة طلباً لمعاينتها واعتتمادها أولاً.
                  </div>
                )}

                <p className="text-center text-[10px] text-slate-400 mt-2 font-bold">
                  {ar ? '👁 معاينة مسودة قبل إرسال الطلب' : '👁 Draft preview'}
                </p>

                {/* Immediate Action Buttons: Preview */}
                <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
                  <button
                    type="button"
                    onClick={() => setFullScreenModalCert(livePreview)}
                    className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-black rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Eye className="w-4 h-4" />
                    <span>{ar ? '👁️ تكبير ومعاينة قبل الإرسال' : '👁️ Preview Fullscreen'}</span>
                  </button>

                  {canApprove && (
                    <>
                      <button
                        type="button"
                        onClick={() => downloadCertificate(toCertGeneratorData(livePreview))}
                        className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        <Download className="w-4 h-4" />
                        <span>{ar ? '📥 تحميل (PNG)' : '📥 Download'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => printCertificate(toCertGeneratorData(livePreview))}
                        className="px-3.5 py-2 bg-slate-900 hover:bg-slate-950 text-white text-xs font-black rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        <span>{ar ? '🖨️ طباعة' : '🖨️ Print'}</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-3xl h-64 flex flex-col items-center justify-center text-slate-400 gap-2">
                <Eye className="w-8 h-8 opacity-30" />
                <p className="text-xs font-bold">{ar ? 'اختر عضواً لرؤية المعاينة' : 'Select a member to preview'}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pending Approvals Tab (Admin & HRM View) */}
      {tab === 'pending' && canApprove && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-amber-200 dark:border-amber-900/40 p-6 space-y-4 shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span>{ar ? 'طلبات اعتماد الشهادات بانتظار الموافقة' : 'Pending Certificate Approval Requests'}</span>
                <span className="text-xs text-white font-black bg-amber-500 px-3 py-0.5 rounded-full">
                  {db.getCertificates().filter(c => c.status === 'pending').length}
                </span>
              </h3>
            </div>

            {db.getCertificates().filter(c => c.status === 'pending').length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <Award className="w-12 h-12 mx-auto mb-2 opacity-30 text-amber-500" />
                <p className="text-xs font-bold">{ar ? 'لا توجد طلبات شهادات بانتظار الموافقة حالياً 🎉' : 'No pending approval requests'}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {db.getCertificates()
                  .filter(c => c.status === 'pending')
                  .map(cert => {
                    const def = CERT_TYPES.find(ct => ct.id === cert.certType);
                    return (
                      <div key={cert.id} className="bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl bg-gradient-to-br ${def?.color || 'from-amber-400 to-orange-500'} text-white shrink-0 shadow-md`}>
                            {def?.icon || '📜'}
                          </div>
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-black text-slate-900 dark:text-white text-sm truncate">{cert.recipientName}</p>
                              <span className="bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[10px] font-black px-2 py-0.5 rounded-full">
                                {ar ? '⏳ بانتظار موافقتك' : 'Pending'}
                              </span>
                            </div>
                            <p className="text-xs font-bold text-amber-900 dark:text-amber-200">{cert.title} • {cert.committee || 'عام'}</p>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400">
                              {ar ? 'مرفوع بواسطة الليدر' : 'Requested by'}: <strong>{cert.issuedByName}</strong> ({cert.issuedByTitle}) • {new Date(cert.issuedAt).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}
                            </p>
                            {cert.body && (
                              <p className="text-[11px] text-slate-600 dark:text-slate-300 italic line-clamp-2 bg-white/60 dark:bg-slate-900/60 p-2 rounded-xl border border-amber-200/50 mt-1">
                                "{cert.body}"
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 shrink-0 self-end sm:self-center">
                          <button
                            onClick={() => setFullScreenModalCert(cert)}
                            className="px-3 py-2 text-xs font-bold text-slate-700 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5 text-amber-500" />
                            <span>{ar ? 'معاينة' : 'Preview'}</span>
                          </button>
                          <button
                            onClick={async () => {
                              await db.approveCertificate(cert.id, currentUser);
                              setEmailToast(true);
                              setTimeout(() => setEmailToast(false), 4000);
                            }}
                            className="px-4 py-2 text-xs font-black text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                          >
                            <CheckCircle className="w-4 h-4" />
                            <span>{ar ? 'اعتماد وموافقة ✅' : 'Approve ✅'}</span>
                          </button>
                          <button
                            onClick={async () => {
                              const reason = window.prompt(ar ? 'يرجى كتابة سبب رفض طلب الشهادة (اختياري):' : 'Enter rejection reason (optional):');
                              if (reason !== null) {
                                await db.rejectCertificate(cert.id, currentUser, reason);
                              }
                            }}
                            className="px-3 py-2 text-xs font-bold text-red-600 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 rounded-xl transition-all cursor-pointer"
                          >
                            <span>{ar ? 'رفض الطلب ❌' : 'Reject ❌'}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Manage All Issued Certificates (Admin & Leader Access) */}
      {tab === 'all' && canIssue && (
        <div className="space-y-4">
          {bulkDeleteSuccessMsg && (
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border-2 border-emerald-300 dark:border-emerald-700 text-xs font-black text-emerald-800 dark:text-emerald-200 flex items-center gap-2 animate-in fade-in duration-300">
              <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{bulkDeleteSuccessMsg}</span>
            </div>
          )}

          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span>{ar ? 'جميع الشهادات الصادرة بالنظام' : 'All System Issued Certificates'}</span>
                <span className="text-xs text-amber-600 font-bold bg-amber-50 dark:bg-amber-950/30 px-3 py-0.5 rounded-full">
                  {db.getCertificates().length} {ar ? 'شهادة' : 'Certs'}
                </span>
              </h3>

              {/* Quick Search Box for Issued Certificates */}
              <div className="relative min-w-[240px]">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={issuedSearchQuery}
                  onChange={(e) => setIssuedSearchQuery(e.target.value)}
                  placeholder={ar ? '🔍 بحث باسم العضو أو عنوان الشهادة...' : '🔍 Search member or cert title...'}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl ps-9 pe-3 py-1.5 text-xs text-slate-800 dark:text-slate-100 font-bold focus:outline-none focus:border-eye-brand"
                />
              </div>
            </div>

            {(() => {
              const allSystemCerts = db.getCertificates();
              const filteredCerts = allSystemCerts.filter(c =>
                c.recipientName.toLowerCase().includes(issuedSearchQuery.toLowerCase()) ||
                c.title.toLowerCase().includes(issuedSearchQuery.toLowerCase()) ||
                c.issuedByName.toLowerCase().includes(issuedSearchQuery.toLowerCase()) ||
                (c.committee && c.committee.toLowerCase().includes(issuedSearchQuery.toLowerCase()))
              );

              const allFilteredIds = filteredCerts.map(c => c.id);
              const isAllSelected = allFilteredIds.length > 0 && allFilteredIds.every(id => selectedCertIds.includes(id));
              const pendingCerts = filteredCerts.filter(c => c.status === 'pending');
              const approvedCerts = filteredCerts.filter(c => c.status !== 'pending' && c.status !== 'rejected');

              return (
                <>
                  {/* Bulk Selection & Action Toolbar */}
                  {filteredCerts.length > 0 && (
                    <div className="space-y-3 bg-gradient-to-r from-blue-50/70 via-indigo-50/70 to-slate-50 dark:from-slate-800 dark:to-slate-800/80 p-3.5 rounded-2xl border border-blue-200/80 dark:border-slate-700 shadow-xs">
                      {/* Row 1: Selection Controls & Quick Count */}
                      <div className="flex flex-wrap items-center justify-between gap-2.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {/* Toggle Select All */}
                          <button
                            type="button"
                            onClick={() => {
                              if (isAllSelected) {
                                setSelectedCertIds(prev => prev.filter(id => !allFilteredIds.includes(id)));
                              } else {
                                setSelectedCertIds(prev => Array.from(new Set([...prev, ...allFilteredIds])));
                              }
                            }}
                            className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-black rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                          >
                            {isAllSelected ? (
                              <>
                                <CheckSquare className="w-3.5 h-3.5 text-eye-brand" />
                                <span>{ar ? 'إلغاء تحديد الكل' : 'Deselect All'}</span>
                              </>
                            ) : (
                              <>
                                <Square className="w-3.5 h-3.5 text-slate-400" />
                                <span>{ar ? `تحديد الكل (${filteredCerts.length})` : `Select All (${filteredCerts.length})`}</span>
                              </>
                            )}
                          </button>

                          {/* Quick Count Selection Pills */}
                          <div className="flex items-center gap-1 bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-xl p-1">
                            <span className="text-[10px] font-bold text-slate-400 px-1">{ar ? 'عدد:' : 'Count:'}</span>
                            {[5, 10, 25, 50].map(count => {
                              if (filteredCerts.length < count && count !== 5) return null;
                              return (
                                <button
                                  key={count}
                                  type="button"
                                  onClick={() => {
                                    const subset = allFilteredIds.slice(0, count);
                                    setSelectedCertIds(subset);
                                  }}
                                  className={`px-2 py-0.5 text-[10px] font-black rounded-lg transition-all cursor-pointer ${
                                    selectedCertIds.length === count
                                      ? 'bg-eye-brand text-white'
                                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                                  }`}
                                >
                                  {count}
                                </button>
                              );
                            })}
                          </div>

                          {/* Custom Count Input */}
                          <div className="flex items-center gap-1 bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-0.5">
                            <input
                              type="number"
                              min="1"
                              max={filteredCerts.length}
                              value={customSelectCount}
                              onChange={(e) => setCustomSelectCount(e.target.value)}
                              placeholder={ar ? 'عدد مخصص' : 'Custom'}
                              className="w-16 bg-transparent text-xs text-slate-800 dark:text-slate-200 font-bold focus:outline-none text-center"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const n = parseInt(customSelectCount);
                                if (!isNaN(n) && n > 0) {
                                  const subset = allFilteredIds.slice(0, Math.min(n, allFilteredIds.length));
                                  setSelectedCertIds(subset);
                                }
                              }}
                              className="text-[10px] font-black text-eye-brand hover:underline cursor-pointer"
                            >
                              {ar ? 'تحديد' : 'Select'}
                            </button>
                          </div>

                          {/* Filter by Status Quick Select */}
                          {pendingCerts.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setSelectedCertIds(pendingCerts.map(c => c.id))}
                              className="px-2 py-1 bg-amber-500/15 border border-amber-400/40 text-amber-800 dark:text-amber-300 text-[10px] font-black rounded-xl hover:bg-amber-500/25 transition-all cursor-pointer"
                            >
                              {ar ? `المعلقة (${pendingCerts.length})` : `Pending (${pendingCerts.length})`}
                            </button>
                          )}
                          {approvedCerts.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setSelectedCertIds(approvedCerts.map(c => c.id))}
                              className="px-2 py-1 bg-emerald-500/15 border border-emerald-400/40 text-emerald-800 dark:text-emerald-300 text-[10px] font-black rounded-xl hover:bg-emerald-500/25 transition-all cursor-pointer"
                            >
                              {ar ? `المعتمدة (${approvedCerts.length})` : `Approved (${approvedCerts.length})`}
                            </button>
                          )}
                        </div>

                        {selectedCertIds.length > 0 && (
                          <span className="text-xs font-black text-eye-brand dark:text-blue-300 bg-blue-100 dark:bg-blue-950/70 border border-blue-200 dark:border-blue-800 px-3 py-1 rounded-xl">
                            {ar ? `المحدد: ${selectedCertIds.length} من أصل ${filteredCerts.length}` : `Selected: ${selectedCertIds.length} of ${filteredCerts.length}`}
                          </span>
                        )}
                      </div>

                      {/* Row 2: Action Buttons */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-blue-200/50 dark:border-slate-700/60">
                        {/* BULK DELETE BUTTON (RED) */}
                        {selectedCertIds.length > 0 ? (
                          <button
                            type="button"
                            onClick={() => setShowBulkDeleteModal(true)}
                            className="px-4 py-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white text-xs font-black rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer animate-in fade-in"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span>
                              {ar
                                ? `مسح الشهادات المحددة من كل شيء (${selectedCertIds.length}) 🗑️`
                                : `Purge Selected from Everything (${selectedCertIds.length})`}
                            </span>
                          </button>
                        ) : (
                          <div className="text-[11px] text-slate-500 font-bold italic">
                            {ar ? '💡 حدد شهادة واحدة أو أكثر لتفعيل خيارات المسح الجماعي والتصدير' : 'Select certs to enable bulk actions'}
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-2 ms-auto">
                          {/* Download Selected as Single Multi-Page PDF */}
                          {selectedCertIds.length > 0 && (
                            <button
                              type="button"
                              disabled={isGeneratingPdf}
                              onClick={() => {
                                const certsToDl = db.getCertificates().filter(c => selectedCertIds.includes(c.id));
                                handleDownloadBatchPdf(certsToDl, `شهادات_محددة_${new Date().toISOString().slice(0, 10)}.pdf`);
                              }}
                              className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-black rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
                            >
                              <FileText className="w-4 h-4" />
                              <span>{ar ? `تنزيل المحددة PDF (${selectedCertIds.length})` : `Download Selected PDF (${selectedCertIds.length})`}</span>
                            </button>
                          )}

                          {/* Download ALL Filtered as 1 Multi-Page PDF */}
                          <button
                            type="button"
                            disabled={isGeneratingPdf || filteredCerts.length === 0}
                            onClick={() => {
                              handleDownloadBatchPdf(filteredCerts, `جميع_شهادات_الكيان_${new Date().toISOString().slice(0, 10)}.pdf`);
                            }}
                            className="px-3.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-black rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
                          >
                            <FileText className="w-4 h-4" />
                            <span>{ar ? `تنزيل الكل PDF واحد (${filteredCerts.length})` : `Download All PDF (${filteredCerts.length})`}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {filteredCerts.length === 0 ? (
                    <div className="text-center py-12 text-slate-400">
                      <Award className="w-12 h-12 mx-auto mb-2 opacity-30" />
                      <p className="text-xs font-bold">{ar ? 'لا توجد شهادات مطابقة للبحث' : 'No matching certificates'}</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3">
                      {filteredCerts.map(cert => {
                        const def = CERT_TYPES.find(c => c.id === cert.certType);
                        const isPending = cert.status === 'pending';
                        const isRejected = cert.status === 'rejected';
                        const isSelected = selectedCertIds.includes(cert.id);

                        return (
                          <div
                            key={cert.id}
                            className={`bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-4 flex items-center justify-between gap-4 border transition-all ${
                              isSelected ? 'border-amber-400 dark:border-amber-500 bg-amber-50/40 dark:bg-amber-950/20 shadow-xs ring-1 ring-amber-400/50' : 'border-slate-200/60 dark:border-slate-700'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {
                                  setSelectedCertIds(prev =>
                                    prev.includes(cert.id) ? prev.filter(id => id !== cert.id) : [...prev, cert.id]
                                  );
                                }}
                                className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer shrink-0"
                              />

                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl bg-gradient-to-br ${def?.color || 'from-amber-400 to-orange-500'} text-white shrink-0 shadow-xs`}>
                                {def?.icon || '📜'}
                              </div>

                              <div className="min-w-0 space-y-0.5">
                                <div className="flex items-center gap-2">
                                  <p className="font-black text-slate-900 dark:text-white text-xs truncate">{cert.recipientName}</p>
                                  {isPending && (
                                    <span className="bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 text-[9px] font-black px-2 py-0.5 rounded-full border border-amber-300">
                                      ⏳ بانتظار موافقة الإدارة
                                    </span>
                                  )}
                                  {isRejected && (
                                    <span className="bg-red-100 text-red-800 text-[9px] font-black px-2 py-0.5 rounded-full border border-red-300">
                                      ❌ مرفوضة
                                    </span>
                                  )}
                                  {!isPending && !isRejected && (
                                    <span className="bg-emerald-100 text-emerald-800 text-[9px] font-black px-2 py-0.5 rounded-full border border-emerald-300">
                                      ✅ معتمدة رسمياً
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] text-slate-500 truncate">{cert.title} • {cert.committee || 'عام'}</p>
                                <p className="text-[9px] text-slate-400">
                                  {ar ? 'صادرة بواسطة' : 'By'}: {cert.issuedByName} ({new Date(cert.issuedAt).toLocaleDateString('ar-EG')})
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {/* PDF Download Button */}
                              <button
                                onClick={() => handleDownloadPdf(cert)}
                                disabled={isPending && !canApprove}
                                className={`px-2.5 py-1.5 text-[11px] font-black rounded-xl transition-all flex items-center gap-1 ${
                                  isPending && !canApprove
                                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                    : 'text-blue-700 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/50 cursor-pointer'
                                }`}
                                title={isPending && !canApprove ? (ar ? 'الشهادة بانتظار موافقة الإدارة' : 'Pending Approval') : (ar ? 'تحميل كـ PDF' : 'Download PDF')}
                              >
                                <FileText className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">PDF</span>
                              </button>

                              {/* PNG Download Button */}
                              <button
                                onClick={() => handleDownload(cert)}
                                disabled={isPending && !canApprove}
                                className={`px-2.5 py-1.5 text-[11px] font-black rounded-xl transition-all flex items-center gap-1 ${
                                  isPending && !canApprove
                                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                    : 'text-amber-700 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/50 cursor-pointer'
                                }`}
                                title={isPending && !canApprove ? (ar ? 'الشهادة بانتظار موافقة الإدارة' : 'Pending Approval') : (ar ? 'تحميل كصورة PNG' : 'Download PNG')}
                              >
                                <Download className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">PNG</span>
                              </button>

                              {/* PURGE FROM EVERYTHING BUTTON */}
                              <button
                                onClick={async () => {
                                  if (
                                    window.confirm(
                                      ar
                                        ? `هل أنت متأكد من مسح شهادة "${cert.recipientName}" (${cert.title}) نهائياً من قاعدة البيانات، والتخزين المحلي، والإشعارات، وكافة السجلات؟`
                                        : `Permanently purge certificate for ${cert.recipientName} from database and all records?`
                                    )
                                  ) {
                                    await db.deleteCertificate(cert.id, currentUser);
                                    setSelectedCertIds(prev => prev.filter(id => id !== cert.id));
                                  }
                                }}
                                className="p-1.5 text-xs font-bold text-red-600 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 rounded-xl transition-all cursor-pointer"
                                title={ar ? 'مسح الشهادة نهائياً من كل شيء' : 'Purge Certificate from Everything'}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* My Certificates */}
      {tab === 'my' && (
        <div className="space-y-4">
          {myCerts.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <Award className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-bold">{ar ? 'لا توجد شهادات بعد' : 'No certificates yet'}</p>
            </div>
          ) : (
            myCerts.map(cert => {
              const def = CERT_TYPES.find(c => c.id === cert.certType);
              const isPending = cert.status === 'pending';

              return (
                <div key={cert.id} className="bg-white dark:bg-slate-900 rounded-3xl border border-amber-200 dark:border-amber-900/40 p-5 flex items-start gap-4 hover:shadow-md hover:shadow-amber-100 transition-all">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl bg-gradient-to-br ${def?.color || 'from-slate-200 to-slate-300'} shrink-0`}>
                    {def?.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-black text-slate-800 dark:text-slate-100 text-sm">{cert.title}</p>
                      {isPending && (
                        <span className="bg-amber-100 text-amber-800 text-[10px] font-black px-2 py-0.5 rounded-full border border-amber-300">
                          ⏳ قيد مراجعة وموافقة الإدارة
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{ar ? 'صادرة من' : 'Issued by'}: {cert.issuedByName}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{new Date(cert.issuedAt).toLocaleDateString(ar ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                  </div>
                  <button
                    onClick={() => handleDownload(cert)}
                    disabled={isPending && !canApprove}
                    className={`flex items-center gap-1 text-xs font-bold px-3 py-2 rounded-xl transition-all shrink-0 ${isPending && !canApprove ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'text-eye-brand hover:text-eye-brand-dark bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/20 cursor-pointer'}`}
                  >
                    <Download className="w-3.5 h-3.5" />
                    {isPending && !canApprove ? (ar ? 'قيد المراجعة' : 'Pending') : (ar ? 'تحميل' : 'Download')}
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* FULLSCREEN CERTIFICATE PREVIEW MODAL */}
      {fullScreenModalCert && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-4xl w-full p-6 shadow-2xl space-y-4 text-start relative my-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-amber-500" />
                <h3 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <span>{ar ? `معاينة مكبرة للشهادة — ${fullScreenModalCert.recipientName}` : `Fullscreen Certificate Preview — ${fullScreenModalCert.recipientName}`}</span>
                  {fullScreenModalCert.status === 'pending' && (
                    <span className="bg-amber-500 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full">
                      ⏳ بانتظار موافقة الإدارة
                    </span>
                  )}
                </h3>
              </div>
              <button
                onClick={() => setFullScreenModalCert(null)}
                className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* High-res Cert Preview */}
            <div className="p-2 bg-slate-100 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-x-auto">
              <CertPreview cert={fullScreenModalCert} onPrint={() => handlePrint(fullScreenModalCert)} transparentLogo={transparentLogo} />
            </div>

            {fullScreenModalCert.status === 'pending' && !canApprove && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-center text-amber-800 dark:text-amber-200 text-xs font-bold">
                ⚠️ هذه الشهادة مرفوعة بطلب من الليدر وهي الآن قيد مراجعة وموافقة الإدارة (Super Admin). لا يمكن طباعتها أو تصديرها حتى تتم الموافقة عليها رسمياً.
              </div>
            )}

            {/* Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <span className="text-[10px] text-slate-400 font-mono">EYE Certified Verification Seal</span>
              <div className="flex flex-wrap gap-2">
                {fullScreenModalCert.status === 'pending' && canApprove && (
                  <>
                    <button
                      type="button"
                      onClick={async () => {
                        await db.approveCertificate(fullScreenModalCert.id, currentUser);
                        setFullScreenModalCert(null);
                        setEmailToast(true);
                        setTimeout(() => setEmailToast(false), 4000);
                      }}
                      className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl text-xs font-black shadow-md cursor-pointer flex items-center gap-1.5"
                    >
                      <CheckCircle className="w-4 h-4" />
                      <span>{ar ? 'اعتماد وموافقة الشهادة ✅' : 'Approve Certificate ✅'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        const reason = window.prompt(ar ? 'سبب الرفض (اختياري):' : 'Rejection reason:');
                        if (reason !== null) {
                          await db.rejectCertificate(fullScreenModalCert.id, currentUser, reason);
                          setFullScreenModalCert(null);
                        }
                      }}
                      className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                    >
                      <span>{ar ? 'رفض الطلب ❌' : 'Reject ❌'}</span>
                    </button>
                  </>
                )}

                {(!fullScreenModalCert.status || fullScreenModalCert.status === 'approved' || canApprove) && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleDownload(fullScreenModalCert)}
                      className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-md cursor-pointer flex items-center gap-1.5"
                    >
                      <Download className="w-4 h-4" />
                      <span>{ar ? 'تحميل كصورة (PNG)' : 'Download (PNG)'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePrint(fullScreenModalCert)}
                      className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl text-xs font-black shadow-md cursor-pointer flex items-center gap-1.5"
                    >
                      <span>{ar ? 'طباعة الشهادة الرسمية 🖨️' : 'Print Certificate 🖨️'}</span>
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => setFullScreenModalCert(null)}
                  className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold"
                >
                  {ar ? 'إغلاق' : 'Close'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BATCH PDF GENERATION PROGRESS MODAL */}
      {isGeneratingPdf && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl space-y-4 animate-in fade-in zoom-in duration-200">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-eye-brand flex items-center justify-center">
              <FileText className="w-7 h-7 animate-pulse" />
            </div>
            <div className="space-y-1">
              <h4 className="font-black text-sm text-slate-900 dark:text-white">
                {ar ? 'جاري تجميع وتوليد ملف الـ PDF المجمع...' : 'Generating Batch PDF Document...'}
              </h4>
              {pdfProgress && (
                <p className="text-xs text-slate-500 font-bold">
                  {ar ? `معالجة الشهادة ${pdfProgress.current} من أصل ${pdfProgress.total}` : `Processing ${pdfProgress.current} of ${pdfProgress.total}`}
                </p>
              )}
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-blue-600 to-indigo-600 h-full transition-all duration-300 rounded-full"
                style={{ width: `${pdfProgress && pdfProgress.total > 0 ? (pdfProgress.current / pdfProgress.total) * 100 : 50}%` }}
              />
            </div>
          </div>
        </div>
      )}
      {/* BULK DELETE CONFIRMATION MODAL */}
      {showBulkDeleteModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 text-start relative my-auto">
            <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
              <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-950/50 flex items-center justify-center text-red-600 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-black text-base text-slate-900 dark:text-white">
                  {ar ? `تأكيد مسح (${selectedCertIds.length}) شهادة نهائياً من كل شيء` : `Confirm Purging ${selectedCertIds.length} Certificates`}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-bold">
                  {ar ? 'حذف نهائي وشامل لا يمكن استرجاعه' : 'Permanent action cannot be undone'}
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-xs font-bold text-red-800 dark:text-red-300 space-y-1.5">
              <p className="font-black flex items-center gap-1.5">
                <span>⚠️ تنبيه هام: مسح من كل مكان</span>
              </p>
              <p className="text-[11px] leading-relaxed">
                {ar
                  ? 'سيتم حذف هذه الشهادات تماماً من قاعدة بيانات سوبابيس (Supabase)، ومن الذاكرة والتخزين المحلي، ومن كافة إشعارات النظام الخاصة بالأعضاء. لن تظهر هذه الشهادات مجدداً في بروفايلات الأعضاء أو سجلات الكيان.'
                  : 'These certificates will be permanently purged from Supabase database, local cache, and all member notifications.'}
              </p>
            </div>

            {/* List Preview of Selected Certificates */}
            <div className="space-y-1">
              <p className="text-[10px] font-black text-slate-500 uppercase">
                {ar ? `الشهادات المحددة للحذف (${selectedCertIds.length}):` : 'Selected Certificates Preview:'}
              </p>
              <div className="max-h-48 overflow-y-auto space-y-1.5 pe-1">
                {db.getCertificates()
                  .filter(c => selectedCertIds.includes(c.id))
                  .map(c => (
                    <div key={c.id} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
                      <div className="min-w-0">
                        <p className="font-black text-slate-800 dark:text-slate-200 truncate">{c.recipientName}</p>
                        <p className="text-[10px] text-slate-500 truncate">{c.title} • {new Date(c.issuedAt).toLocaleDateString('ar-EG')}</p>
                      </div>
                      <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 shrink-0">
                        {c.status === 'approved' ? (ar ? 'معتمدة' : 'Approved') : (ar ? 'معلقة' : 'Pending')}
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                disabled={isDeletingBulk}
                onClick={() => setShowBulkDeleteModal(false)}
                className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-xs font-black rounded-xl transition-all cursor-pointer"
              >
                {ar ? 'إلغاء وتراجع' : 'Cancel'}
              </button>
              <button
                type="button"
                disabled={isDeletingBulk}
                onClick={handleBulkDelete}
                className="px-5 py-2.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white text-xs font-black rounded-xl shadow-lg shadow-red-500/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isDeletingBulk ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{ar ? 'جارٍ المسح الشامل...' : 'Purging...'}</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>{ar ? `تأكيد المسح النهائي (${selectedCertIds.length}) 🗑️` : `Confirm Purge (${selectedCertIds.length})`}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
