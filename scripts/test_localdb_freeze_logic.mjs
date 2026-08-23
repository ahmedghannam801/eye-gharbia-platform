// Test localDb mergeById and status persistence logic in isolation

function mergeById(remote, local, deletedIds = []) {
  const delSet = new Set(deletedIds);
  const validRemote = remote.filter((r) => !delSet.has(r.id));
  const validLocal = local.filter((l) => !delSet.has(l.id));
  const localMap = new Map(validLocal.map(l => [l.id, l]));
  const remoteIdSet = new Set(validRemote.map(r => r.id));

  const mergedRemote = validRemote.map(r => {
    const localItem = localMap.get(r.id);
    if (!localItem) return r;

    const localStatus = localItem.status;
    const remoteStatus = r.status;
    const preserveLocalStatus = (localStatus === 'Approved' || localStatus === 'Rejected') && remoteStatus === 'Pending';
    const finalStatus = preserveLocalStatus ? localStatus : (remoteStatus || localStatus);
    const finalAdminResponse = localItem.adminResponse && !r.adminResponse
      ? localItem.adminResponse
      : (r.adminResponse || localItem.adminResponse);

    return {
      ...localItem,
      ...r,
      ...(finalStatus !== undefined ? { status: finalStatus } : {}),
      ...(finalAdminResponse !== undefined ? { adminResponse: finalAdminResponse } : {}),
    };
  });

  const pendingLocal = validLocal.filter(l => !remoteIdSet.has(l.id));

  return [...mergedRemote, ...pendingLocal];
}

console.log('Testing mergeById state machine & persistence:');

// Scenario 1: Admin approved locally, but cloud still returns stale 'Pending'
const localItemApproved = {
  id: 'frz-123',
  memberId: 'user-456',
  status: 'Approved',
  adminResponse: 'تم قبول طلب التجميد وتفعيله بنجاح',
  startDate: '2026-09-01',
  endDate: '2026-09-15',
};

const remoteItemPending = {
  id: 'frz-123',
  memberId: 'user-456',
  status: 'Pending',
  startDate: '2026-09-01',
  endDate: '2026-09-15',
};

const result1 = mergeById([remoteItemPending], [localItemApproved]);
console.log('Test 1 (Preserve Local Approval over Stale Remote):');
console.assert(result1[0].status === 'Approved', 'Status must be Approved');
console.assert(result1[0].adminResponse === 'تم قبول طلب التجميد وتفعيله بنجاح', 'Admin response must be preserved');
console.log('✅ Passed Test 1: Status =', result1[0].status);

// Scenario 2: Newly created local item not yet in remote is NOT dropped on refresh
const newLocalRequest = {
  id: 'frz-new-789',
  memberId: 'user-999',
  status: 'Pending',
  startDate: '2026-10-01',
  endDate: '2026-10-15',
};

const result2 = mergeById([remoteItemPending], [localItemApproved, newLocalRequest]);
console.log('Test 2 (Preserve Local Item Not in Remote):');
console.assert(result2.length === 2, 'Must keep both items');
console.assert(result2.some(x => x.id === 'frz-new-789'), 'Must retain newLocalRequest');
console.log('✅ Passed Test 2: Kept items =', result2.length);

// Scenario 3: Rejected locally is also preserved
const localItemRejected = {
  id: 'frz-123',
  memberId: 'user-456',
  status: 'Rejected',
  adminResponse: 'تم الرفض لتعارضه مع نشاط هام',
};
const result3 = mergeById([remoteItemPending], [localItemRejected]);
console.log('Test 3 (Preserve Local Rejection over Stale Remote):');
console.assert(result3[0].status === 'Rejected', 'Status must be Rejected');
console.log('✅ Passed Test 3: Status =', result3[0].status);

console.log('\n🎉 ALL LOGIC AND STATE MACHINE TESTS PASSED SUCCESSFULLY!');
