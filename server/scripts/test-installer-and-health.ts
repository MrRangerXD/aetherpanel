import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { discoverJavaBinaries, checkJavaRuntime, getRecommendedJavaVersion } from '../minecraftService';
import { getDb } from '../db';

async function runVerification() {
  console.log('====================================================');
  console.log(' AETHERPANEL END-TO-END PRD VERIFICATION TEST PASS  ');
  console.log('====================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    total++;
    if (condition) {
      passed++;
      console.log(`[PASS] ${testName}${detail ? ` - ${detail}` : ''}`);
    } else {
      console.error(`[FAIL] ${testName}${detail ? ` - ${detail}` : ''}`);
      throw new Error(`Assertion failed: ${testName}`);
    }
  }

  // TEST 1: Installer Script Execution & Syntax Validation
  console.log('\n--- 1. Testing install.sh syntax & CLI flags ---');
  const installShPath = path.join(process.cwd(), 'install.sh');
  assert(fs.existsSync(installShPath), 'install.sh exists');

  // Verify bash syntax check: bash -n install.sh
  try {
    execSync(`bash -n "${installShPath}"`, { stdio: 'pipe' });
    assert(true, 'install.sh passes bash syntax linting (bash -n)');
  } catch (err: any) {
    assert(false, 'install.sh passes bash syntax linting', err.message);
  }

  // Verify CLI --help execution
  try {
    const helpOut = execSync(`bash "${installShPath}" --help`, { encoding: 'utf8' });
    assert(helpOut.includes('AetherPanel Universal Cross-Platform Installer CLI Usage'), 'install.sh --help outputs usage documentation');
  } catch (err: any) {
    assert(false, 'install.sh --help execution', err.message);
  }

  // Verify CLI --repair / diagnostics execution
  try {
    const diagOut = execSync(`bash "${installShPath}" --repair`, { encoding: 'utf8' });
    assert(diagOut.includes('SYSTEM HEALTH DIAGNOSTICS'), 'install.sh --repair outputs diagnostic matrix');
    assert(diagOut.includes('Node.js Engine'), 'Diagnostics matrix includes Node.js Engine');
    assert(diagOut.includes('Managed Process Mode'), 'Diagnostics matrix includes Managed Process Mode');
  } catch (err: any) {
    assert(false, 'install.sh --repair execution', err.message);
  }

  // TEST 2: Java Runtime Discovery & Version Compatibility
  console.log('\n--- 2. Testing Java Runtime Discovery Engine ---');
  const runtimes = discoverJavaBinaries();
  console.log('Detected Java Runtimes:', runtimes);
  assert(typeof runtimes === 'object', 'discoverJavaBinaries returns runtime map');
  assert(runtimes[21]?.available === true || runtimes[17]?.available === true || runtimes[25]?.available === true || runtimes[8]?.available === true, 'At least one Java version is detected or available');

  const checkRes = checkJavaRuntime(21);
  assert(typeof checkRes.available === 'boolean', 'checkJavaRuntime(21) returns boolean availability');

  const paperRec = getRecommendedJavaVersion('26.2');
  assert(paperRec === 25, 'Paper 26.x mapped to Java 25');
  const mc121Rec = getRecommendedJavaVersion('1.21.4');
  assert(mc121Rec === 21, 'Minecraft 1.21.4 mapped to Java 21');
  const mc120Rec = getRecommendedJavaVersion('1.20.4');
  assert(mc120Rec === 17, 'Minecraft 1.20.4 mapped to Java 17');
  const mc116Rec = getRecommendedJavaVersion('1.16.5');
  assert(mc116Rec === 11, 'Minecraft 1.16.5 mapped to Java 11');

  // TEST 3: Database and Storage Initialization
  console.log('\n--- 3. Testing Database & Storage Layer ---');
  const db = await getDb();
  assert(Array.isArray(db.users), 'db.users is an array');
  assert(Array.isArray(db.servers), 'db.servers is an array');
  assert(Array.isArray(db.nodes), 'db.nodes is an array');
  assert(typeof db.settings === 'object', 'db.settings is an object');

  // TEST 4: Package.json and Build Scripts
  console.log('\n--- 4. Testing Build Scripts & Dependencies ---');
  const pkgJsonPath = path.join(process.cwd(), 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
  assert(pkg.scripts?.build?.includes('vite build'), 'package.json build script contains vite build');
  assert(pkg.scripts?.start?.includes('dist/server.cjs'), 'package.json start script points to dist/server.cjs');

  console.log(`\n====================================================`);
  console.log(`  ALL ${passed}/${total} PRD VERIFICATION TESTS PASSED!`);
  console.log(`====================================================\n`);
}

runVerification().catch((err) => {
  console.error('Test run failed:', err);
  process.exit(1);
});
