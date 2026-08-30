import ExcelJS from 'exceljs';
import { UserProfile, IssuedCertificate, Task, Meeting, AttendanceRecord, Submission } from '../types';

/**
 * Trigger browser download for an ExcelJS buffer
 */
export const downloadExcelFile = (buffer: ExcelJS.Buffer, filename: string) => {
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * Helper to classify an attendee into normalized Committee and Sub-group
 */
export const classifyAttendeeSubGroup = (
  record: AttendanceRecord,
  user?: UserProfile
): { committee: string; subGroup: string; committeeLabelAr: string; subGroupLabelAr: string } => {
  const rawComm = (user?.committee || record.committee || 'عام').trim();
  const rawDept = (user?.department || record.department || '').trim();
  const rawSub = (user?.subCommittee || '').trim();
  const combined = `${rawDept} ${rawSub}`.toUpperCase();

  let committee = rawComm;
  let subGroup = rawDept || 'عام';
  let committeeLabelAr = rawComm;
  let subGroupLabelAr = rawDept || 'عام';

  // Committee names in Arabic
  const commMap: Record<string, string> = {
    HR: 'الموارد البشرية (HR)',
    PR: 'العلاقات العامة (PR)',
    SM: 'السوشيال ميديا (SM)',
    OR: 'التنظيم (OR)',
    All: 'جميع اللجان',
    None: 'عام / إدارة',
    General: 'عام',
  };
  committeeLabelAr = commMap[rawComm] || rawComm;

  // HR Division logic: 4 main sub-committees (HRM, HRD, HRS, HRIS)
  if (rawComm.toUpperCase() === 'HR' || combined.includes('HRM') || combined.includes('HR OF') || combined.includes('HRD') || combined.includes('HRS') || combined.includes('HRIS')) {
    committee = 'HR';
    committeeLabelAr = 'الموارد البشرية (HR)';

    if (combined.includes('HRD') || rawDept === 'HRD') {
      subGroup = 'HRD';
      subGroupLabelAr = 'HRD — التطوير والتدريب';
    } else if (combined.includes('HRS') || rawDept === 'HRS') {
      subGroup = 'HRS';
      subGroupLabelAr = 'HRS — الدعم والمساندة';
    } else if (combined.includes('HRIS') || rawDept === 'HRIS') {
      subGroup = 'HRIS';
      subGroupLabelAr = 'HRIS — نظم المعلومات';
    } else {
      // All other HR members belong to HRM
      subGroup = 'HRM';
      subGroupLabelAr = 'HRM — إدارة الموارد البشرية';
    }
  } else if (rawComm.toUpperCase() === 'PR') {
    committee = 'PR';
    committeeLabelAr = 'العلاقات العامة (PR)';
    if (combined.includes('EPR')) {
      subGroup = 'EPR';
      subGroupLabelAr = 'العلاقات الخارجية (EPR)';
    } else if (combined.includes('IPR')) {
      subGroup = 'IPR';
      subGroupLabelAr = 'العلاقات الداخلية (IPR)';
    }
  } else if (rawComm.toUpperCase() === 'SM') {
    committee = 'SM';
    committeeLabelAr = 'السوشيال ميديا (SM)';
    if (combined.includes('GRAPHIC')) {
      subGroup = 'Graphic Design';
      subGroupLabelAr = 'التصميم الجرافيكي (Graphic Design)';
    } else if (combined.includes('CONTENT')) {
      subGroup = 'Content';
      subGroupLabelAr = 'كتابة المحتوى (Content)';
    } else if (combined.includes('PHOTO')) {
      subGroup = 'Photography';
      subGroupLabelAr = 'التصوير الفوتوغرافي (Photography)';
    } else if (combined.includes('VIDEO')) {
      subGroup = 'Video Editing';
      subGroupLabelAr = 'المونتاج وصناعة الفيديو (Video Editing)';
    }
  } else if (rawComm.toUpperCase() === 'OR') {
    committee = 'OR';
    committeeLabelAr = 'التنظيم (OR)';
    if (combined.includes('VIP')) {
      subGroup = 'VIP';
      subGroupLabelAr = 'استقبال كبار الزوار (VIP)';
    } else if (combined.includes('PLANNING')) {
      subGroup = 'Planning';
      subGroupLabelAr = 'التخطيط (Planning)';
    } else if (combined.includes('COORD')) {
      subGroup = 'Coordination';
      subGroupLabelAr = 'التنسيق والمتابعة (Coordination)';
    } else if (combined.includes('LOGIST')) {
      subGroup = 'Logistics';
      subGroupLabelAr = 'اللوجستيات والدعم الفني (Logistics)';
    }
  }

  return { committee, subGroup, committeeLabelAr, subGroupLabelAr };
};

/**
 * Export Meeting Attendance to formatted, organized Excel file
 */
export const exportMeetingAttendanceToExcel = async (
  meeting: Meeting,
  attendance: AttendanceRecord[],
  allUsers: UserProfile[] = [],
  filename?: string
) => {
  const usersMap = new Map<string, UserProfile>();
  allUsers.forEach(u => {
    if (u.id) usersMap.set(u.id, u);
    if (u.email) usersMap.set(u.email.toLowerCase(), u);
  });

  const cleanTitle = (meeting.title || 'اجتماع').replace(/[/\\?%*:|"<>]/g, '-').trim();
  const safeDate = meeting.scheduledAt ? new Date(meeting.scheduledAt).toISOString().split('T')[0] : 'date';
  const outFilename = filename || `كشف_حضور_${cleanTitle}_${safeDate}.xlsx`;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'EYE Gharbia Platform';
  workbook.created = new Date();

  // ─────────────────────────────────────────────────────────────
  // SHEET 1: كشف الحضور التفصيلي (Detailed Attendance Sheet)
  // ─────────────────────────────────────────────────────────────
  const ws1 = workbook.addWorksheet('كشف الحضور التفصيلي', {
    views: [{ rightToLeft: true, showGridLines: true }]
  });

  // 1. Meeting Title Banner (Row 1)
  ws1.mergeCells('A1:L1');
  const titleCell = ws1.getCell('A1');
  titleCell.value = `EYE Organization — كشف حضور رسمي: ${meeting.title}`;
  titleCell.font = { name: 'Calibri', size: 15, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }; // Dark Slate / Navy
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  ws1.getRow(1).height = 36;

  // 2. Metadata Grid (Rows 2 - 4)
  const scheduledDateStr = meeting.scheduledAt
    ? new Date(meeting.scheduledAt).toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) +
      ' — ' +
      new Date(meeting.scheduledAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
    : 'غير محدد';

  const typeMap: Record<string, string> = {
    General: 'اجتماع عام',
    Committee: 'اجتماع لجنة',
    Department: 'اجتماع قسم',
    Emergency: 'اجتماع طارئ'
  };

  const metaRows = [
    [
      { label: '📅 تاريخ ووقت الاجتماع:', val: scheduledDateStr },
      { label: '📍 المكان / الرابط:', val: meeting.location || 'غير محدد' }
    ],
    [
      { label: '🏷️ نوع ونطاق الاجتماع:', val: `${typeMap[meeting.type] || meeting.type} (${meeting.committee || 'الكل'})` },
      { label: '👤 منظم الاجتماع:', val: meeting.createdByName || 'إدارة الكيان' }
    ],
    [
      {
        label: '👥 إجمالي الحاضرين:',
        val: `${attendance.length} عضو حاضر ${
          meeting.expectedAttendeesCount
            ? `(المستهدف: ${meeting.expectedAttendeesCount} — نسبة الحضور: ${Math.round((attendance.length / meeting.expectedAttendeesCount) * 100)}%)`
            : ''
        }`
      },
      { label: '🔐 كود الحضور السري:', val: meeting.attendanceCode || '—' }
    ]
  ];

  metaRows.forEach((pair, idx) => {
    const rowNum = idx + 2;
    ws1.mergeCells(`A${rowNum}:B${rowNum}`);
    ws1.mergeCells(`C${rowNum}:F${rowNum}`);
    ws1.mergeCells(`G${rowNum}:H${rowNum}`);
    ws1.mergeCells(`I${rowNum}:L${rowNum}`);

    const lbl1 = ws1.getCell(`A${rowNum}`);
    lbl1.value = pair[0].label;
    lbl1.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF475569' } };
    lbl1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    lbl1.alignment = { vertical: 'middle', horizontal: 'right' };

    const val1 = ws1.getCell(`C${rowNum}`);
    val1.value = pair[0].val;
    val1.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F172A' } };
    val1.alignment = { vertical: 'middle', horizontal: 'right' };

    const lbl2 = ws1.getCell(`G${rowNum}`);
    lbl2.value = pair[1].label;
    lbl2.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF475569' } };
    lbl2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    lbl2.alignment = { vertical: 'middle', horizontal: 'right' };

    const val2 = ws1.getCell(`I${rowNum}`);
    val2.value = pair[1].val;
    val2.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F172A' } };
    val2.alignment = { vertical: 'middle', horizontal: 'right' };

    ws1.getRow(rowNum).height = 24;
  });

  // Empty Spacer Row (Row 5)
  ws1.getRow(5).height = 10;

  // 3. Table Header (Row 6)
  const headers = [
    '#',
    'اسم العضو / Member Name',
    'كود العضوية / Code',
    'الدور الإداري / Role',
    'اللجنة الرئيسية / Committee',
    'القسم واللجنة الفرعية / Sub-Committee',
    'رقم الهاتف / Phone',
    'البريد الإلكتروني / Email',
    'وقت تسجيل الحضور / Check-in Time',
    'حالة الحضور / Status',
    'التقييم / Rating',
    'رأي ومقترحات العضو / Feedback & Notes'
  ];

  const headerRow = ws1.addRow(headers);
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4338CA' } }; // Indigo-700
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF312E81' } },
      bottom: { style: 'medium', color: { argb: 'FF312E81' } },
      left: { style: 'thin', color: { argb: 'FF818CF8' } },
      right: { style: 'thin', color: { argb: 'FF818CF8' } }
    };
  });

  // 4. Classify and Group Attendance Records
  interface EnrichedAttendance {
    record: AttendanceRecord;
    user?: UserProfile;
    committee: string;
    subGroup: string;
    committeeLabelAr: string;
    subGroupLabelAr: string;
  }

  const enrichedList: EnrichedAttendance[] = attendance.map(rec => {
    const user = usersMap.get(rec.memberId) || usersMap.get((rec.memberEmail || '').toLowerCase());
    const classification = classifyAttendeeSubGroup(rec, user);
    return {
      record: rec,
      user,
      ...classification
    };
  });

  // Sort by Committee priority, then SubGroup, then Name
  const commPriority: Record<string, number> = { HR: 1, PR: 2, SM: 3, OR: 4 };
  enrichedList.sort((a, b) => {
    const pA = commPriority[a.committee.toUpperCase()] || 99;
    const pB = commPriority[b.committee.toUpperCase()] || 99;
    if (pA !== pB) return pA - pB;
    if (a.subGroup !== b.subGroup) return a.subGroup.localeCompare(b.subGroup, 'ar');
    return (a.record.memberName || '').localeCompare(b.record.memberName || '', 'ar');
  });

  // Group by (committee + subGroup)
  const groups: Record<string, EnrichedAttendance[]> = {};
  enrichedList.forEach(item => {
    const key = `${item.committee}:::${item.subGroup}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  });

  let globalIndex = 1;

  Object.entries(groups).forEach(([_key, items]) => {
    const first = items[0];
    const groupTitle = `📌 ${first.committeeLabelAr} ◀ ${first.subGroupLabelAr} — (عدد الحاضرين: ${items.length})`;

    // Group Subheader Row
    const groupRow = ws1.addRow([groupTitle]);
    const groupRowNum = groupRow.number;
    ws1.mergeCells(`A${groupRowNum}:L${groupRowNum}`);
    const groupCell = ws1.getCell(`A${groupRowNum}`);
    groupCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF1E1B4B' } };
    groupCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } }; // Soft Indigo Banner
    groupCell.alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };
    groupCell.border = {
      top: { style: 'medium', color: { argb: 'FF6366F1' } },
      bottom: { style: 'medium', color: { argb: 'FF6366F1' } },
      left: { style: 'thin', color: { argb: 'FFC7D2FE' } },
      right: { style: 'thin', color: { argb: 'FFC7D2FE' } }
    };
    groupRow.height = 24;

    // Member rows
    items.forEach((item) => {
      const u = item.user;
      const rec = item.record;
      const isEven = globalIndex % 2 === 0;
      const zebraColor = isEven ? 'FFF8FAFC' : 'FFFFFFFF';

      const checkInTimeStr = rec.checkedInAt
        ? new Date(rec.checkedInAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        : '—';

      const ratingStr = rec.rating ? `${rec.rating} / 5 ⭐` : '—';
      const statusStr = rec.isExcused ? 'معذور' : 'حاضر ✅';

      const row = ws1.addRow([
        globalIndex,
        rec.memberName || u?.fullName || 'عضو',
        u?.membershipCode || '—',
        u?.role || 'Member',
        item.committeeLabelAr,
        item.subGroupLabelAr,
        u?.phoneNumber || '—',
        rec.memberEmail || u?.email || '—',
        checkInTimeStr,
        statusStr,
        ratingStr,
        rec.feedback || '—'
      ]);

      row.height = rec.feedback && rec.feedback.length > 40 ? 32 : 22;

      row.eachCell((cell, colNumber) => {
        cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF1E293B' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: zebraColor } };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };

        // Alignments
        if (colNumber === 1 || colNumber === 3 || colNumber === 4 || colNumber === 9 || colNumber === 10 || colNumber === 11) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        } else if (colNumber === 2 || colNumber === 5 || colNumber === 6 || colNumber === 12) {
          cell.alignment = { vertical: 'middle', horizontal: 'right', wrapText: true };
        } else {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        }

        // Highlight status cell
        if (colNumber === 10) {
          cell.font = {
            name: 'Calibri',
            size: 10,
            bold: true,
            color: { argb: rec.isExcused ? 'FFD97706' : 'FF059669' }
          };
        }
      });

      globalIndex++;
    });
  });

  // Total Summary Footer Row in Sheet 1
  if (attendance.length > 0) {
    const totalRow = ws1.addRow([
      'الإجمالي',
      `إجمالي الحضور الفعلي: ${attendance.length} عضو حاضر`,
      '', '', '', '', '', '', '', '', '', ''
    ]);
    const totalRowNum = totalRow.number;
    ws1.mergeCells(`B${totalRowNum}:L${totalRowNum}`);
    const totCellA = ws1.getCell(`A${totalRowNum}`);
    totCellA.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    totCellA.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    totCellA.alignment = { vertical: 'middle', horizontal: 'center' };

    const totCellB = ws1.getCell(`B${totalRowNum}`);
    totCellB.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    totCellB.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    totCellB.alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };
    totalRow.height = 26;
  }

  // Column Widths for Sheet 1
  ws1.columns = [
    { width: 6 },   // #
    { width: 28 },  // Name
    { width: 16 },  // Code
    { width: 15 },  // Role
    { width: 20 },  // Committee
    { width: 32 },  // Sub-committee
    { width: 16 },  // Phone
    { width: 26 },  // Email
    { width: 18 },  // Check-in Time
    { width: 14 },  // Status
    { width: 14 },  // Rating
    { width: 40 },  // Feedback
  ];

  // ─────────────────────────────────────────────────────────────
  // SHEET 2: إحصائيات وملخص الحضور (Summary & Stats Sheet)
  // ─────────────────────────────────────────────────────────────
  const ws2 = workbook.addWorksheet('إحصائيات وملخص الحضور', {
    views: [{ rightToLeft: true, showGridLines: true }]
  });

  // Title Banner
  ws2.mergeCells('A1:F1');
  const sTitle = ws2.getCell('A1');
  sTitle.value = `ملخص وإحصائيات الحضور — ${meeting.title}`;
  sTitle.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  sTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  sTitle.alignment = { vertical: 'middle', horizontal: 'center' };
  ws2.getRow(1).height = 32;

  // Header Row
  const sHeaders = [
    '#',
    'اللجنة الرئيسية / Committee',
    'القسم واللجنة الفرعية / Sub-Committee',
    'عدد الحاضرين / Attendees',
    'عدد المعذورين / Excused',
    'متوسط تقييم السيشن / Avg Rating'
  ];

  const sHeaderRow = ws2.addRow(sHeaders);
  sHeaderRow.height = 26;
  sHeaderRow.eachCell((cell) => {
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } }; // Emerald-600
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF047857' } },
      bottom: { style: 'medium', color: { argb: 'FF047857' } },
      left: { style: 'thin', color: { argb: 'FF6EE7B7' } },
      right: { style: 'thin', color: { argb: 'FF6EE7B7' } }
    };
  });

  let sIndex = 1;
  let totalAttendeesCount = 0;
  let totalExcusedCount = 0;
  let allRatings: number[] = [];

  Object.entries(groups).forEach(([_key, items]) => {
    const first = items[0];
    const attended = items.filter(i => !i.record.isExcused).length;
    const excused = items.filter(i => i.record.isExcused).length;
    const ratings = items.map(i => i.record.rating).filter((r): r is number => typeof r === 'number' && r > 0);
    const avgRating = ratings.length > 0
      ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) + ' / 5 ⭐'
      : 'لا يوجد تقييم';

    totalAttendeesCount += attended;
    totalExcusedCount += excused;
    allRatings.push(...ratings);

    const sRow = ws2.addRow([
      sIndex,
      first.committeeLabelAr,
      first.subGroupLabelAr,
      attended,
      excused,
      avgRating
    ]);

    sRow.height = 22;
    sRow.eachCell((cell, colNum) => {
      cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF1E293B' } };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };
      if (colNum === 2 || colNum === 3) {
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
      } else {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      }
    });

    sIndex++;
  });

  // Overall Total Row for Sheet 2
  const overallAvg = allRatings.length > 0
    ? (allRatings.reduce((a, b) => a + b, 0) / allRatings.length).toFixed(1) + ' / 5 ⭐'
    : '—';

  const sTotalRow = ws2.addRow([
    'الإجمالي',
    'جميع اللجان والأقسام المشاركة',
    `إجمالي الفرق: ${Object.keys(groups).length}`,
    totalAttendeesCount,
    totalExcusedCount,
    overallAvg
  ]);
  sTotalRow.height = 26;
  sTotalRow.eachCell((cell) => {
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  // Auto-fit Sheet 2 columns
  ws2.columns = [
    { width: 8 },   // #
    { width: 26 },  // Committee
    { width: 36 },  // Sub-Committee
    { width: 18 },  // Attended
    { width: 18 },  // Excused
    { width: 22 },  // Avg Rating
  ];

  // Write buffer and return
  const buffer = await workbook.xlsx.writeBuffer();
  return { buffer, filename: outFilename };
};

export const exportUsersToExcel = async (users: UserProfile[], filename = 'EYE_Members_Directory.xlsx') => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('الأعضاء', {
    views: [{ rightToLeft: true }]
  });

  // Add headers
  worksheet.addRow([
    '#',
    'الاسم بالكامل / Full Name',
    'كود العضوية / Code',
    'البريد الإلكتروني / Email',
    'رقم الهاتف / Phone',
    'الدور الإداري / Role',
    'اللجنة / Committee',
    'القسم / Department',
    'الحالة / Status',
    'المحافظة / Governorate',
    'تاريخ الانضمام / Joined Date'
  ]);

  // Add data rows
  users.forEach((u, i) => {
    worksheet.addRow([
      i + 1,
      u.fullName || '',
      u.membershipCode || '',
      u.email || '',
      u.phoneNumber || '',
      u.role || '',
      u.committee || '',
      u.department || '',
      u.status || '',
      u.governorate || 'الغربية',
      u.joinedDate ? new Date(u.joinedDate).toLocaleDateString('ar-EG') : ''
    ]);
  });

  // Style headers
  worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };

  // Auto-fit columns
  worksheet.columns.forEach(column => {
    column.width = column.header ? Math.max(15, column.header.length + 5) : 15;
  });

  // Generate buffer and return it (caller can decide how to save)
  const buffer = await workbook.xlsx.writeBuffer();
  return { buffer, filename };
};

export const exportCertificatesToExcel = async (certs: IssuedCertificate[], filename = 'EYE_Issued_Certificates.xlsx') => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('الشهادات المعتمدة', {
    views: [{ rightToLeft: true }]
  });

  // Add headers
  worksheet.addRow([
    '#',
    'معرف الشهادة / ID',
    'اسم المستلم / Recipient',
    'عنوان الشهادة / Title',
    'نوع الشهادة / Type',
    'اللجنة / Committee',
    'الدور / Role',
    'صادرة بواسطة / Issued By',
    'الحالة / Status',
    'تاريخ الإصدار / Date'
  ]);

  // Add data rows
  certs.forEach((c, i) => {
    worksheet.addRow([
      i + 1,
      `EYE-CERT-${c.id.slice(-8).toUpperCase()}`,
      c.recipientName || '',
      c.title || '',
      c.certType || '',
      c.committee || 'عام',
      c.recipientRole || '',
      c.issuedByName || '',
      c.status === 'approved' ? 'معتمدة' : c.status === 'pending' ? 'بانتظار الموافقة' : 'مرفوضة',
      new Date(c.issuedAt).toLocaleDateString('ar-EG')
    ]);
  });

  // Style headers
  worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } };

  // Auto-fit columns
  worksheet.columns.forEach(column => {
    column.width = column.header ? Math.max(15, column.header.length + 5) : 15;
  });

  // Generate buffer and return it
  const buffer = await workbook.xlsx.writeBuffer();
  return { buffer, filename };
};

export const export365EvaluationToExcel = async (
  users: UserProfile[],
  filename = 'تقييم_الأعضاء_والقادة_365_EYE.xlsx'
) => {
  const { db, calculateMemberAVG } = require('../db/localDb');
  const meetings = db.getMeetings();
  const attendance = db.getAllAttendance();
  const tasks = db.getTasks();
  const submissions = db.getSubmissions();
  const excuses = db.getExcuseRequests();
  const evaluations = db.getMemberEvaluations();

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('تقييم 365 يوم', {
    views: [{ rightToLeft: true }]
  });

  // Add headers
  worksheet.addRow([
    '#',
    'اسم العضو / Leader Name',
    'المحافظة / Governorate',
    'المنصب / Position',
    'اللجنة / Committee',
    'ميتينج أونلاين (5ن)',
    'ميتينج أوفلاين (10ن)',
    'تاسكات منجزة (5ن)',
    'أعذار مقبولة',
    'سلوك (BHV)',
    'تفاعل (Interaction)',
    'إجمالي النقاط الفعلية',
    'أعلى نقطة ممكنة',
    'البونص (Bonus)',
    'الـ AVG النهائي (%)',
    'التقدير النهائي'
  ]);

  // Add data rows
  const data = users.map((u, i) => {
    const breakdown = calculateMemberAVG(
      u.id,
      meetings,
      attendance,
      tasks,
      submissions,
      excuses,
      evaluations,
      u.bonusPoints || 0
    );

    let grade = 'يحتاج إلى تطوير';
    if (breakdown.avgScore >= 90) grade = 'ممتاز مرتفع جداً';
    else if (breakdown.avgScore >= 80) grade = 'ممتاز';
    else if (breakdown.avgScore >= 70) grade = 'جيد جداً';
    else if (breakdown.avgScore >= 60) grade = 'جيد';
    else if (breakdown.avgScore >= 50) grade = 'مقبول';

    return {
      '#': i + 1,
      'اسم العضو / Leader Name': u.fullName || '',
      'المحافظة / Governorate': u.governorate || 'الغربية',
      'المنصب / Position': u.role || '',
      'اللجنة / Committee': u.committee || '',
      'ميتينج أونلاين (5ن)': breakdown.onlineMeetingsEarned,
      'ميتينج أوفلاين (10ن)': breakdown.offlineMeetingsEarned,
      'تاسكات منجزة (5ن)': breakdown.tasksEarned,
      'أعذار مقبولة': breakdown.excusedMeetingsCount + breakdown.excusedTasksCount,
      'سلوك (BHV)': breakdown.behaviorScore,
      'تفاعل (Interaction)': breakdown.interactionScore,
      'إجمالي النقاط الفعلية': breakdown.earnedPoints,
      'أعلى نقطة ممكنة': breakdown.maxPoints,
      'البونص (Bonus)': breakdown.bonusPoints,
      'الـ AVG النهائي (%)': `${breakdown.avgScore}%`,
      'التقدير النهائي': grade
    };
  });

  data.forEach(row => {
    worksheet.addRow([
      row['#'],
      row['اسم العضو / Leader Name'],
      row['المحافظة / Governorate'],
      row['المنصب / Position'],
      row['اللجنة / Committee'],
      row['ميتينج أونلاين (5ن)'],
      row['ميتينج أوفلاين (10ن)'],
      row['تاسكات منجزة (5ن)'],
      row['أعذار مقبولة'],
      row['سلوك (BHV)'],
      row['تفاعل (Interaction)'],
      row['إجمالي النقاط الفعلية'],
      row['أعلى نقطة ممكنة'],
      row['البونص (Bonus)'],
      row['الـ AVG النهائي (%)'],
      row['التقدير النهائي']
    ]);
  });

  // Style headers
  worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDC2626' } };

  // Auto-fit columns
  worksheet.columns.forEach(column => {
    column.width = column.header ? Math.max(15, column.header.length + 5) : 15;
  });

  // Generate buffer and return it
  const buffer = await workbook.xlsx.writeBuffer();
  return { buffer, filename };
};

/**
 * Export Task Submissions to formatted, organized Excel file
 */
export const exportTaskSubmissionsToExcel = async (
  task: Task,
  submissions: Submission[],
  allUsers: UserProfile[] = [],
  filename?: string
) => {
  const usersMap = new Map<string, UserProfile>();
  allUsers.forEach(u => {
    if (u.id) usersMap.set(u.id, u);
    if (u.email) usersMap.set(u.email.toLowerCase(), u);
  });

  const cleanTitle = (task.name || 'مهمة').replace(/[/\\?%*:|"<>]/g, '-').trim();
  const outFilename = filename || `تسليمات_مهمة_${cleanTitle}.xlsx`;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'EYE Gharbia Platform';
  workbook.created = new Date();

  // ─────────────────────────────────────────────────────────────
  // SHEET 1: كشف تسليمات المهمة التفصيلي
  // ─────────────────────────────────────────────────────────────
  const ws1 = workbook.addWorksheet('كشف التسليمات', {
    views: [{ rightToLeft: true, showGridLines: true }]
  });

  // 1. Task Title Banner (Row 1)
  ws1.mergeCells('A1:L1');
  const titleCell = ws1.getCell('A1');
  titleCell.value = `EYE Organization — كشف تسليمات مهمة: ${task.name}`;
  titleCell.font = { name: 'Calibri', size: 15, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD97706' } }; // Amber-600
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  ws1.getRow(1).height = 36;

  // 2. Metadata Grid (Rows 2 - 4)
  const acceptedCount = submissions.filter(s => s.status === 'Accepted').length;
  const pendingCount = submissions.filter(s => s.status === 'Pending').length;
  const rejectedCount = submissions.filter(s => s.status === 'Rejected').length;
  const gradedSubs = submissions.filter(s => typeof s.grade === 'number' && s.grade > 0);
  const avgGradeStr = gradedSubs.length > 0
    ? `${Math.round(gradedSubs.reduce((acc, s) => acc + (s.grade || 0), 0) / gradedSubs.length)} / 100`
    : 'لم يتم التقييم بعد';

  const deadlineStr = task.deadline
    ? new Date(task.deadline).toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    : 'غير محدد';

  const priorityMap: Record<string, string> = {
    Low: 'منخفضة',
    Medium: 'متوسطة',
    High: 'عالية',
    Urgent: 'عاجلة'
  };

  const metaRows = [
    [
      { label: '📅 الموعد النهائي (Deadline):', val: deadlineStr },
      { label: '🎯 الأولوية واللجنة:', val: `${priorityMap[task.priority] || task.priority} — (${task.committee || 'الكل'})` }
    ],
    [
      { label: '👤 قائد / مسؤول المهمة:', val: task.createdByName || 'إدارة الكيان' },
      { label: '📊 متوسط درجات التقييم:', val: avgGradeStr }
    ],
    [
      {
        label: '👥 إجمالي التسليمات:',
        val: `${submissions.length} تسليم (${acceptedCount} مقبول • ${pendingCount} بالانتظار • ${rejectedCount} مرفوض)`
      },
      { label: '📌 حالة المهمة:', val: task.status === 'Published' ? 'منشورة ونشطة' : task.status === 'Closed' ? 'مكتملة ومغلقة' : 'مسودة' }
    ]
  ];

  metaRows.forEach((pair, idx) => {
    const rowNum = idx + 2;
    ws1.mergeCells(`A${rowNum}:B${rowNum}`);
    ws1.mergeCells(`C${rowNum}:E${rowNum}`);
    ws1.mergeCells(`F${rowNum}:G${rowNum}`);
    ws1.mergeCells(`H${rowNum}:L${rowNum}`);

    const lbl1 = ws1.getCell(`A${rowNum}`);
    lbl1.value = pair[0].label;
    lbl1.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF475569' } };
    lbl1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    lbl1.alignment = { vertical: 'middle', horizontal: 'right' };

    const val1 = ws1.getCell(`C${rowNum}`);
    val1.value = pair[0].val;
    val1.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F172A' } };
    val1.alignment = { vertical: 'middle', horizontal: 'right' };

    const lbl2 = ws1.getCell(`F${rowNum}`);
    lbl2.value = pair[1].label;
    lbl2.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF475569' } };
    lbl2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    lbl2.alignment = { vertical: 'middle', horizontal: 'right' };

    const val2 = ws1.getCell(`H${rowNum}`);
    val2.value = pair[1].val;
    val2.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F172A' } };
    val2.alignment = { vertical: 'middle', horizontal: 'right' };

    ws1.getRow(rowNum).height = 24;
  });

  // Empty Spacer Row (Row 5)
  ws1.getRow(5).height = 10;

  // 3. Table Header (Row 6)
  const headers = [
    '#',
    'اسم العضو / Member Name',
    'كود العضوية / Code',
    'اللجنة / Committee',
    'القسم واللجنة الفرعية / Department',
    'وقت التسليم / Submitted At',
    'حالة التسليم / Status',
    'الدرجة / Grade',
    'المُقيِّم / Evaluator (Leader)',
    'معايير التقييم / Criteria',
    'ملاحظات وتعليقات القائد / Leader Feedback',
    'اسم ورابط الملف / File Attachment'
  ];

  const headerRow = ws1.addRow(headers);
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB45309' } }; // Amber-700
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF78350F' } },
      bottom: { style: 'medium', color: { argb: 'FF78350F' } },
      left: { style: 'thin', color: { argb: 'FFFDE68A' } },
      right: { style: 'thin', color: { argb: 'FFFDE68A' } }
    };
  });

  // 4. Data Rows
  submissions.forEach((s, i) => {
    const u = usersMap.get(s.memberId) || usersMap.get((s.memberEmail || '').toLowerCase());
    const isEven = i % 2 === 0;
    const zebraColor = isEven ? 'FFF8FAFC' : 'FFFFFFFF';

    const submittedDateStr = s.submittedAt
      ? new Date(s.submittedAt).toLocaleDateString('ar-EG') + ' ' + new Date(s.submittedAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
      : '—';

    const statusAr = s.status === 'Accepted' ? 'مقبول ✅' : s.status === 'Rejected' ? 'مرفوض ❌' : s.status === 'Resubmission Requested' ? 'مطلوب إعادة التسليم ⚠️' : 'قيد المراجعة ⏳';
    const gradeStr = typeof s.grade === 'number' ? `${s.grade}/100` : '—';

    let criteriaStr = '—';
    if (s.gradingCriteria) {
      criteriaStr = `جودة: ${s.gradingCriteria.quality || 0} • التزام: ${s.gradingCriteria.timeliness || 0} • ابتكار: ${s.gradingCriteria.innovation || 0} • اكتمال: ${s.gradingCriteria.completeness || 0}`;
    }

    const reviewerName = s.reviewedBy || (s.history && s.history.length > 0 ? (usersMap.get(s.history[s.history.length - 1].changedBy)?.fullName || s.history[s.history.length - 1].changedBy) : '') || (s.status !== 'Pending' ? (task.createdByName || 'القائد المسؤول') : 'لم يُراجع بعد');

    const row = ws1.addRow([
      i + 1,
      s.memberName || u?.fullName || 'عضو',
      u?.membershipCode || '—',
      s.committee || u?.committee || 'عام',
      s.department || u?.department || 'عام',
      submittedDateStr,
      statusAr,
      gradeStr,
      reviewerName,
      criteriaStr,
      s.comment || s.rejectionReason || '—',
      s.fileName || s.fileUrl || '—'
    ]);

    row.height = 24;
    row.eachCell((cell, colNumber) => {
      cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF1E293B' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: zebraColor } };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };

      if (colNumber === 1 || colNumber === 3 || colNumber === 6 || colNumber === 7 || colNumber === 8) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else if (colNumber === 2 || colNumber === 4 || colNumber === 5 || colNumber === 9 || colNumber === 10 || colNumber === 11 || colNumber === 12) {
        cell.alignment = { vertical: 'middle', horizontal: 'right', wrapText: true };
      } else {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      }

      if (colNumber === 7) {
        cell.font = {
          name: 'Calibri',
          size: 10,
          bold: true,
          color: { argb: s.status === 'Accepted' ? 'FF059669' : s.status === 'Rejected' ? 'FFDC2626' : 'FFD97706' }
        };
      }
    });
  });

  // Column Widths for Sheet 1
  ws1.columns = [
    { width: 6 },   // #
    { width: 26 },  // Member Name
    { width: 16 },  // Code
    { width: 18 },  // Committee
    { width: 22 },  // Department
    { width: 22 },  // Submitted At
    { width: 18 },  // Status
    { width: 14 },  // Grade
    { width: 24 },  // Evaluator
    { width: 34 },  // Criteria
    { width: 38 },  // Leader Feedback
    { width: 30 },  // File
  ];

  // Generate buffer and return
  const buffer = await workbook.xlsx.writeBuffer();
  return { buffer, filename: outFilename };
};