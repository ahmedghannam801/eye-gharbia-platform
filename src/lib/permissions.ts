import { UserProfile, MonthlyPerformance } from '../types';

/**
 * Role-Based Access Control (RBAC) & Committee Permission Engine
 * 
 * Rules:
 * 1. Super Admin / Head (رئيس) / Vice (نائب) / HRM: Highest administrative tier.
 *    Full unrestricted access to all committees, members, evaluations, tasks, reports,
 *    settings, edit & delete capabilities, and statistics.
 * 2. HR Leader: Scoped strictly to their assigned committee.
 * 3. Member: Scoped to their own data and general public committee resources.
 */

export const ADMIN_ROLES = ['Super Admin', 'Head', 'Vice', 'Coordinator', 'Deputy Coordinator', 'HRM'];
export const LEADERSHIP_ROLES = ['Super Admin', 'Head', 'Vice', 'Coordinator', 'Deputy Coordinator', 'HRM'];

export const isLeadershipRole = (role?: string): boolean => {
  if (!role) return false;
  return LEADERSHIP_ROLES.includes(role);
};

/**
 * Returns true if user has top-level administrative permissions (Super Admin, Head, Vice, Coordinator, Deputy Coordinator, or HRM)
 */
export const isAdminUser = (user: Partial<UserProfile> | null | undefined): boolean => {
  if (!user || !user.role) return false;
  return ADMIN_ROLES.includes(user.role) || isHRVice(user);
};

/**
 * Normalizes committee names for comparison (handles department mappings like 'HRM - HR OF OR' -> 'OR')
 */
export const getEffectiveCommittee = (user: Partial<UserProfile> | null | undefined): string => {
  if (!user) return 'None';
  if (user.role === 'Super Admin' || user.role === 'Head' || user.role === 'Vice') return 'All';

  const dept = (user.department || '').toUpperCase();
  const subComm = ((user as any).subCommittee || '').toUpperCase();

  // Check sub-committee or department mapping first (e.g. 'HR OF OR' -> 'OR', 'HR OF PR' -> 'PR', 'HR OF SM' -> 'SM', 'HR OF MEDIA' -> 'Media', 'HR OF HR' -> 'HR')
  if (subComm.includes('HR OF OR') || dept.includes('HR OF OR')) return 'OR';
  if (subComm.includes('HR OF PR') || dept.includes('HR OF PR')) return 'PR';
  if (subComm.includes('HR OF SM') || dept.includes('HR OF SM')) return 'SM';
  if (subComm.includes('HR OF MEDIA') || dept.includes('HR OF MEDIA')) return 'Media';
  if (subComm.includes('HR OF HR') || dept.includes('HR OF HR')) return 'HR';

  // General HRM without sub-committee applies to All
  if (user.role === 'HRM') return 'All';

  if (user.committee === 'OR') return 'OR';
  if (user.committee === 'PR') return 'PR';
  if (user.committee === 'SM') return 'SM';
  if (user.committee === 'Media') return 'Media';
  if (user.committee === 'HR') return 'HR';

  return user.committee || 'None';
};

export const isHRVice = (user: Partial<UserProfile> | null | undefined): boolean => {
  if (!user) return false;
  return user.role === 'Vice' && (user.committee === 'HR' || (user.department || '').includes('HR'));
};

export const isCentralHR = (_user: Partial<UserProfile> | null | undefined): boolean => {
  return false;
};

/**
 * Returns true if the user has HRM / Super Admin / Head / Vice administrative privileges
 */
export const isHRM = (user: Partial<UserProfile> | null | undefined): boolean => {
  return isAdminUser(user);
};

/**
 * Returns true if the user is a Leader or Coordinator for a given committee (or Admin tier)
 */
export const isCommitteeLeader = (user: UserProfile | null | undefined, committee?: string): boolean => {
  if (!user) return false;
  if (isAdminUser(user)) return true;

  const isLeaderRole = user.role === 'Leader' || user.role === 'Head' || user.role === 'Vice' || user.role === 'Coordinator' || user.role === 'Deputy Coordinator';
  if (!isLeaderRole) return false;

  if (!committee) return true;
  const effectiveComm = getEffectiveCommittee(user);
  return effectiveComm === committee || user.committee === committee;
};

