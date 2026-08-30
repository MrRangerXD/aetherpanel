import crypto from 'crypto';
import mysql from 'mysql2/promise';
import { Client as PgClient } from 'pg';
import { getDb, saveDbSync } from '../db';
import { Server, ServerDatabase, DatabaseHost } from '../../src/types';

// Validation Rules
const RESERVED_NAMES = new Set([
  'mysql', 'information_schema', 'performance_schema', 'sys',
  'postgres', 'template0', 'template1', 'admin', 'root', 'test',
  'public', 'system', 'database', 'master', 'model', 'msdb', 'tempdb'
]);

export interface ProviderStatus {
  isConfigured: boolean;
  availableEngines: ('mysql' | 'postgres')[];
  defaultEngine: 'mysql' | 'postgres' | null;
  hosts: { id: string; name: string; dbType: 'mysql' | 'postgres'; host: string; port: number }[];
}

export function validateDatabaseName(name: string): { valid: boolean; error?: string; cleanName?: string } {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'Database name is required.' };
  }
  const trimmed = name.trim();
  if (trimmed.length < 1) {
    return { valid: false, error: 'Database name cannot be empty.' };
  }
  if (trimmed.length > 32) {
    return { valid: false, error: 'Database name must be 32 characters or fewer.' };
  }
  if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
    return { valid: false, error: 'Database name can only contain letters, numbers, and underscores.' };
  }

  const lower = trimmed.toLowerCase();
  if (RESERVED_NAMES.has(lower)) {
    return { valid: false, error: `"${trimmed}" is a reserved system database name and cannot be used.` };
  }

  return { valid: true, cleanName: lower };
}

export function generateSecureDatabasePassword(): string {
  const rawBytes = crypto.randomBytes(16).toString('base64');
  const clean = rawBytes.replace(/[/+=]/g, '').slice(0, 16);
  const specials = ['!', '@', '#', '$', '%', '^', '&', '*'];
  const spec = specials[Math.floor(Math.random() * specials.length)];
  return `${clean}${spec}${Math.floor(100 + Math.random() * 900)}`;
}

export function generateSchemaIdentifier(serverId: string, dbName: string): string {
  const cleanServerId = serverId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12);
  const cleanDbName = dbName.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 24);
  return `s_${cleanServerId}_${cleanDbName}`;
}

export function generateUserIdentifier(serverId: string, dbName: string): string {
  const cleanServerId = serverId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10);
  const cleanDb = dbName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 6);
  return `u_${cleanServerId}_${cleanDb}`;
}

/**
 * Resolves configured Database Host from databaseHosts table or environment variables
 */
