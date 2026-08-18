import fs from 'fs';
import path from 'path';
import readline from 'readline';
import bcrypt from 'bcryptjs';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query: string, hideInput = false): Promise<string> {
  return new Promise((resolve) => {
    if (!hideInput) {
      rl.question(query, (answer) => resolve(answer.trim()));
    } else {
      // Hiding password input in node terminal
      const stdin = process.stdin;
      process.stdout.write(query);
      stdin.resume();
      stdin.setRawMode(true);
      let charBuffer = '';

      const onData = (char: Buffer) => {
        const c = char.toString();
        if (c === '\n' || c === '\r' || c === '\u000d') {
          stdin.setRawMode(false);
          stdin.removeListener('data', onData);
          process.stdout.write('\n');
          resolve(charBuffer.trim());
        } else if (c === '\u0003') { // Ctrl+C
          stdin.setRawMode(false);
          process.exit(1);
        } else if (c === '\u007f' || c === '\b') { // Backspace
          if (charBuffer.length > 0) {
            charBuffer = charBuffer.slice(0, -1);
            // Clear current character on screen
            process.stdout.write('\b \b');
          }
        } else {
          charBuffer += c;
          process.stdout.write('*');
        }
      };

      stdin.on('data', onData);
    }
  });
}

async function main() {
  console.log('\n==================================================');
  console.log('       AETHERPANEL - INTERACTIVE ADMIN CREATOR');
  console.log('==================================================\n');

  if (!fs.existsSync(DB_FILE)) {
    console.error(`[ERROR] Database file not found at: ${DB_FILE}`);
    console.error('Please run the installation first.');
    process.exit(1);
  }

  let db: any;
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    db = JSON.parse(raw);
  } catch (err: any) {
    console.error('[ERROR] Failed to read database:', err.message);
    process.exit(1);
  }

  // Ensure arrays exist
  if (!db.users) db.users = [];
  if (!db.passwords) db.passwords = {};

  const email = await question('Enter Admin Email Address: ');
  if (!email || !email.includes('@')) {
    console.error('[ERROR] Invalid email address.');
    process.exit(1);
  }

  // Check for duplicates
  const isDuplicate = db.users.some((u: any) => u.email.toLowerCase() === email.toLowerCase());
  if (isDuplicate) {
    console.error('[ERROR] A user/administrator with this email already exists.');
    process.exit(1);
  }

  const password = await question('Enter Secure Password: ', true);
  if (password.length < 6) {
    console.error('[ERROR] Password must be at least 6 characters long.');
    process.exit(1);
  }

  const confirmPassword = await question('Confirm Secure Password: ', true);
  if (password !== confirmPassword) {
    console.error('[ERROR] Passwords do not match.');
    process.exit(1);
  }

  const username = email.split('@')[0] || 'admin';
  const userId = 'usr_' + Math.random().toString(36).substr(2, 9);
  
  const passwordHash = await bcrypt.hash(password, 10);

  const newAdmin = {
    id: userId,
    username: username,
    displayName: 'Aether Administrator',
    email: email,
    role: 'super_admin',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    isSuspended: false,
    emailVerified: true,
    twoFactorEnabled: false,
    mustChangePassword: false,
    credits: 1000.0,
    installationId: db.installationId || 'inst_default',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.users.push(newAdmin);
  db.passwords[userId] = passwordHash;

  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
    console.log('\n[✓] Administrator account successfully created and saved.');
    console.log(`    User ID: ${userId}`);
    console.log(`    Username: ${username}`);
    console.log(`    Email: ${email}`);
    console.log(`    Role: super_admin\n`);
  } catch (err: any) {
    console.error('[ERROR] Failed to save database:', err.message);
    process.exit(1);
  }

  rl.close();
}

main().catch((err) => {
  console.error('[FATAL ERROR]', err);
  process.exit(1);
});