/**
 * Checks if current user can view a target member profile
 */
export const canViewMember = (currentUser: UserProfile | null | undefined, targetMember: UserProfile): boolean => {
  if (!currentUser || !targetMember) return false;
  if (isAdminUser(currentUser)) return true;
  if (currentUser.id === targetMember.id) return true;

  const currentUserComm = getEffectiveCommittee(currentUser);
  const targetComm = getEffectiveCommittee(targetMember);

  if (currentUserComm === 'All') return true;

  const isLeaderRole = currentUser.role === 'Leader' || currentUser.role === 'Vice' || currentUser.role === 'Head' || currentUser.role === 'Coordinator' || currentUser.role === 'Deputy Coordinator' || currentUser.role === 'HRM';
  if (isLeaderRole) {
    return currentUserComm === targetComm || currentUser.committee === targetMember.committee;
  }

  return currentUserComm === targetComm;
};

/**
 * Checks if current user can edit or manage a target member profile
 */
export const canManageMember = (currentUser: UserProfile | null | undefined, targetMember: UserProfile): boolean => {
  if (!currentUser || !targetMember) return false;
  if (isAdminUser(currentUser)) return true;

  const currentUserComm = getEffectiveCommittee(currentUser);
  const targetComm = getEffectiveCommittee(targetMember);

  if (currentUserComm === 'All') return true;

  const isLeaderRole = currentUser.role === 'Leader' || currentUser.role === 'Vice' || currentUser.role === 'Head' || currentUser.role === 'Coordinator' || currentUser.role === 'Deputy Coordinator' || currentUser.role === 'HRM';
  if (isLeaderRole) {
    return (currentUserComm === targetComm || currentUser.committee === targetMember.committee);
  }

  return false;
};

/**
 * Returns the specific target committee assigned to an HRM sub-committee member (e.g. 'HR OF PR' -> 'PR')
 */
export const getHRAssignedCommittee = (user: Partial<UserProfile> | null | undefined): string | null => {
  if (!user) return null;
  const dept = (user.department || '').toUpperCase();
  const subComm = ((user as any).subCommittee || '').toUpperCase();

  if (subComm.includes('HR OF PR') || dept.includes('HR OF PR') || dept.includes('العلاقات العامة')) return 'PR';
  if (subComm.includes('HR OF SM') || dept.includes('HR OF SM') || dept.includes('السوشيال ميديا') || dept.includes('سوشيال')) return 'SM';
  if (subComm.includes('HR OF OR') || dept.includes('HR OF OR') || dept.includes('التنظيم') || dept.includes('تنظيم')) return 'OR';
  if (subComm.includes('HR OF MEDIA') || dept.includes('HR OF MEDIA') || dept.includes('الميديا')) return 'Media';
  if (subComm.includes('HR OF HR') || dept.includes('HR OF HR')) return 'HR';

  const match = (subComm + ' ' + dept).match(/HR\s+OF\s+([A-Za-z0-9_-]+)/i);
  if (match) return match[1].toUpperCase();

  return null;
};

/**
 * Returns true if the user is an HR member, HR Leader, HRM, or executive admin.
 */
export const isHRMemberOrLeader = (user: Partial<UserProfile> | null | undefined): boolean => {
  if (!user) return false;
  if (isAdminUser(user)) return true;
  if (user.role === 'HRM') return true;
  const comm = (user.committee || '').toUpperCase();
  const dept = (user.department || '').toUpperCase();
  const subComm = ((user as any).subCommittee || '').toUpperCase();
  return comm === 'HR' || comm === 'HRM' || dept.includes('HR') || subComm.includes('HR');
};

/**
 * Checks if current user can evaluate a target member.
 * STRICT RULE: Evaluations are exclusively restricted to HR members/leaders and Executive Admins.
 * Non-HR members and non-HR leaders can ONLY view evaluations (Read-Only).
 * - HR Sub-Committee officers (e.g. HR OF PR) evaluate their assigned committee members.
 * - HR Leaders evaluate their HR members.
 * - Executive Leadership / General HRM evaluate across all committees.
 */