export async function resolveDatabaseHost(server?: Server, preferredEngine?: 'mysql' | 'postgres'): Promise<DatabaseHost | null> {
  const db = await getDb();
  const hosts = db.databaseHosts || [];

  // 1. Check explicit database hosts configured in DB
  let matchedHost: DatabaseHost | undefined;

  if (server?.nodeId) {
    matchedHost = hosts.find(h => 
      (!preferredEngine || h.dbType === preferredEngine) && 
      (h.nodeId === server.nodeId || !h.nodeId)
    );
  }

  if (!matchedHost) {
    matchedHost = hosts.find(h => !preferredEngine || h.dbType === preferredEngine);
  }

  if (matchedHost) {
    return matchedHost;
  }

  // 2. Check environment variables
  const mysqlHost = process.env.MYSQL_HOST || process.env.DATABASE_HOST_MYSQL || process.env.DB_HOST;
  const pgHost = process.env.PGHOST || process.env.DATABASE_HOST_POSTGRES || process.env.POSTGRES_HOST;

  if ((!preferredEngine || preferredEngine === 'mysql') && mysqlHost) {
    return {
      id: 'env_mysql_host',
      name: 'Primary MySQL Cluster (Environment)',
      host: mysqlHost,
      port: parseInt(process.env.MYSQL_PORT || '3306', 10),
      username: process.env.MYSQL_USER || process.env.MYSQL_ROOT_USER || 'root',
      password: process.env.MYSQL_PASSWORD || process.env.MYSQL_ROOT_PASSWORD || '',
      dbType: 'mysql',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  if ((!preferredEngine || preferredEngine === 'postgres') && pgHost) {
    return {
      id: 'env_postgres_host',
      name: 'Primary PostgreSQL Cluster (Environment)',
      host: pgHost,
      port: parseInt(process.env.PGPORT || '5432', 10),
      username: process.env.PGUSER || 'postgres',
      password: process.env.PGPASSWORD || '',
      dbType: 'postgres',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  return null;
}

/**
 * Gets the availability of database providers
 */
export async function getProviderStatus(server?: Server): Promise<ProviderStatus> {
  const db = await getDb();
  const hosts = db.databaseHosts || [];
  const availableEngines: ('mysql' | 'postgres')[] = [];

  const mysqlHost = await resolveDatabaseHost(server, 'mysql');
  if (mysqlHost) {
    availableEngines.push('mysql');
  }

  const pgHost = await resolveDatabaseHost(server, 'postgres');
  if (pgHost) {
    availableEngines.push('postgres');
  }

  return {
    isConfigured: availableEngines.length > 0,
    availableEngines,
    defaultEngine: availableEngines.length > 0 ? availableEngines[0] : null,
    hosts: hosts.map(h => ({
      id: h.id,
      name: h.name,
      dbType: h.dbType,
      host: h.host,
      port: h.port
    }))
  };
}

/**
 * Tests connection to a database host
 */
export async function testDatabaseHostConnection(host: DatabaseHost): Promise<{ success: boolean; message?: string }> {
  if (host.dbType === 'mysql') {
    try {
      const conn = await mysql.createConnection({
        host: host.host,
        port: host.port,
        user: host.username,
        password: host.password || '',
        connectTimeout: 5000
      });
      await conn.ping();
      await conn.end();
      return { success: true, message: 'Successfully connected to MySQL host.' };
    } catch (err: any) {
      return { success: false, message: `MySQL connection failed: ${err.message}` };
    }
  } else if (host.dbType === 'postgres') {
    const client = new PgClient({
      host: host.host,
      port: host.port,
      user: host.username,
      password: host.password || '',
      database: 'postgres',
      connectionTimeoutMillis: 5000
    });
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.end();
      return { success: true, message: 'Successfully connected to PostgreSQL host.' };
    } catch (err: any) {
      return { success: false, message: `PostgreSQL connection failed: ${err.message}` };
    }
  }

  return { success: false, message: 'Unsupported database provider engine.' };
}

/**
 * Creates a real database on the configured provider host
 */
export async function createRealDatabase(
  server: Server,
  rawDbName: string,
  requestedEngine?: 'mysql' | 'postgres'
): Promise<ServerDatabase> {
  const val = validateDatabaseName(rawDbName);
  if (!val.valid || !val.cleanName) {
    throw new Error(val.error || 'Invalid database name.');
  }

  const db = await getDb();

  // Check duplicate database name for this server
  const currentDbs = (db.databases || []).filter(d => d.serverId === server.id);
  const cleanName = val.cleanName;
  const schemaName = generateSchemaIdentifier(server.id, cleanName);
  const username = generateUserIdentifier(server.id, cleanName);

  if (currentDbs.some(d => d.name.toLowerCase() === schemaName.toLowerCase())) {
    throw new Error(`A database with the name "${rawDbName}" already exists for this server.`);
  }

  // Resolve target database host
  const targetEngine = requestedEngine || 'mysql';
  const host = await resolveDatabaseHost(server, targetEngine);

  if (!host) {
    throw new Error(
      `Database provider is not configured for ${targetEngine.toUpperCase()}. Please configure a Database Host in Admin Settings or set MYSQL_HOST / PGHOST environment variables.`
    );
  }

  const password = generateSecureDatabasePassword();

  // Execute real database provisioning
  if (host.dbType === 'mysql') {
    let conn: mysql.Connection | null = null;
    try {
      conn = await mysql.createConnection({
        host: host.host,
        port: host.port,
        user: host.username,
        password: host.password || '',
        connectTimeout: 7000
      });

      // 1. Create Schema
      await conn.query(`CREATE DATABASE IF NOT EXISTS \`${schemaName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);

      // 2. Create / update user with restricted access
      // Note: escaping password parameter in SQL
      await conn.query(`CREATE USER IF NOT EXISTS ?@'%' IDENTIFIED BY ?;`, [username, password]);
      await conn.query(`ALTER USER ?@'%' IDENTIFIED BY ?;`, [username, password]);

      // 3. Grant privileges exclusively to this schema
      await conn.query(`GRANT ALL PRIVILEGES ON \`${schemaName}\`.* TO ?@'%';`, [username]);
      await conn.query(`FLUSH PRIVILEGES;`);
    } catch (err: any) {
      throw new Error(`Failed to provision real MySQL database: ${err.message}`);
    } finally {
      if (conn) {
        try { await conn.end(); } catch (_) {}
      }
    }
  } else if (host.dbType === 'postgres') {
    const client = new PgClient({
      host: host.host,
      port: host.port,
      user: host.username,
      password: host.password || '',
      database: 'postgres',
      connectionTimeoutMillis: 7000
    });

    try {
      await client.connect();

      // 1. Create / update role
      const roleCheck = await client.query('SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = $1', [username]);
      if (roleCheck.rows.length === 0) {
        // Create role with safe parameter handling
        await client.query(`CREATE ROLE "${username}" WITH LOGIN PASSWORD $1`, [password]);
      } else {
        await client.query(`ALTER ROLE "${username}" WITH PASSWORD $1`, [password]);
      }

      // 2. Check and create database
      const dbCheck = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [schemaName]);
      if (dbCheck.rows.length === 0) {
        await client.query(`CREATE DATABASE "${schemaName}" OWNER "${username}"`);
      }
      await client.query(`GRANT ALL PRIVILEGES ON DATABASE "${schemaName}" TO "${username}"`);
    } catch (err: any) {
      throw new Error(`Failed to provision real PostgreSQL database: ${err.message}`);
    } finally {
      try { await client.end(); } catch (_) {}
    }
  }

  const connectionUri = host.dbType === 'mysql'
    ? `mysql://${username}:${password}@${host.host}:${host.port}/${schemaName}`
    : `postgresql://${username}:${password}@${host.host}:${host.port}/${schemaName}`;

  const newDatabaseRecord: ServerDatabase = {
    id: `db_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
    installationId: server.installationId,
    serverId: server.id,
    databaseHostId: host.id,
    name: schemaName,
    username,
    password,
    host: host.host,
    port: host.port,
    dbType: host.dbType,
    connectionUri,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  return newDatabaseRecord;
}

/**
 * Rotates the password for an existing real database
 */
export async function rotateRealDatabasePassword(database: ServerDatabase): Promise<{ newPassword: string; connectionUri: string }> {
  const db = await getDb();
  let host = (db.databaseHosts || []).find(h => h.id === database.databaseHostId);
  if (!host) {
    host = await resolveDatabaseHost(undefined, database.dbType);
  }
  if (!host) {
    throw new Error(`Database provider host is unreachable or not configured for ${database.dbType.toUpperCase()}.`);
  }

  const newPassword = generateSecureDatabasePassword();

  if (database.dbType === 'mysql') {
    let conn: mysql.Connection | null = null;
    try {
      conn = await mysql.createConnection({
        host: host.host,
        port: host.port,
        user: host.username,
        password: host.password || '',
        connectTimeout: 5000
      });
      await conn.query(`ALTER USER ?@'%' IDENTIFIED BY ?;`, [database.username, newPassword]);
      await conn.query(`FLUSH PRIVILEGES;`);
    } catch (err: any) {
      throw new Error(`Failed to rotate MySQL user password: ${err.message}`);
    } finally {
      if (conn) {
        try { await conn.end(); } catch (_) {}
      }
    }
  } else if (database.dbType === 'postgres') {
    const client = new PgClient({
      host: host.host,
      port: host.port,
      user: host.username,
      password: host.password || '',
      database: 'postgres',
      connectionTimeoutMillis: 5000
    });
    try {
      await client.connect();
      await client.query(`ALTER ROLE "${database.username}" WITH PASSWORD $1`, [newPassword]);
    } catch (err: any) {
      throw new Error(`Failed to rotate PostgreSQL role password: ${err.message}`);
    } finally {
      try { await client.end(); } catch (_) {}
    }
  }

  const connectionUri = database.dbType === 'mysql'
    ? `mysql://${database.username}:${newPassword}@${database.host}:${database.port}/${database.name}`
    : `postgresql://${database.username}:${newPassword}@${database.host}:${database.port}/${database.name}`;

  return { newPassword, connectionUri };
}

/**
 * Deletes a real database and revokes associated user
 */
export async function deleteRealDatabase(database: ServerDatabase): Promise<void> {
  const db = await getDb();
  let host = (db.databaseHosts || []).find(h => h.id === database.databaseHostId);
  if (!host) {
    host = await resolveDatabaseHost(undefined, database.dbType);
  }
  
  if (host) {
    if (database.dbType === 'mysql') {
      let conn: mysql.Connection | null = null;
      try {
        conn = await mysql.createConnection({
          host: host.host,
          port: host.port,
          user: host.username,
          password: host.password || '',
          connectTimeout: 5000
        });

        // 1. Drop database schema
        await conn.query(`DROP DATABASE IF EXISTS \`${database.name}\`;`);

        // 2. Check if other databases exist for this user in db.json
        const db = await getDb();
        const otherDbsForUser = (db.databases || []).filter(
          d => d.id !== database.id && d.username === database.username
        );
        if (otherDbsForUser.length === 0) {
          await conn.query(`DROP USER IF EXISTS ?@'%';`, [database.username]);
        }
        await conn.query(`FLUSH PRIVILEGES;`);
      } catch (err: any) {
        console.warn(`[DatabaseService] Warning: MySQL cleanup encountered error: ${err.message}`);
      } finally {
        if (conn) {
          try { await conn.end(); } catch (_) {}
        }
      }
    } else if (database.dbType === 'postgres') {
      const client = new PgClient({
        host: host.host,
        port: host.port,
        user: host.username,
        password: host.password || '',
        database: 'postgres',
        connectionTimeoutMillis: 5000
      });
      try {
        await client.connect();

        // 1. Terminate existing connections to this database
        await client.query(`
          SELECT pg_terminate_backend(pid) 
          FROM pg_stat_activity 
          WHERE datname = $1 AND pid <> pg_backend_pid();
        `, [database.name]);

        // 2. Drop database
        await client.query(`DROP DATABASE IF EXISTS "${database.name}";`);

        // 3. Drop role if no other databases use it
        const db = await getDb();
        const otherDbsForUser = (db.databases || []).filter(
          d => d.id !== database.id && d.username === database.username
        );
        if (otherDbsForUser.length === 0) {
          await client.query(`DROP ROLE IF EXISTS "${database.username}";`);
        }
      } catch (err: any) {
        console.warn(`[DatabaseService] Warning: PostgreSQL cleanup encountered error: ${err.message}`);
      } finally {
        try { await client.end(); } catch (_) {}
      }
    }
  }
}

/**
 * Cleans up all databases belonging to a deleted server
 */
export async function cleanupServerDatabases(serverId: string): Promise<void> {
  const db = await getDb();
  const serverDatabases = (db.databases || []).filter(d => d.serverId === serverId);

  for (const sdb of serverDatabases) {
    try {
      await deleteRealDatabase(sdb);
    } catch (err: any) {
      console.error(`[DatabaseService] Error deleting database ${sdb.name} for server ${serverId}:`, err);
    }
  }

  // Remove records from memory & file
  db.databases = (db.databases || []).filter(d => d.serverId !== serverId);
  saveDbSync();
}

/**
 * Tests credentials for a specific server database directly
 */
export async function testDatabaseCredentials(database: ServerDatabase): Promise<{ success: boolean; message?: string }> {
  if (!database.password) {
    return { success: false, message: 'No password stored for this database.' };
  }

  if (database.dbType === 'mysql') {
    try {
      const conn = await mysql.createConnection({
        host: database.host,
        port: database.port,
        user: database.username,
        password: database.password,
        database: database.name,
        connectTimeout: 5000
      });
      await conn.ping();
      await conn.end();
      return { success: true, message: 'Successfully verified MySQL credentials and schema access.' };
    } catch (err: any) {
      return { success: false, message: `Connection test failed: ${err.message}` };
    }
  } else if (database.dbType === 'postgres') {
    const client = new PgClient({
      host: database.host,
      port: database.port,
      user: database.username,
      password: database.password,
      database: database.name,
      connectionTimeoutMillis: 5000
    });
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.end();
      return { success: true, message: 'Successfully verified PostgreSQL credentials and schema access.' };
    } catch (err: any) {
      return { success: false, message: `Connection test failed: ${err.message}` };
    }
  }

  return { success: false, message: 'Unsupported database provider type.' };
}
