import React, { useState } from 'react';
import { UserProfile, MemberEvaluation } from '../types';
import { db } from '../db/localDb';
import { useLanguage } from '../lib/LanguageContext';
import {
  FileSpreadsheet, UploadCloud, RefreshCw, CheckCircle2, AlertTriangle,
  Copy, ExternalLink, Code, Search, Sparkles, X, ShieldCheck, Database,
  Download, FileCheck, Users, Star, Gift, Check, ArrowRight
} from 'lucide-react';
import ExcelJS from 'exceljs';
import { exportEvaluationsTemplateToExcel, downloadExcelFile } from '../lib/excelExport';

interface ParsedRow {
  identifier: string; // membershipCode, email, or fullName
  matchedUser?: UserProfile;
  commitmentRating: number;
  qualityRating: number;
  teamworkRating: number;
  activityRating: number;
  overallRating: number;
  bonusPoints?: number;
  feedbackComment: string;
  status: 'matched' | 'unmatched';
}

export const GoogleSheetSyncModal: React.FC<{
  currentUser: UserProfile;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}> = ({ currentUser, isOpen, onClose, onSuccess }) => {
  const { language, isRtl } = useLanguage();
  const isAr = language === 'ar';

  const [activeTab, setActiveTab] = useState<'file' | 'template' | 'url' | 'script'>('file');
  const [sheetUrl, setSheetUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isExportingTemplate, setIsExportingTemplate] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [searchFilter, setSearchFilter] = useState('');
  const [isCopied, setIsCopied] = useState(false);

  if (!isOpen) return null;

  const allUsers = db.getUsers().filter(u => !u.status || u.status.toLowerCase() === 'active');

  // Convert standard Google Sheet URL to direct CSV export URL with strict domain validation
  const getCsvExportUrl = (rawUrl: string): string => {
    const url = rawUrl.trim();
    if (!url) return '';

    try {
      const parsed = new URL(url);
      const isGoogleDomain = parsed.hostname === 'docs.google.com' || parsed.hostname === 'google.com' || parsed.hostname.endsWith('.google.com');
      if (!isGoogleDomain) {
        throw new Error(isAr ? 'يجب أن يكون الرابط من نطاق Google Sheets المعتمد (docs.google.com)' : 'URL must be a valid Google Sheets domain (docs.google.com)');
      }

      if (url.includes('/export?format=csv') || url.includes('/pub?output=csv')) return url;

      const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (match && match[1]) {
        const sheetId = match[1];
        const gidMatch = url.match(/[?&]gid=([0-9]+)/);
        const gidParam = gidMatch && gidMatch[1] ? `&gid=${gidMatch[1]}` : '';
        return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv${gidParam}`;
      }
      return url;
    } catch (err: any) {
      throw new Error(err.message || (isAr ? 'رابط غير صالح' : 'Invalid URL'));
    }
  };

  // Helper to normalize scale (e.g. converts 0-100% or 1-10 to 1-5 scale)
  const normalizeRating = (val: number): number => {
    if (isNaN(val) || val <= 0) return 5;
    if (val > 10) {
      // 0-100 scale
      return Math.min(5, Math.max(1, Number(((val / 100) * 5).toFixed(1))));
    }
    if (val > 5) {
      // 1-10 scale
      return Math.min(5, Math.max(1, Number((val / 2).toFixed(1))));
    }
    return Math.min(5, Math.max(1, Number(val.toFixed(1))));
  };

  // Process rows from 2D array of strings
  const processMatrixRows = (matrix: string[][]): ParsedRow[] => {
    if (!matrix || matrix.length < 2) return [];

    const headers = matrix[0].map(h => (h || '').toString().toLowerCase().trim());

    // Header Index Matchers
    const codeIdx = headers.findIndex(h => h.includes('code') || h.includes('كود') || h.includes('معرف') || h.includes('id') || h.includes('membership'));
    const nameIdx = headers.findIndex(h => h.includes('name') || h.includes('اسم') || h.includes('العضو') || h.includes('الطالب'));
    const emailIdx = headers.findIndex(h => h.includes('email') || h.includes('إيميل') || h.includes('بريد'));

    const commitmentIdx = headers.findIndex(h => h.includes('commit') || h.includes('التزام') || h.includes('جدية') || h.includes('انضباط'));
    const qualityIdx = headers.findIndex(h => h.includes('qual') || h.includes('جودة') || h.includes('إتقان') || h.includes('دقة'));
    const teamworkIdx = headers.findIndex(h => h.includes('team') || h.includes('جماعي') || h.includes('تواصل') || h.includes('تعاون'));
    const activityIdx = headers.findIndex(h => h.includes('initiat') || h.includes('نشاط') || h.includes('مبادرة') || h.includes('فاعلية') || h.includes('حضور'));
    const overallIdx = headers.findIndex(h => h.includes('overall') || h.includes('إجمالي') || h.includes('كلي') || h.includes('المجموع') || h.includes('الدرجة') || h.includes('avg') || h.includes('التقييم'));
    const bonusIdx = headers.findIndex(h => h.includes('bonus') || h.includes('بونص') || h.includes('نقاط إضافية') || h.includes('حافز'));
    const feedbackIdx = headers.findIndex(h => h.includes('feed') || h.includes('note') || h.includes('ملاحظ') || h.includes('تعليق') || h.includes('توصية'));

    const rows: ParsedRow[] = [];

    for (let i = 1; i < matrix.length; i++) {
      const cols = matrix[i];
      if (!cols || cols.length === 0 || cols.every(c => !c || !c.trim())) continue;

      const codeVal = codeIdx !== -1 ? (cols[codeIdx] || '').trim() : '';
      const nameVal = nameIdx !== -1 ? (cols[nameIdx] || '').trim() : '';
      const emailVal = emailIdx !== -1 ? (cols[emailIdx] || '').trim() : '';

      const identifier = codeVal || nameVal || emailVal || (cols[0] || '').trim();
      if (!identifier) continue;

      // Match user in database
      const matched = allUsers.find(u => {
        if (codeVal && u.membershipCode && u.membershipCode.toLowerCase() === codeVal.toLowerCase()) return true;
        if (codeVal && u.id.toLowerCase() === codeVal.toLowerCase()) return true;
        if (emailVal && u.email && u.email.toLowerCase() === emailVal.toLowerCase()) return true;
        if (nameVal && u.fullName && (u.fullName.toLowerCase().includes(nameVal.toLowerCase()) || nameVal.toLowerCase().includes(u.fullName.toLowerCase()))) return true;
        if (identifier && u.membershipCode && u.membershipCode.toLowerCase() === identifier.toLowerCase()) return true;
        if (identifier && u.fullName && u.fullName.toLowerCase().includes(identifier.toLowerCase())) return true;
        return false;
      });

      const parseCellNumber = (idx: number, fallback = 5): number => {
        if (idx === -1 || !cols[idx]) return fallback;
        const clean = cols[idx].toString().replace(/[^0-9.]/g, '');
        const n = parseFloat(clean);
        return isNaN(n) ? fallback : n;
      };

      const commitment = normalizeRating(parseCellNumber(commitmentIdx, 5));
      const quality = normalizeRating(parseCellNumber(qualityIdx, 5));
      const teamwork = normalizeRating(parseCellNumber(teamworkIdx, 5));
      const activity = normalizeRating(parseCellNumber(activityIdx, 5));

      let overall = overallIdx !== -1 ? normalizeRating(parseCellNumber(overallIdx, 0)) : 0;
      if (overall === 0) {
        overall = Number(((commitment + quality + teamwork + activity) / 4).toFixed(1));
      }

      const bonusPoints = bonusIdx !== -1 ? Math.max(0, parseInt(cols[bonusIdx]?.replace(/[^0-9-]/g, '') || '0', 10)) : 0;
      const feedback = feedbackIdx !== -1 ? cols[feedbackIdx]?.trim() || '' : '';

      rows.push({
        identifier,
        matchedUser: matched,
        commitmentRating: commitment,
        qualityRating: quality,
        teamworkRating: teamwork,
        activityRating: activity,
        overallRating: overall,
        bonusPoints: bonusPoints > 0 ? bonusPoints : undefined,
        feedbackComment: feedback || (isAr ? 'تم الاستيراد والاعتماد عبر شيت الإكسيل' : 'Imported via Excel Sheet'),
        status: matched ? 'matched' : 'unmatched',
      });
    }

    return rows;
  };

  // Helper to parse CSV string into matrix
  const parseCsvToMatrix = (csvText: string): string[][] => {
    const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length < 2) return [];

    const parseLine = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim().replace(/^"|"$/g, ''));
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim().replace(/^"|"$/g, ''));
      return result;
    };

    return lines.map(parseLine);
  };

  // Handle Excel (.xlsx, .xls) and CSV File Upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg('');
    setSuccessMsg('');
    setParsedRows([]);
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    try {
      const isExcel = file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls');

      let matrix: string[][] = [];

      if (isExcel) {
        // Use ExcelJS to parse binary excel file
        const buffer = await file.arrayBuffer();
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer);
        const worksheet = workbook.getWorksheet(1) || workbook.worksheets[0];

        if (!worksheet) {
          throw new Error(isAr ? 'الملف لا يحتوي على صفحات عمل.' : 'No worksheets found in file.');
        }

        worksheet.eachRow((row) => {
          const rowValues: string[] = [];
          row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            let val = '';
            if (cell.value !== null && cell.value !== undefined) {
              if (typeof cell.value === 'object' && 'result' in cell.value) {
                val = String(cell.value.result ?? '');
              } else if (typeof cell.value === 'object' && 'text' in cell.value) {
                val = String(cell.value.text ?? '');
              } else {
                val = String(cell.value);
              }
            }
            rowValues[colNumber - 1] = val;
          });
          matrix.push(rowValues);
        });
      } else {
        // CSV file
        const text = await file.text();
        matrix = parseCsvToMatrix(text);
      }

      const rows = processMatrixRows(matrix);
      if (rows.length === 0) {
        setErrorMsg(isAr ? 'لم يتم العثور على صفوف تقييم صالحة. يرجى التأكد من عناوين الأعمدة في الملف.' : 'No valid evaluation rows found in file.');
      } else {
        setParsedRows(rows);
      }
    } catch (err: any) {
      setErrorMsg(err.message || (isAr ? 'حدث خطأ أثناء قراءة ملف الإكسيل.' : 'Error reading Excel file.'));
    } finally {
      setIsLoading(false);
      // Reset input value so same file can be re-selected if desired
      e.target.value = '';
    }
  };

  // Handle Fetching Live Google Sheet
  const handleFetchSheet = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    setParsedRows([]);
    if (!sheetUrl.trim()) {
      setErrorMsg(isAr ? 'يرجى إدخال رابط Google Sheet أو رابط CSV المنشور.' : 'Please enter a Google Sheet URL.');
      return;
    }

    setIsLoading(true);
    try {
      const csvUrl = getCsvExportUrl(sheetUrl);
      let csvText = '';
      try {
        const response = await fetch(csvUrl);
        if (response.ok) {
          csvText = await response.text();
        } else {
          throw new Error('Direct fetch blocked by CORS');
        }
      } catch {
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(csvUrl)}`;
        const proxyRes = await fetch(proxyUrl);
        if (!proxyRes.ok) {
          throw new Error(isAr ? 'تأكد من أن الرابط متاح للجميع (Anyone with link can view)' : 'Sheet is not publicly viewable.');
        }
        csvText = await proxyRes.text();
      }

      const matrix = parseCsvToMatrix(csvText);
      const rows = processMatrixRows(matrix);
      if (rows.length === 0) {
        setErrorMsg(isAr ? 'لم يتم العثور على تقييمات صالحة بالشيت.' : 'No valid rating rows found.');
      } else {
        setParsedRows(rows);
      }
    } catch (err: any) {
      setErrorMsg(isAr ? `تعذر قراءة الشيت مباشرة: ${err.message}` : `Failed to fetch sheet: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Download Pre-filled Template
  const handleDownloadTemplate = async () => {
    setIsExportingTemplate(true);
    try {
      const { buffer, filename } = await exportEvaluationsTemplateToExcel(allUsers);
      downloadExcelFile(buffer, filename);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to generate template');
    } finally {
      setIsExportingTemplate(false);
    }
  };

  // Confirm Import & Save
  const handleConfirmSync = async () => {
    const validRows = parsedRows.filter(r => r.matchedUser);
    if (validRows.length === 0) {
      setErrorMsg(isAr ? 'لا توجد أعضاء متطابقة للاستيراد.' : 'No matched members to import.');
      return;
    }

    setIsLoading(true);
    try {
      const evaluationsData: Omit<MemberEvaluation, 'id' | 'createdAt'>[] = validRows.map(r => ({
        targetUserId: r.matchedUser!.id,
        targetUserName: r.matchedUser!.fullName,
        targetUserRole: r.matchedUser!.role,
        committee: r.matchedUser!.committee,
        department: r.matchedUser!.department,
        evaluatorId: currentUser.id,
        evaluatorName: `${currentUser.fullName} (Excel Import)`,
        evaluatorRole: currentUser.role,
        overallRating: r.overallRating,
        commitmentRating: r.commitmentRating,
        qualityRating: r.qualityRating,
        teamworkRating: r.teamworkRating,
        activityRating: r.activityRating,
        feedbackComment: r.feedbackComment,
      }));

      // 1. Bulk import evaluations
      const importedCount = db.bulkImportMemberEvaluations(evaluationsData, currentUser);

      // 2. Update bonus points if present
      for (const r of validRows) {
        if (r.bonusPoints && r.bonusPoints > 0 && r.matchedUser) {
          const currentBonus = r.matchedUser.bonusPoints || 0;
          await db.updateUserBonusPoints(r.matchedUser.id, currentBonus + r.bonusPoints, currentUser);
        }
      }

      setSuccessMsg(
        isAr
          ? `🎉 تم بنجاح استيراد واعتماد تقييمات ${importedCount} عضو وتحديث لوحة الصدارة ورادار الأداء!`
          : `🎉 Successfully imported and synced ratings for ${importedCount} members!`
      );

      setTimeout(() => {
        if (onSuccess) onSuccess();
        onClose();
      }, 1800);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error saving evaluations');
    } finally {
      setIsLoading(false);
    }
  };

  const sampleAppsScriptCode = `// Google Apps Script Auto-Sync for EYE Workflow Hub
function onEdit(e) {
  var sheet = e.source.getActiveSheet();
  var range = e.range;
  var row = range.getRow();
  
  if (row <= 1) return;
  
  var values = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];
  var payload = {
    membershipCode: values[0],
    commitmentRating: values[4] || 5,
    qualityRating: values[5] || 5,
    teamworkRating: values[6] || 5,
    activityRating: values[7] || 5,
    overallRating: values[8] || 5,
    feedbackComment: values[10] || ""
  };
  
  Logger.log("Synced row " + row + ": " + JSON.stringify(payload));
}`;

  const handleCopyScript = () => {
    navigator.clipboard.writeText(sampleAppsScriptCode);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const filteredPreviewRows = parsedRows.filter(r => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return (
      r.identifier.toLowerCase().includes(q) ||
      (r.matchedUser && r.matchedUser.fullName.toLowerCase().includes(q)) ||
      (r.matchedUser && r.matchedUser.committee.toLowerCase().includes(q))
    );
  });

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-7 max-w-4xl w-full shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto" dir={isRtl ? 'rtl' : 'ltr'}>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-150 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-500 text-white flex items-center justify-center font-bold text-2xl shadow-lg shadow-emerald-500/20">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span>{isAr ? 'استيراد ومزامنة تقييمات الأعضاء من الإكسيل 📊' : 'Excel & Sheets Evaluations Importer 📊'}</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                {isAr ? 'ارفع شيت الإكسيل لاستيراد درجات التقييم ونقاط البونص فورياً إلى لوحة الصدارة' : 'Upload Excel sheet to automatically import member evaluations & bonus'}
              </p>
            </div>
          </div>

          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-2xl border border-slate-200/60 dark:border-slate-700">
          <button
            onClick={() => setActiveTab('file')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'file' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <UploadCloud className="w-4 h-4" />
            <span>{isAr ? '📁 رفع ملف إكسيل (.xlsx / .csv)' : '📁 Upload Excel File'}</span>
          </button>

          <button
            onClick={() => setActiveTab('template')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'template' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>{isAr ? '📥 تحميل نموذج إكسيل جاهز' : '📥 Download Excel Template'}</span>
          </button>

          <button
            onClick={() => setActiveTab('url')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'url' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <RefreshCw className="w-4 h-4" />
            <span>{isAr ? '🌐 مزامنة Google Sheets' : '🌐 Google Sheets URL'}</span>
          </button>

          <button
            onClick={() => setActiveTab('script')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'script' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Code className="w-4 h-4" />
            <span>{isAr ? '💻 كود Apps Script' : '💻 Apps Script'}</span>
          </button>
        </div>

        {/* Error / Success Alerts */}
        {errorMsg && (
          <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-start gap-2.5 animate-fadeIn">
            <AlertTriangle className="w-5 h-5 shrink-0 text-rose-500 mt-0.5" />
            <span className="leading-relaxed">{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200 text-xs font-black flex items-center gap-2.5 animate-fadeIn">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* TAB 1: EXCEL FILE UPLOAD */}
        {activeTab === 'file' && (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-emerald-400/60 dark:border-emerald-600/40 rounded-3xl p-8 sm:p-10 text-center bg-emerald-50/20 dark:bg-emerald-950/10 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20 transition-all">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-4">
                <UploadCloud className="w-8 h-8 animate-bounce" />
              </div>
              <h3 className="text-base font-black text-slate-900 dark:text-white mb-1.5">
                {isAr ? 'اسحب وأفلت ملف الإكسيل هنا أو اضغط للاختيار' : 'Drag & Drop your Excel file here or click to browse'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-5 leading-relaxed">
                {isAr
                  ? 'يدعم ملفات (.xlsx و .xls و .csv). يتعرف النظام تلقائياً على أسماء الأعضاء وأكوادهم ودرجات التقييم (1-5 أو 0-100%).'
                  : 'Supports .xlsx, .xls, and .csv files. Auto-detects member names, codes, and ratings.'}
              </p>

              <input
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileUpload}
                className="hidden"
                id="excel-eval-upload-input"
                disabled={isLoading}
              />

              <label
                htmlFor="excel-eval-upload-input"
                className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-black rounded-2xl cursor-pointer shadow-lg shadow-emerald-600/20 inline-flex items-center gap-2 transition-all transform hover:scale-105"
              >
                {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileCheck className="w-4 h-4" />}
                <span>{isLoading ? (isAr ? 'جاري قراءة الملف...' : 'Reading File...') : (isAr ? 'اختيار ملف الإكسيل 📄' : 'Select Excel File')}</span>
              </label>
            </div>
          </div>
        )}

        {/* TAB 2: DOWNLOAD PRE-FILLED TEMPLATE */}
        {activeTab === 'template' && (
          <div className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Download className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  {isAr ? 'تحميل نموذج شيت التقييمات الجاهز (Excel Template) 📥' : 'Download Pre-filled Excel Evaluation Template'}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  {isAr
                    ? `سيتم إنشاء وتنزيل شيت إكسيل منسق ومُعبأ مسبقاً ببيانات جميع أعضاء الكيان النشطين (${allUsers.length} عضو) مع لجانهم وأكوادهم وأعمدة التقييم والبونص.`
                    : `Generates a formatted Excel sheet pre-filled with all ${allUsers.length} active members.`}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
                <p className="text-[11px] text-slate-400 font-bold">{isAr ? 'أعضاء الكيان' : 'Active Members'}</p>
                <p className="text-lg font-black text-blue-600 font-mono">{allUsers.length}</p>
              </div>
              <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
                <p className="text-[11px] text-slate-400 font-bold">{isAr ? 'معايير التقييم' : 'Criteria'}</p>
                <p className="text-lg font-black text-amber-500 font-mono">4 {isAr ? 'محاور' : 'Pillars'}</p>
              </div>
              <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
                <p className="text-[11px] text-slate-400 font-bold">{isAr ? 'مقياس الدرجات' : 'Scale'}</p>
                <p className="text-lg font-black text-emerald-600 font-mono">1 - 5 ⭐</p>
              </div>
              <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
                <p className="text-[11px] text-slate-400 font-bold">{isAr ? 'نقاط البونص' : 'Bonus'}</p>
                <p className="text-lg font-black text-purple-600 font-mono">اختياري 🎁</p>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={handleDownloadTemplate}
                disabled={isExportingTemplate}
                className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-xs rounded-2xl shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isExportingTemplate ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                <span>{isAr ? 'تنزيل نموذج إكسيل الأعضاء الجاهز (.xlsx) 🚀' : 'Download Formatted Excel Template (.xlsx)'}</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 3: LIVE GOOGLE SHEETS URL */}
        {activeTab === 'url' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {isAr ? 'ضع رابط Google Sheet الخاص بك:' : 'Enter Google Sheet Link:'}
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="url"
                  value={sheetUrl}
                  onChange={e => setSheetUrl(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/1..."
                  className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 text-xs text-slate-800 dark:text-white focus:outline-none focus:border-emerald-500 font-mono"
                />
                <button
                  onClick={handleFetchSheet}
                  disabled={isLoading}
                  className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs rounded-2xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 shrink-0"
                >
                  {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  <span>{isAr ? 'سحب البيانات' : 'Fetch Sheet'}</span>
                </button>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">
                💡 {isAr ? 'تأكد من مشاركة شيت جوجل كـ (Anyone with the link can view) لسحب التقييمات مباشرة.' : 'Ensure the Google Sheet access is set to View for Anyone with Link.'}
              </p>
            </div>
          </div>
        )}

        {/* TAB 4: APPS SCRIPT CODE */}
        {activeTab === 'script' && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-300 text-xs space-y-2">
              <p className="font-bold flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>{isAr ? 'كيفية تفعيل المزامنة التلقائية اللحظية من داخل Google Sheet:' : 'How to enable Auto-Sync in Google Sheets:'}</span>
              </p>
              <ol className="list-decimal list-inside space-y-1 text-slate-600 dark:text-slate-300 font-medium">
                <li>{isAr ? 'افتح شيت التقييمات في Google Sheets.' : 'Open your Google Sheet.'}</li>
                <li>{isAr ? 'من القائمة العلوية اختر (Extensions ⬅️ Apps Script).' : 'Go to Extensions -> Apps Script.'}</li>
                <li>{isAr ? 'امسح الكود القديم والصق الكود التالي واضغط Save.' : 'Paste the code below and save.'}</li>
              </ol>
            </div>

            <div className="relative bg-slate-950 text-slate-200 p-4 rounded-2xl font-mono text-xs overflow-x-auto border border-slate-800">
              <button
                onClick={handleCopyScript}
                className="absolute end-3 top-3 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-[11px] font-sans font-bold transition-all flex items-center gap-1 cursor-pointer"
              >
                {isCopied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{isCopied ? (isAr ? 'تم النسخ!' : 'Copied!') : (isAr ? 'نسخ الكود' : 'Copy Code')}</span>
              </button>
              <pre>{sampleAppsScriptCode}</pre>
            </div>
          </div>
        )}

        {/* PARSED ROWS PREVIEW & CONFIRMATION */}
        {parsedRows.length > 0 && (
          <div className="space-y-4 pt-4 border-t border-slate-150 dark:border-slate-800 animate-fadeIn">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Database className="w-4 h-4 text-emerald-500" />
                  <span>{isAr ? `معاينة تقييمات الشيت (${parsedRows.length} صف تم استخراجه):` : `Extracted Ratings Preview (${parsedRows.length} rows):`}</span>
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  {isAr
                    ? `تم مطابقة (${parsedRows.filter(r => r.matchedUser).length}) عضو بنجاح مع قاعدة بيانات الكيان.`
                    : `${parsedRows.filter(r => r.matchedUser).length} members successfully matched.`}
                </p>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchFilter}
                  onChange={e => setSearchFilter(e.target.value)}
                  placeholder={isAr ? 'بحث في الأسماء المستخرجة...' : 'Filter extracted names...'}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl ps-9 pe-3 py-1.5 text-xs text-slate-800 dark:text-white font-bold focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="max-h-72 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-inner">
              <table className="w-full text-start text-xs">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-black text-[11px] sticky top-0 z-10">
                  <tr>
                    <th className="p-3 text-start">{isAr ? 'العضو في الشيت' : 'Sheet Identifier'}</th>
                    <th className="p-3 text-start">{isAr ? 'العضو المتطابق بالكيان' : 'Matched System Member'}</th>
                    <th className="p-3 text-center">{isAr ? 'التقييم العام' : 'Overall'}</th>
                    <th className="p-3 text-center">{isAr ? 'البونص' : 'Bonus'}</th>
                    <th className="p-3 text-start">{isAr ? 'الملاحظات' : 'Feedback'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 dark:divide-slate-800">
                  {filteredPreviewRows.map((row, idx) => (
                    <tr key={idx} className={row.matchedUser ? 'bg-emerald-500/5 hover:bg-emerald-500/10 transition-colors' : 'bg-rose-500/5 hover:bg-rose-500/10 transition-colors'}>
                      <td className="p-3 font-mono font-bold text-slate-800 dark:text-slate-200 text-xs">
                        {row.identifier}
                      </td>
                      <td className="p-3 font-bold">
                        {row.matchedUser ? (
                          <div className="flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                            <div>
                              <p className="text-slate-900 dark:text-white font-black text-xs">{row.matchedUser.fullName}</p>
                              <p className="text-[10px] text-slate-400 font-semibold">{row.matchedUser.committee} • {row.matchedUser.role}</p>
                            </div>
                          </div>
                        ) : (
                          <span className="text-rose-500 text-[11px] font-black inline-flex items-center gap-1">
                            <span>⚠️</span>
                            <span>{isAr ? 'غير مسجل بالكيان' : 'Unmatched'}</span>
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-center font-mono font-black text-amber-500 text-xs">
                        ⭐ {row.overallRating} / 5.0
                      </td>
                      <td className="p-3 text-center font-mono font-black text-purple-600 dark:text-purple-400 text-xs">
                        {row.bonusPoints ? `+${row.bonusPoints}` : '—'}
                      </td>
                      <td className="p-3 text-slate-500 dark:text-slate-400 truncate max-w-xs text-[11px]">
                        {row.feedbackComment || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Confirmation CTA */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={handleConfirmSync}
                disabled={isLoading || parsedRows.filter(r => r.matchedUser).length === 0}
                className="flex-1 py-3.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-800 text-white font-black text-xs rounded-2xl shadow-xl shadow-emerald-600/30 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                <span>{isAr ? `اعتماد واستيراد تقييمات (${parsedRows.filter(r => r.matchedUser).length}) عضو للوحة الصدارة 🚀` : 'Confirm & Sync Ratings to Leaderboard 🚀'}</span>
              </button>

              <button
                onClick={onClose}
                className="px-6 py-3.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
