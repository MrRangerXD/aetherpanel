const BASE_URL = 'http://localhost:3000/api/v1';

async function runStartupTests() {
  console.log('====================================================');
  console.log('STARTING AETHERPANEL STARTUP & RESOURCE ENFORCEMENT TESTS');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      if (detail) console.log(`   └─ ${detail}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}`);
      if (detail) console.error(`   └─ ${detail}`);
      failed++;
    }
  }

  let userToken = '';
  let adminToken = '';
  let userEmail = `sec_user_${Date.now()}@aetherpanel.com`;

  try {
    // 1. Register test user
    const regRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: `secuser_${Date.now().toString(36)}`,
        displayName: 'Security Test User',
        email: userEmail,
        password: 'UserPassword123!',
        agreedToTerms: true
      })
    });
    const regData = await regRes.json();
    if (regData.success) {
      userToken = regData.data.token;
    } else {
      // If user exists, login
      const loginRes = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail, password: 'UserPassword123!' })
      });
      const loginData = await loginRes.json();
      userToken = loginData.data.token;
    }

    // 2. Login as admin
    const adminLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@aetherpanel.in', password: 'adminopp' })
    });
    const adminLoginData = await adminLoginRes.json();
    if (adminLoginData.success) {
      adminToken = adminLoginData.data.token;
    } else {
      console.error('Admin login failed:', adminLoginData);
      process.exit(1);
    }
  } catch (err: any) {
    console.error('Auth setup failed:', err.message);
    process.exit(1);
  }

  const userHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` };
  const adminHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` };

  // TEST 1: Free Node.js Server Setup & Memory Flag Verification
  let freeServerId = '';
  try {
    const deployRes = await fetch(`${BASE_URL}/deploy/create`, {
      method: 'POST',
      headers: userHeaders,
      body: JSON.stringify({
        name: 'Free Node Security Test Server',
        planId: 'plan_bot_free',
        hostingCategory: 'bot',
        software: 'Node.js Bot',
        version: '20.x',
        agreedToTerms: true
      })
    });

    const deployData = await deployRes.json();
    if (!deployData.success) {
      throw new Error(deployData.error?.message || JSON.stringify(deployData));
    }
    const server = deployData.data.server;
    freeServerId = server.id;

    assert(
      server.limits.ramMB === 512 && server.limits.cpuCores === 0.5 && server.limits.diskGB === 5,
      'Test 1a: Free Node.js server receives exact Free Plan limits (512MB RAM, 0.5 CPU, 5GB Disk)',
      `Actual: RAM=${server.limits.ramMB}MB, CPU=${server.limits.cpuCores}, Disk=${server.limits.diskGB}GB`
    );

    const compiled = server.startup?.compiledCommand || '';
    assert(
      compiled.includes('--max-old-space-size=512'),
      'Test 1b: Node.js startup command contains --max-old-space-size=512',
      `Compiled command: ${compiled}`
    );
  } catch (err: any) {
    assert(false, 'Test 1: Free Node.js server setup', err.message);
  }

  // TEST 2: API Manipulation Attempt (Read-Only Resource Enforcement)
  if (freeServerId) {
    try {
      const patchRes = await fetch(`${BASE_URL}/servers/${freeServerId}`, {
        method: 'PATCH',
        headers: userHeaders,
        body: JSON.stringify({
          limits: { ramMB: 8192, cpuCores: 8.0, diskGB: 200 },
          memory: 8192,
          ramMB: 8192
        })
      });

      const patchData = await patchRes.json();
      const updatedServer = patchData.data.server;
      assert(
        updatedServer.limits.ramMB === 512 && updatedServer.limits.cpuCores === 0.5,
        'Test 2: Normal user API manipulation attempt to increase limits is blocked/ignored',
        `Retained Limits: RAM=${updatedServer.limits.ramMB}MB, CPU=${updatedServer.limits.cpuCores}`
      );
    } catch (err: any) {
      assert(false, 'Test 2: API manipulation attempt', err.message);
    }
  }

  // TEST 3: Arbitrary Command Injection Attempt
  if (freeServerId) {
    try {
      const patchRes = await fetch(`${BASE_URL}/servers/${freeServerId}`, {
        method: 'PATCH',
        headers: userHeaders,
        body: JSON.stringify({
          startup: {
            pythonExecutable: 'bash',
            customFlags: '; echo HACKED ;',
            nodeOptions: '--max-old-space-size=8192'
          }
        })
      });

      const patchData = await patchRes.json();
      const updatedServer = patchData.data.server;
      const compiled = updatedServer.startup.compiledCommand || '';

      assert(
        !compiled.includes('bash') && !compiled.includes(';') && !compiled.includes('--max-old-space-size=8192'),
        'Test 3: Arbitrary command & memory override injection is stripped/prevented',
        `Compiled Command: ${compiled}`
      );
    } catch (err: any) {
      assert(false, 'Test 3: Arbitrary command injection attempt', err.message);
    }
  }

  // TEST 4: Entrypoint Path Traversal Attempt
  if (freeServerId) {
    try {
      const patchRes = await fetch(`${BASE_URL}/servers/${freeServerId}`, {
        method: 'PATCH',
        headers: userHeaders,
        body: JSON.stringify({
          startup: { entryFile: '../../etc/passwd' }
        })
      });

      const patchData = await patchRes.json();

      if (patchRes.status === 400 && patchData.error?.code === 'INVALID_ENTRYPOINT') {
        assert(
          true,
          'Test 4: Path traversal attempt (../../etc/passwd) rejected with HTTP 400 INVALID_ENTRYPOINT',
          `HTTP ${patchRes.status} - ${patchData.error?.message}`
        );
      } else {
        assert(false, 'Test 4: Entrypoint path traversal should have been rejected with 400', `Got ${patchRes.status}: ${JSON.stringify(patchData)}`);
      }
    } catch (err: any) {
      assert(false, 'Test 4: Path traversal attempt error', err.message);
    }
  }

  // TEST 5: Deployment vs Startup Settings Consistency
  if (freeServerId) {
    try {
      const putRes = await fetch(`${BASE_URL}/servers/${freeServerId}/startup`, {
        method: 'PUT',
        headers: userHeaders,
        body: JSON.stringify({
          software: 'Node.js Bot',
          version: '20.x',
          entryFile: 'app/server.js'
        })
      });

      const putData = await putRes.json();
      const server = putData.data;
      const compiled = server.startup?.compiledCommand || '';

      assert(
        compiled.includes('node --max-old-space-size=512') && compiled.endsWith('app/server.js'),
        'Test 5: Startup settings sync correctly updates compiled command with normalized entrypoint',
        `Compiled Command: ${compiled}`
      );
    } catch (err: any) {
      assert(false, 'Test 5: Deployment vs startup settings consistency', err.message);
    }
  }

  // TEST 6: Admin Custom Server Verification
  try {
    const adminCreateRes = await fetch(`${BASE_URL}/admin/servers/create`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        userEmail: userEmail,
        name: 'Admin Provisioned Premium Server',
        hostingCategory: 'bot',
        software: 'Node.js Bot',
        version: '22.x',
        ramMB: 4096,
        cpuCores: 2.0,
        diskGB: 20
      })
    });

    const adminData = await adminCreateRes.json();
    const createdServer = adminData.data?.server || adminData.data;

    assert(
      createdServer?.limits?.ramMB === 4096 && createdServer?.isAdminCreated === true,
      'Test 6a: Admin-created server retains exact custom 4096 MB allocation and isAdminCreated flag',
      `RAM=${createdServer?.limits?.ramMB}MB, isAdminCreated=${createdServer?.isAdminCreated}`
    );

    const compiled = createdServer?.startup?.compiledCommand || '';
    assert(
      compiled.includes('--max-old-space-size=4096'),
      'Test 6b: Admin-created server generates startup command matching its custom 4096 MB allocation',
      `Compiled Command: ${compiled}`
    );
  } catch (err: any) {
    assert(false, 'Test 6: Admin custom server verification', err.message);
  }

  console.log('\n====================================================');
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runStartupTests();