export const canEvaluateMember = (currentUser: UserProfile | null | undefined, targetMember: UserProfile): boolean => {
  if (!currentUser || !targetMember) return false;
  if (currentUser.id === targetMember.id) return false; // cannot self-evaluate
  if (isLeadershipRole(targetMember.role)) return false; // Leadership roles are NOT subject to member evaluations

  // Strict Rule: Non-HR users have NO evaluation permissions (View Only)
  if (!isHRMemberOrLeader(currentUser)) {
    return false;
  }

  // 1. Executive Admin Tier (Super Admin, Head, Vice, Coordinator, Deputy Coordinator, General HRM)
  if (isAdminUser(currentUser)) return true;
  if (currentUser.role === 'HRM') return true;

  const hrAssignedComm = getHRAssignedCommittee(currentUser);
  const targetComm = getEffectiveCommittee(targetMember).toUpperCase();
  const targetRawComm = (targetMember.committee || '').toUpperCase();

  // 2. HR Sub-Committee Member / Officer (e.g. HR OF PR evaluates PR, HR OF SM evaluates SM, HR OF OR evaluates OR)
  if (hrAssignedComm) {
    if (targetComm === hrAssignedComm || targetRawComm === hrAssignedComm) {
      return true;
    }
  }

  const isCurrentUserHRLeader = currentUser.role === 'Leader' || currentUser.role === 'Head';
  const isTargetHRMember = isHRMemberOrLeader(targetMember);

  // 3. HR Leaders evaluate HR members in their committee/department
  if (isCurrentUserHRLeader) {
    if (isTargetHRMember || targetRawComm === 'HR' || targetRawComm === 'HRM') {
      const curDept = (currentUser.department || '').toUpperCase();
      const targetDept = (targetMember.department || '').toUpperCase();
      // If HR leader in a specific HR department (e.g. HRD, HRS, HRIS), evaluate HR members in same department or HR general
      if (curDept && curDept !== 'NONE' && curDept !== 'ALL') {
        if (targetDept === curDept || targetDept.includes(curDept) || curDept.includes(targetDept)) {
          return true;
        }
      }
      return true;
    }
  }

  // 4. Regular HR Member evaluates fellow HR members if in HR committee
  if ((currentUser.committee || '').toUpperCase() === 'HR' && (targetRawComm === 'HR' || isTargetHRMember)) {
    return true;
  }

  return false;
};

/**
 * Filters a list of members based on current user's RBAC scope
 */
export const filterMembersByPermission = (currentUser: UserProfile | null | undefined, members: UserProfile[]): UserProfile[] => {
  if (!currentUser) return [];
  const safeMembers = members || [];
  if (isAdminUser(currentUser)) return safeMembers;

  const hrAssignedComm = getHRAssignedCommittee(currentUser);
  if (currentUser.role === 'HRM' && !hrAssignedComm) return safeMembers;

  const userComm = getEffectiveCommittee(currentUser);
  if (userComm === 'All') return safeMembers;

  return safeMembers.filter(m => {
    if (!m) return false;
    if (m.id === currentUser.id) return true;
    const targetComm = getEffectiveCommittee(m);
    if (targetComm === userComm || m.committee === currentUser.committee) return true;
    if (hrAssignedComm && (targetComm.toUpperCase() === hrAssignedComm || m.committee?.toUpperCase() === hrAssignedComm)) {
      return true;
    }
    return false;
  });
};

/**
 * Filters a list of member evaluations based on current user's RBAC scope
 */
export const filterEvaluationsByPermission = <T extends { memberId?: string; committee?: string }>(
  currentUser: UserProfile | null | undefined,
  evaluations: T[],
  membersMap?: Map<string, UserProfile>
): T[] => {
  if (!currentUser) return [];
  const safeEvals = evaluations || [];
  if (isAdminUser(currentUser)) return safeEvals;

  const userComm = getEffectiveCommittee(currentUser);

  return safeEvals.filter(ev => {
    if (!ev) return false;
    if (ev.memberId && membersMap) {
      const member = membersMap.get(ev.memberId);
      if (member) {
        const targetComm = getEffectiveCommittee(member);
        return targetComm === userComm || member.committee === currentUser.committee;
      }
    }
    return ev.committee === userComm || ev.committee === currentUser.committee;
  });
};
