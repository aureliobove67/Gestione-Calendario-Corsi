import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';

const DB_PATH = path.join(__dirname, '..', '..', 'data', 'database.sqlite');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new DatabaseSync(DB_PATH);

// Mimic better-sqlite3 db.transaction() support
(db as any).transaction = (fn: (...args: any[]) => any) => {
  return (...args: any[]) => {
    db.exec('BEGIN');
    try {
      const result = fn(...args);
      db.exec('COMMIT');
      return result;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  };
};

// Enable WAL mode for better concurrency via standard SQL exec
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

// Self-healing migrations for existing databases (MUST run before schema to add columns before indexes)
try {
  db.exec('ALTER TABLE courses ADD COLUMN non_contract_deadline TEXT DEFAULT NULL');
  console.log('✅ Column non_contract_deadline added to courses');
} catch (e) {
  // Column already exists, ignore
}

try {
  db.exec('ALTER TABLE courses ADD COLUMN total_hours_extra REAL DEFAULT 0');
  console.log('✅ Column total_hours_extra added to courses');
} catch (e) {
  // Column already exists, ignore
}

try {
  db.exec('ALTER TABLE lessons ADD COLUMN course_id INTEGER REFERENCES courses(id)');
  console.log('✅ Column course_id added to lessons');
} catch (e) {
  // Column already exists, ignore
}

try {
  db.exec('CREATE INDEX IF NOT EXISTS idx_lessons_course ON lessons(course_id)');
} catch (e) {
  // Index already exists, ignore
}

// Migration: make assignment_id nullable in lessons table
// SQLite doesn't support ALTER COLUMN, so we must recreate the table
try {
  // Check if assignment_id is still NOT NULL by inspecting table_info
  const columns = db.prepare("PRAGMA table_info(lessons)").all() as any[];
  const assignmentCol = columns.find((c: any) => c.name === 'assignment_id');
  if (assignmentCol && assignmentCol.notnull === 1) {
    console.log('🔄 Migrating lessons table: making assignment_id nullable...');
    db.exec('PRAGMA foreign_keys = OFF');
    db.exec('BEGIN TRANSACTION');
    db.exec(`CREATE TABLE lessons_new (
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
    // Copy existing data (course_id will be NULL for old rows, which is correct)
    db.exec(`INSERT INTO lessons_new (id, assignment_id, course_id, date, start_time, end_time, hours, location_type, notes, is_override, override_reason, created_at, created_by, updated_at, updated_by)
      SELECT id, assignment_id, course_id, date, start_time, end_time, hours, location_type, notes, is_override, override_reason, created_at, created_by, updated_at, updated_by FROM lessons`);
    db.exec('DROP TABLE lessons');
    db.exec('ALTER TABLE lessons_new RENAME TO lessons');
    // Recreate indexes
    db.exec('CREATE INDEX IF NOT EXISTS idx_lessons_assignment ON lessons(assignment_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_lessons_date ON lessons(date)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_lessons_course ON lessons(course_id)');
    db.exec('COMMIT');
    db.exec('PRAGMA foreign_keys = ON');
    console.log('✅ Lessons table migrated: assignment_id is now nullable');
  }
} catch (e: any) {
  console.error('❌ Migration error (lessons nullable):', e.message);
  try { db.exec('ROLLBACK'); } catch (_) {}
  db.exec('PRAGMA foreign_keys = ON');
}

// Run schema (after migrations so new columns exist for indexes)
const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
db.exec(schema);

// Create default admin user if none exists
const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as any;
if (userCount.count === 0) {
  const hash = bcrypt.hashSync('admin123', 10);
  db.prepare(
    'INSERT INTO users (username, password_hash, display_name, role) VALUES (?, ?, ?, ?)'
  ).run('admin', hash, 'Administrator', 'admin');
  console.log('✅ Default admin user created (admin / admin123)');
}

export default db;
