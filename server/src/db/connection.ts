import { createClient } from '@libsql/client';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';

// Determine database URL: use Turso cloud URL if available, otherwise fall back to local SQLite file
const DB_URL = process.env.TURSO_DATABASE_URL || `file:${path.join(__dirname, '..', '..', 'data', 'database.sqlite')}`;
const DB_TOKEN = process.env.TURSO_AUTH_TOKEN || undefined;

// Ensure data directory exists (for local file mode)
if (DB_URL.startsWith('file:')) {
  const filePath = DB_URL.replace('file:', '');
  const dataDir = path.dirname(filePath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

const client = createClient({
  url: DB_URL,
  authToken: DB_TOKEN,
});

// ==================== DB Wrapper ====================
// Provides a familiar API similar to the old node:sqlite DatabaseSync
const db = {
  /**
   * Execute a query that returns multiple rows
   * Usage: await db.all('SELECT * FROM users WHERE role = ?', ['admin'])
   */
  async all(sql: string, params?: any[]): Promise<any[]> {
    const result = await client.execute({ sql, args: params || [] });
    return result.rows as any[];
  },

  /**
   * Execute a query that returns a single row (or undefined)
   * Usage: await db.get('SELECT * FROM users WHERE id = ?', [id])
   */
  async get(sql: string, params?: any[]): Promise<any | undefined> {
    const result = await client.execute({ sql, args: params || [] });
    return (result.rows[0] as any) || undefined;
  },

  /**
   * Execute an INSERT/UPDATE/DELETE and return { lastInsertRowid, changes }
   * Usage: await db.run('INSERT INTO users (name) VALUES (?)', [name])
   */
  async run(sql: string, params?: any[]): Promise<{ lastInsertRowid: number | bigint; changes: number }> {
    const result = await client.execute({ sql, args: params || [] });
    return {
      lastInsertRowid: result.lastInsertRowid || 0,
      changes: result.rowsAffected,
    };
  },

  /**
   * Execute raw SQL (DDL, PRAGMA, etc.) - no results expected
   * Usage: await db.exec('PRAGMA foreign_keys = ON')
   */
  async exec(sql: string): Promise<void> {
    // Split multi-statement SQL by semicolons for batch execution
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    if (statements.length === 1) {
      await client.execute(statements[0]);
    } else {
      // Execute each statement individually (Turso doesn't support multi-statement exec directly)
      for (const stmt of statements) {
        try {
          await client.execute(stmt);
        } catch (e: any) {
          // Ignore errors for IF NOT EXISTS type statements
          if (!stmt.includes('IF NOT EXISTS') && !stmt.includes('ALTER TABLE')) {
            throw e;
          }
        }
      }
    }
  },

  /**
   * Execute multiple statements in a transaction
   * Usage: await db.transaction(async () => { ... })
   */
  async transaction(fn: () => Promise<any>): Promise<any> {
    await client.execute('BEGIN');
    try {
      const result = await fn();
      await client.execute('COMMIT');
      return result;
    } catch (error) {
      await client.execute('ROLLBACK');
      throw error;
    }
  },
};

// ==================== Database Initialization ====================
async function initializeDatabase() {
  // Enable WAL mode for better concurrency (local mode only)
  try {
    await db.exec('PRAGMA journal_mode = WAL');
  } catch (e) {
    // Turso cloud doesn't support PRAGMA changes, ignore
  }
  
  try {
    await db.exec('PRAGMA foreign_keys = ON');
  } catch (e) {
    // ignore for Turso cloud
  }

  // Self-healing migrations for existing databases
  try {
    await db.exec('ALTER TABLE courses ADD COLUMN non_contract_deadline TEXT DEFAULT NULL');
    console.log('✅ Column non_contract_deadline added to courses');
  } catch (e) {
    // Column already exists, ignore
  }

  try {
    await db.exec('ALTER TABLE courses ADD COLUMN total_hours_extra REAL DEFAULT 0');
    console.log('✅ Column total_hours_extra added to courses');
  } catch (e) {
    // Column already exists, ignore
  }

  try {
    await db.exec('ALTER TABLE lessons ADD COLUMN course_id INTEGER REFERENCES courses(id)');
    console.log('✅ Column course_id added to lessons');
  } catch (e) {
    // Column already exists, ignore
  }

  try {
    await db.exec('CREATE INDEX IF NOT EXISTS idx_lessons_course ON lessons(course_id)');
  } catch (e) {
    // Index already exists, ignore
  }

  // Migration: make assignment_id nullable in lessons table
  try {
    const columns = await db.all("PRAGMA table_info(lessons)");
    const assignmentCol = columns.find((c: any) => c.name === 'assignment_id');
    if (assignmentCol && assignmentCol.notnull === 1) {
      console.log('🔄 Migrating lessons table: making assignment_id nullable...');
      await db.exec('PRAGMA foreign_keys = OFF');
      await client.execute('BEGIN');
      await client.execute(`CREATE TABLE lessons_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        assignment_id INTEGER REFERENCES assignments(id) ON DELETE CASCADE,
        course_id INTEGER REFERENCES courses(id),
        date TEXT NOT NULL,
        start_time TEXT,
        end_time TEXT,
        hours REAL NOT NULL DEFAULT 0,
        location_type TEXT NOT NULL CHECK(location_type IN ('AULA', 'WEBINAR', 'FAD', 'PW', 'STAGE', 'EXTRA')),
        notes TEXT,
        is_override INTEGER NOT NULL DEFAULT 0,
        override_reason TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_by INTEGER REFERENCES users(id),
        updated_at DATETIME,
        updated_by INTEGER REFERENCES users(id)
      )`);
      await client.execute(`INSERT INTO lessons_new (id, assignment_id, course_id, date, start_time, end_time, hours, location_type, notes, is_override, override_reason, created_at, created_by, updated_at, updated_by)
        SELECT id, assignment_id, course_id, date, start_time, end_time, hours, location_type, notes, is_override, override_reason, created_at, created_by, updated_at, updated_by FROM lessons`);
      await client.execute('DROP TABLE lessons');
      await client.execute('ALTER TABLE lessons_new RENAME TO lessons');
      await client.execute('CREATE INDEX IF NOT EXISTS idx_lessons_assignment ON lessons(assignment_id)');
      await client.execute('CREATE INDEX IF NOT EXISTS idx_lessons_date ON lessons(date)');
      await client.execute('CREATE INDEX IF NOT EXISTS idx_lessons_course ON lessons(course_id)');
      await client.execute('COMMIT');
      await db.exec('PRAGMA foreign_keys = ON');
      console.log('✅ Lessons table migrated: assignment_id is now nullable');
    }
  } catch (e: any) {
    console.error('❌ Migration error (lessons nullable):', e.message);
    try { await client.execute('ROLLBACK'); } catch (_) {}
    try { await db.exec('PRAGMA foreign_keys = ON'); } catch (_) {}
  }

  // Run schema
  const SCHEMA_PATH = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
  await db.exec(schema);

  // Auto-migration to Turso cloud: if connected to Turso and courses is empty, import from bundled database.sqlite
  if (process.env.TURSO_DATABASE_URL) {
    try {
      const courseCount = await db.get('SELECT COUNT(*) as count FROM courses');
      const localDbPath = path.join(__dirname, '..', '..', 'data', 'database.sqlite');
      if ((!courseCount || courseCount.count === 0) && fs.existsSync(localDbPath)) {
        console.log('🔄 First run on Turso Cloud: Auto-importing existing data from database.sqlite...');
        const localClient = createClient({ url: `file:${localDbPath}` });
        
        const tables = [
          'academic_periods',
          'users',
          'courses',
          'units',
          'teachers',
          'assignments',
          'lessons',
          'audit_log'
        ];

        for (const table of tables) {
          const res = await localClient.execute(`SELECT * FROM ${table}`);
          if (res.rows && res.rows.length > 0) {
            console.log(`  📦 Migrating ${res.rows.length} rows for ${table}...`);
            for (const row of res.rows) {
              const keys = Object.keys(row);
              const placeholders = keys.map(() => '?').join(', ');
              const values = Object.values(row);
              await client.execute({
                sql: `INSERT OR REPLACE INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`,
                args: values
              });
            }
          }
        }
        console.log('🎉 Auto-migration to Turso Cloud completed successfully!');
      }
    } catch (err: any) {
      console.error('⚠️ Could not auto-import from local database.sqlite:', err.message);
    }
  }

  // Create default admin user if none exists
  const userCount = await db.get('SELECT COUNT(*) as count FROM users');
  if (userCount && userCount.count === 0) {
    const hash = bcrypt.hashSync('admin123', 10);
    await db.run(
      'INSERT INTO users (username, password_hash, display_name, role) VALUES (?, ?, ?, ?)',
      ['admin', hash, 'Administrator', 'admin']
    );
    console.log('✅ Default admin user created (admin / admin123)');
  }

  console.log(`✅ Database initialized (${DB_URL.startsWith('libsql') ? 'Turso Cloud' : 'Local SQLite'})`);
}

export { initializeDatabase };
export default db;
