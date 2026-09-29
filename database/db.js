const path = require('path');
const fs = require('fs');

const DB_TYPE = process.env.DB_TYPE || 'sqlite';

let db = null;

if (DB_TYPE === 'mysql') {
  const mysql = require('mysql2/promise');
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'dreamfit_db',
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });

  db = {
    async query(sql, params = []) {
      const [rows] = await pool.execute(sql, params);
      return rows;
    },
    async run(sql, params = []) {
      const [result] = await pool.execute(sql, params);
      return { lastID: result.insertId, changes: result.affectedRows };
    }
  };
  console.log('[DB] Conectado a MySQL/MariaDB');
} else {
  // SQLite Mode (Por defecto para desarrollo rápido sin dependencias externas)
  const sqlite3 = require('sqlite3').verbose();
  const dbPath = path.resolve(__dirname, 'dreamfit.db');
  const sqliteDb = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('[DB] Error abriendo SQLite:', err.message);
    } else {
      console.log(`[DB] Conectado a SQLite local en: ${dbPath}`);
    }
  });

  db = {
    query(sql, params = []) {
      return new Promise((resolve, reject) => {
        sqliteDb.all(sql, params, (err, rows) => {
          if (err) return reject(err);
          resolve(rows);
        });
      });
    },
    run(sql, params = []) {
      return new Promise((resolve, reject) => {
        sqliteDb.run(sql, params, function (err) {
          if (err) return reject(err);
          resolve({ lastID: this.lastID, changes: this.changes });
        });
      });
    },
    exec(sql) {
      return new Promise((resolve, reject) => {
        sqliteDb.exec(sql, (err) => {
          if (err) return reject(err);
          resolve();
        });
      });
    }
  };
}

async function initDB() {
  if (DB_TYPE === 'sqlite') {
    // Crear tablas SQLite
    await db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'reception',
        status TEXT NOT NULL DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS clients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_code TEXT NOT NULL UNIQUE,
        dni TEXT NOT NULL UNIQUE,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        birthdate TEXT,
        age INTEGER,
        gender TEXT DEFAULT 'M',
        phone TEXT,
        email TEXT,
        address TEXT,
        emergency_contact TEXT,
        emergency_phone TEXT,
        join_date TEXT NOT NULL,
        membership_type TEXT NOT NULL,
        membership_status TEXT NOT NULL DEFAULT 'active',
        membership_expiry TEXT NOT NULL,
        photo_url TEXT,
        qr_code TEXT,
        notes TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS physical_evaluations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER NOT NULL,
        evaluation_date TEXT NOT NULL,
        weight REAL NOT NULL,
        height REAL NOT NULL,
        bmi REAL NOT NULL,
        fat_percentage REAL NOT NULL,
        fat_mass REAL NOT NULL,
        fat_free_mass REAL NOT NULL,
        muscle_mass REAL NOT NULL,
        neck REAL DEFAULT 0,
        shoulders REAL DEFAULT 0,
        chest REAL DEFAULT 0,
        waist REAL DEFAULT 0,
        hips REAL DEFAULT 0,
        thigh REAL DEFAULT 0,
        calf REAL DEFAULT 0,
        arm REAL DEFAULT 0,
        forearm REAL DEFAULT 0,
        triceps REAL DEFAULT 0,
        biceps REAL DEFAULT 0,
        subscapular REAL DEFAULT 0,
        suprailiac REAL DEFAULT 0,
        observations TEXT,
        professional_id INTEGER,
        professional_name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS nutritional_plans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        objective TEXT NOT NULL,
        target_calories INTEGER NOT NULL,
        target_protein INTEGER NOT NULL,
        target_carbs INTEGER NOT NULL,
        target_fats INTEGER NOT NULL,
        hydration_liters REAL DEFAULT 2.5,
        meals_json TEXT NOT NULL,
        recommendations TEXT,
        start_date TEXT NOT NULL,
        update_date TEXT NOT NULL,
        professional_id INTEGER,
        professional_name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS workout_plans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        objective TEXT NOT NULL,
        days_per_week INTEGER DEFAULT 4,
        routines_json TEXT NOT NULL,
        observations TEXT,
        trainer_name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS attendances (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        time TEXT NOT NULL,
        method TEXT DEFAULT 'QR',
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS memberships (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER NOT NULL,
        plan_name TEXT NOT NULL,
        price REAL NOT NULL,
        start_date TEXT NOT NULL,
        expiry_date TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        payment_method TEXT NOT NULL,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER NOT NULL,
        concept TEXT NOT NULL,
        amount REAL NOT NULL,
        payment_date TEXT NOT NULL,
        payment_method TEXT NOT NULL,
        operation_number TEXT,
        registered_by TEXT NOT NULL,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS progress_photos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        photo_type TEXT NOT NULL,
        photo_url TEXT NOT NULL,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        client_id INTEGER,
        is_read INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }
}

module.exports = {
  db,
  initDB,
  DB_TYPE
};
