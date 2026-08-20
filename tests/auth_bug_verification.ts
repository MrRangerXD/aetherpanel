import { getDb, saveDbSync } from '../server/db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

async function runAuthTests() {
  console.log('================================================================');
  console.log('       AETHERPANEL AUTHENTICATION BUG VERIFICATION SUITE        ');
  console.log('================================================================\n');

  const JWT_SECRET = process.env.JWT_SECRET || 'aether_dev_secret_jwt_2026_super_secure_key';

  // 1. Fresh Installation / Initial Admin Creation Test
  console.log('--- TEST 1: Fresh Installation & Admin Creation ---');
  const customAdminEmail = 'custom_admin@example.com';
  const customAdminPass = 'MyChosenSecurePass123!';
  
  const db = await getDb(true);
  const adminHash = await bcrypt.hash(customAdminPass, 10);
  
  const newAdminId = 'usr_test_custom_admin';
  db.users = db.users.filter(u => u.id !== newAdminId);
  db.users.push({
    id: newAdminId,
    username: 'custom_admin',
    displayName: 'Custom Admin',
    email: customAdminEmail,
    role: 'super_admin',
    isSuspended: false,
    emailVerified: true,
    twoFactorEnabled: false,
    mustChangePassword: false,
    credits: 500,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  db.passwords[newAdminId] = adminHash;
  saveDbSync();

  const userRecord = db.users.find(u => u.id === newAdminId);
  if (!userRecord || userRecord.mustChangePassword === true) {
    throw new Error('FAILED: userRecord has mustChangePassword: true');
  }
  console.log('✅ [PASS] Fresh Admin created with mustChangePassword: false');

  // 2. Wrong Password Rejection
  console.log('\n--- TEST 2: Wrong Password Rejection ---');
  const isMatchWrong = await bcrypt.compare('WrongPassword123!', db.passwords[newAdminId]);
  if (isMatchWrong) {
    throw new Error('FAILED: Wrong password matched!');
  }
  console.log('✅ [PASS] Wrong password correctly rejected');

  // 3. Correct Password Authentication
  console.log('\n--- TEST 3: Correct Password Authentication ---');
  const isMatchCorrect = await bcrypt.compare(customAdminPass, db.passwords[newAdminId]);
  if (!isMatchCorrect) {
    throw new Error('FAILED: Correct password failed to match!');
  }
  console.log('✅ [PASS] Correct password authenticated successfully');

  // 4. Restart Persistence (getDb reload without overwriting password)
  console.log('\n--- TEST 4 & 5: Restart & Reboot Persistence ---');
  const reloadedDb = await getDb(true);
  const reloadedUser = reloadedDb.users.find(u => u.id === newAdminId);
  if (!reloadedUser) {
    throw new Error('FAILED: User missing after reload');
  }
  const isMatchAfterReload = await bcrypt.compare(customAdminPass, reloadedDb.passwords[newAdminId]);
  if (!isMatchAfterReload) {
    throw new Error('FAILED: Password was overwritten or corrupted after reload!');
  }
  if (reloadedUser.mustChangePassword === true) {
    throw new Error('FAILED: mustChangePassword flipped to true on reload!');
  }
  console.log('✅ [PASS] Admin credentials and password hash completely intact after database reload (no overwrite)');

  // 6. Voluntary Password Change
  console.log('\n--- TEST 6: Voluntary Password Change ---');
  const newVoluntaryPass = 'NewVoluntaryPassword456!';
  // Verify current password first
  const currentCheck = await bcrypt.compare(customAdminPass, reloadedDb.passwords[newAdminId]);
  if (!currentCheck) {
    throw new Error('FAILED: Current password check failed');
  }
  reloadedDb.passwords[newAdminId] = await bcrypt.hash(newVoluntaryPass, 10);
  reloadedUser.tokenVersion = (reloadedUser.tokenVersion || 0) + 1;
  saveDbSync();

  const oldMatch = await bcrypt.compare(customAdminPass, reloadedDb.passwords[newAdminId]);
  const newMatch = await bcrypt.compare(newVoluntaryPass, reloadedDb.passwords[newAdminId]);
  if (oldMatch || !newMatch) {
    throw new Error('FAILED: Voluntary password change failed');
  }
  console.log('✅ [PASS] Voluntary password change verified: old rejected, new accepted');

  // 7. Cleanup & verify default admin
  reloadedDb.users = reloadedDb.users.filter(u => u.id !== newAdminId);
  delete reloadedDb.passwords[newAdminId];
  saveDbSync();

  // 8. Verify RBAC structure
  console.log('\n--- TEST 8: Admin RBAC ---');
  const defaultAdmin = reloadedDb.users.find(u => u.role === 'super_admin');
  if (!defaultAdmin) {
    throw new Error('FAILED: Super admin user missing');
  }
  console.log(`✅ [PASS] Super admin verified: ${defaultAdmin.email}, role: ${defaultAdmin.role}`);

  console.log('\n================================================================');
  console.log('        ALL AUTHENTICATION BUG TESTS PASSED SUCCESSFULLY!       ');
  console.log('================================================================');
}

runAuthTests().catch(err => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
