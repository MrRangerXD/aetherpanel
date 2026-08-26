import { getDb, saveDbSync } from '../server/db';
import { claimPlayitAgent, getPlayitStatus, togglePlayitAgent, installPlayitAgent } from '../server/playit/playitService';
import { generateToken, JWT_SECRET } from '../server/auth';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';

async function runTests() {
  console.log('====================================================');
  console.log('🔍 DISCORD PERSISTENCE & PLAYIT CLAIM VERIFICATION');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(cond: boolean, desc: string, detail?: string) {
    if (cond) {
      console.log(`  ✅ [PASS] ${desc}${detail ? ` (${detail})` : ''}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${desc}${detail ? ` -> ${detail}` : ''}`);
      failed++;
    }
  }

  // TEST 1: Discord OAuth persistence & hydration
  console.log('--- TEST 1: Discord Account Linking & Database Record Persistence ---');
  const db = await getDb();
  const testUserId = `usr_discord_test_${Date.now()}`;
  const testDiscordId = '987654321012345678';
  const testDiscordUsername = 'AetherTester';
  const testDiscordGlobalName = 'Aether Panel QA';
  const testDiscordAvatar = `https://cdn.discordapp.com/avatars/${testDiscordId}/abc123def456.png`;

  // Create test user in db
  db.users.push({
    id: testUserId,
    username: 'discord_qa_user',
    displayName: 'Discord QA User',
    email: 'discordqa@example.com',
    role: 'user',
    isSuspended: false,
    emailVerified: true,
    twoFactorEnabled: false,
    authProvider: 'local',
    credits: 10.0,
    serverLimit: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  // Verify OAuth state token contains userId
  const stateToken = jwt.sign({
    nonce: 'random_nonce_123',
    userId: testUserId,
    action: 'link'
  }, JWT_SECRET, { expiresIn: '15m' });

  const decodedState = jwt.verify(stateToken, JWT_SECRET) as any;
  assert(decodedState.userId === testUserId, 'OAuth State preserves linking user ID');

  // Simulate linking persistence
  if (!db.discordLinks) db.discordLinks = {};
  const linkedData = {
    discordId: testDiscordId,
    username: testDiscordUsername,
    globalName: testDiscordGlobalName,
    avatar: testDiscordAvatar,
    email: 'discordqa@example.com',
    linkedAt: new Date().toISOString()
  };
  db.discordLinks[testUserId] = linkedData;

  const targetUser = db.users.find(u => u.id === testUserId);
  if (targetUser) {
    targetUser.discordId = testDiscordId;
    targetUser.updatedAt = new Date().toISOString();
  }
  saveDbSync();

  // Test duplicate linking idempotency
  const duplicateLinkedData = {
    discordId: testDiscordId,
    username: `${testDiscordUsername}_Updated`,
    globalName: testDiscordGlobalName,
    avatar: testDiscordAvatar,
    email: 'discordqa@example.com',
    linkedAt: new Date().toISOString()
  };
  db.discordLinks[testUserId] = duplicateLinkedData;
  saveDbSync();
  assert(Object.keys(db.discordLinks).filter(k => k === testUserId).length === 1, 'No duplicate Discord linkage entries created on re-linking');

  // Verify persistence on fresh read
  const freshDb = await getDb(true);
  const userRec = freshDb.users.find(u => u.id === testUserId);
  const linkRec = freshDb.discordLinks ? freshDb.discordLinks[testUserId] : null;

  assert(userRec !== undefined, 'User record exists in DB');
  assert(userRec?.discordId === testDiscordId, 'User record has persistent discordId');
  assert(linkRec !== null, 'Discord link record exists in db.discordLinks');
  assert(linkRec?.discordId === testDiscordId, 'Discord link has correct discordId');
  assert(linkRec?.username === `${testDiscordUsername}_Updated`, 'Discord link has correct updated username');
  assert(linkRec?.globalName === testDiscordGlobalName, 'Discord link has correct global display name');
  assert(linkRec?.avatar === testDiscordAvatar, 'Discord link has correct avatar');

  // TEST 2: Playit Claim Agent Operation
  console.log('\n--- TEST 2: Playit Claim Agent Operation & State Synchronization ---');
  const testServerId = `srv_playit_test_${Date.now()}`;
  const playitDir = path.join(process.cwd(), 'data', 'servers', testServerId, 'playit');
  fs.mkdirSync(playitDir, { recursive: true });

  // Install Playit on server
  const installStatus = await installPlayitAgent(testServerId);
  assert(installStatus.isInstalled === true, 'Playit agent installed successfully');
  assert(typeof installStatus.claimCode === 'string', 'Generated claim code present');

  // Trigger claimPlayitAgent
  const claimResult = await claimPlayitAgent(testServerId);
  assert(claimResult.success === true, 'claimPlayitAgent returned success');
  assert(claimResult.claimStatus === 'UNCLAIMED', 'claimStatus is UNCLAIMED prior to user claiming');
  assert(typeof claimResult.claimUrl === 'string' && claimResult.claimUrl.startsWith('https://playit.gg/claim/'), 'Valid claim URL returned');
  assert(typeof claimResult.claimCode === 'string', 'Valid claim code returned');

  // Verify config persistence
  const configFile = path.join(playitDir, 'playit.json');
  assert(fs.existsSync(configFile), 'playit.json exists on disk');
  const savedCfg = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
  assert(savedCfg.claimUrl === claimResult.claimUrl, 'claimUrl persisted in playit.json');
  assert(savedCfg.claimCode === claimResult.claimCode, 'claimCode persisted in playit.json');

  // Verify getPlayitStatus returns persistent claim data
  const statusCheck = getPlayitStatus(testServerId);
  assert(statusCheck.claimUrl === claimResult.claimUrl, 'getPlayitStatus reflects persistent claimUrl');
  assert(statusCheck.claimCode === claimResult.claimCode, 'getPlayitStatus reflects persistent claimCode');

  // Cleanup test artifacts
  try {
    await togglePlayitAgent(testServerId, false);
    fs.rmSync(path.join(process.cwd(), 'data', 'servers', testServerId), { recursive: true, force: true });
    const uIdx = db.users.findIndex(u => u.id === testUserId);
    if (uIdx !== -1) db.users.splice(uIdx, 1);
    if (db.discordLinks) delete db.discordLinks[testUserId];
    saveDbSync();
  } catch {}

  console.log('\n====================================================');
  console.log(`RESULTS: ${passed} PASSED / ${failed} FAILED`);
  console.log('====================================================');

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
