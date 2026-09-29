const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { db } = require('../database/db');
const { authenticateToken, requireRole, JWT_SECRET } = require('../middleware/auth');

// ==========================================
// 1. MÓDULO LOGIN & AUTENTICACIÓN
// ==========================================
router.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Correo y contraseña requeridos' });
    }

    const users = await db.query('SELECT * FROM users WHERE email = ?', [email.trim().toLowerCase()]);
    if (users.length === 0) {
      return res.status(401).json({ success: false, message: 'Credenciales inválidas' });
    }

    const user = users[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Credenciales inválidas' });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ success: false, message: 'Usuario suspendido o inactivo' });
    }

    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
});

router.post('/auth/recover', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, message: 'Correo requerido' });
  }
  // Simular envío de enlace/código de recuperación
  res.json({
    success: true,
    message: `Se ha enviado un enlace de recuperación al correo ${email}. Revisa tu bandeja de entrada.`
  });
});

router.get('/auth/me', authenticateToken, async (req, res) => {
  res.json({ success: true, user: req.user });
});

// ==========================================
// 2. MÓDULO DASHBOARD
// ==========================================
router.get('/dashboard/stats', authenticateToken, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const totalClientsResult = await db.query('SELECT count(*) as count FROM clients WHERE status = "active"');
    const totalClients = totalClientsResult[0].count || totalClientsResult[0]['count(*)'] || 0;

    const activeMembershipsResult = await db.query('SELECT count(*) as count FROM clients WHERE membership_status = "active"');
    const activeMemberships = activeMembershipsResult[0].count || activeMembershipsResult[0]['count(*)'] || 0;

    const expiringMembershipsResult = await db.query('SELECT count(*) as count FROM clients WHERE membership_status = "expiring"');
    const expiringMemberships = expiringMembershipsResult[0].count || expiringMembershipsResult[0]['count(*)'] || 0;

    const expiredMembershipsResult = await db.query('SELECT count(*) as count FROM clients WHERE membership_status = "expired"');
    const expiredMemberships = expiredMembershipsResult[0].count || expiredMembershipsResult[0]['count(*)'] || 0;

    const todayAttendancesResult = await db.query('SELECT count(*) as count FROM attendances WHERE date = ?', [today]);
    const todayAttendances = todayAttendancesResult[0].count || todayAttendancesResult[0]['count(*)'] || 0;

    const pendingEvalsResult = await db.query(`
      SELECT count(*) as count FROM clients c 
      WHERE c.id NOT IN (SELECT DISTINCT client_id FROM physical_evaluations)
    `);
    const pendingEvaluations = pendingEvalsResult[0].count || pendingEvalsResult[0]['count(*)'] || 0;

    // Próximas evaluaciones agendadas o recientes
    const recentEvaluations = await db.query(`
      SELECT e.id, e.client_id, e.evaluation_date, e.weight, e.fat_percentage, c.first_name, c.last_name, c.client_code
      FROM physical_evaluations e
      JOIN clients c ON e.client_id = c.id
      ORDER BY e.evaluation_date DESC LIMIT 5
    `);

    // Asistencias recientes
    const recentAttendances = await db.query(`
      SELECT a.id, a.date, a.time, a.method, c.first_name, c.last_name, c.client_code, c.photo_url
      FROM attendances a
      JOIN clients c ON a.client_id = c.id
      WHERE a.date = ?
      ORDER BY a.id DESC LIMIT 6
    `, [today]);

    res.json({
      success: true,
      stats: {
        totalClients,
        activeMemberships,
        expiringMemberships,
        expiredMemberships,
        todayAttendances,
        pendingEvaluations
      },
      recentEvaluations,
      recentAttendances
    });
  } catch (error) {
    console.error('Error en dashboard:', error);
    res.status(500).json({ success: false, message: 'Error cargando dashboard' });
  }
});

// ==========================================
// 3. MÓDULO CLIENTES (CRUD COMPLETO)
// ==========================================
router.get('/clients', authenticateToken, async (req, res) => {
  try {
    const { search, status, membership_status } = req.query;
    let sql = 'SELECT * FROM clients WHERE 1=1';
    const params = [];

    if (search) {
      sql += ' AND (dni LIKE ? OR first_name LIKE ? OR last_name LIKE ? OR client_code LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }

    if (membership_status) {
      sql += ' AND membership_status = ?';
      params.push(membership_status);
    }

    sql += ' ORDER BY id DESC';
    const clients = await db.query(sql, params);
    res.json({ success: true, clients });
  } catch (error) {
    console.error('Error listando clientes:', error);
    res.status(500).json({ success: false, message: 'Error listando clientes' });
  }
});

router.get('/clients/:id', authenticateToken, async (req, res) => {
  try {
    const clients = await db.query('SELECT * FROM clients WHERE id = ?', [req.params.id]);
    if (clients.length === 0) {
      return res.status(404).json({ success: false, message: 'Cliente no encontrado' });
    }
    res.json({ success: true, client: clients[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error obteniendo cliente' });
  }
});

router.post('/clients', authenticateToken, async (req, res) => {
  try {
    const {
      dni, first_name, last_name, birthdate, age, gender, phone, email,
      address, emergency_contact, emergency_phone, membership_type,
      membership_expiry, photo_url, notes
    } = req.body;

    if (!dni || !first_name || !last_name) {
      return res.status(400).json({ success: false, message: 'DNI, Nombres y Apellidos son obligatorios' });
    }

    // Generar código único DF-XXXX
    const countRes = await db.query('SELECT count(*) as count FROM clients');
    const total = (countRes[0].count || countRes[0]['count(*)'] || 0) + 1;
    const client_code = `DF-${1000 + total}`;
    const qr_code = `${client_code}-QR`;
    const join_date = new Date().toISOString().split('T')[0];

    const defaultExpiry = new Date();
    defaultExpiry.setDate(defaultExpiry.getDate() + 30);
    const expiry = membership_expiry || defaultExpiry.toISOString().split('T')[0];

    const result = await db.run(`
      INSERT INTO clients (
        client_code, dni, first_name, last_name, birthdate, age, gender,
        phone, email, address, emergency_contact, emergency_phone,
        join_date, membership_type, membership_status, membership_expiry,
        photo_url, qr_code, notes, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, 'active')
    `, [
      client_code, dni, first_name, last_name, birthdate || null, age || null, gender || 'M',
      phone || '', email || '', address || '', emergency_contact || '', emergency_phone || '',
      join_date, membership_type || 'Mensual VIP', expiry, photo_url || '', qr_code, notes || ''
    ]);

    const newId = result.lastID;
    const created = await db.query('SELECT * FROM clients WHERE id = ?', [newId]);
    res.status(201).json({ success: true, message: 'Cliente registrado con éxito', client: created[0] });
  } catch (error) {
    console.error('Error registrando cliente:', error);
    if (error.message && error.message.includes('UNIQUE')) {
      return res.status(400).json({ success: false, message: 'El DNI ya se encuentra registrado' });
    }
    res.status(500).json({ success: false, message: 'Error registrando cliente' });
  }
});

router.put('/clients/:id', authenticateToken, async (req, res) => {
  try {
    const {
      dni, first_name, last_name, birthdate, age, gender, phone, email,
      address, emergency_contact, emergency_phone, membership_type,
      membership_status, membership_expiry, photo_url, notes, status
    } = req.body;

    await db.run(`
      UPDATE clients SET
        dni = COALESCE(?, dni),
        first_name = COALESCE(?, first_name),
        last_name = COALESCE(?, last_name),
        birthdate = COALESCE(?, birthdate),
        age = COALESCE(?, age),
        gender = COALESCE(?, gender),
        phone = COALESCE(?, phone),
        email = COALESCE(?, email),
        address = COALESCE(?, address),
        emergency_contact = COALESCE(?, emergency_contact),
        emergency_phone = COALESCE(?, emergency_phone),
        membership_type = COALESCE(?, membership_type),
        membership_status = COALESCE(?, membership_status),
        membership_expiry = COALESCE(?, membership_expiry),
        photo_url = COALESCE(?, photo_url),
        notes = COALESCE(?, notes),
        status = COALESCE(?, status)
      WHERE id = ?
    `, [
      dni, first_name, last_name, birthdate, age, gender, phone, email,
      address, emergency_contact, emergency_phone, membership_type,
      membership_status, membership_expiry, photo_url, notes, status,
      req.params.id
    ]);

    const updated = await db.query('SELECT * FROM clients WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Cliente actualizado', client: updated[0] });
  } catch (error) {
    console.error('Error actualizando cliente:', error);
    res.status(500).json({ success: false, message: 'Error actualizando cliente' });
  }
});

router.delete('/clients/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    // Soft delete o desactivación
    await db.run('UPDATE clients SET status = "inactive" WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Cliente desactivado con éxito' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error desactivando cliente' });
  }
});

// ==========================================
// 10. FICHA CENTRALIZADA 360 DEL CLIENTE
// ==========================================
router.get('/clients/:id/full-profile', authenticateToken, async (req, res) => {
  try {
    const clientId = req.params.id;
    const clientRows = await db.query('SELECT * FROM clients WHERE id = ?', [clientId]);
    if (clientRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Cliente no encontrado' });
    }
    const client = clientRows[0];

    const memberships = await db.query('SELECT * FROM memberships WHERE client_id = ? ORDER BY id DESC', [clientId]);
    const attendances = await db.query('SELECT * FROM attendances WHERE client_id = ? ORDER BY date DESC, time DESC LIMIT 20', [clientId]);
    const evaluations = await db.query('SELECT * FROM physical_evaluations WHERE client_id = ? ORDER BY evaluation_date ASC', [clientId]);
    const nutritionPlans = await db.query('SELECT * FROM nutritional_plans WHERE client_id = ? ORDER BY id DESC', [clientId]);
    const workoutPlans = await db.query('SELECT * FROM workout_plans WHERE client_id = ? ORDER BY id DESC', [clientId]);
    const payments = await db.query('SELECT * FROM payments WHERE client_id = ? ORDER BY payment_date DESC', [clientId]);
    const photos = await db.query('SELECT * FROM progress_photos WHERE client_id = ? ORDER BY date DESC', [clientId]);

    res.json({
      success: true,
      profile: {
        personal_data: client,
        memberships,
        attendances,
        physical_evaluations: evaluations,
        nutritional_plans: nutritionPlans.map(p => ({
          ...p,
          meals: typeof p.meals_json === 'string' ? JSON.parse(p.meals_json) : p.meals_json
        })),
        workout_plans: workoutPlans.map(w => ({
          ...w,
          routines: typeof w.routines_json === 'string' ? JSON.parse(w.routines_json) : w.routines_json
        })),
        payments,
        progress_photos: photos
      }
    });
  } catch (error) {
    console.error('Error obteniendo perfil 360:', error);
    res.status(500).json({ success: false, message: 'Error obteniendo perfil 360' });
  }
});

// ==========================================
// 4. MÓDULO EVALUACIÓN FÍSICA
// ==========================================
router.get('/evaluations/client/:clientId', authenticateToken, async (req, res) => {
  try {
    const evals = await db.query(
      'SELECT * FROM physical_evaluations WHERE client_id = ? ORDER BY evaluation_date DESC',
      [req.params.clientId]
    );
    res.json({ success: true, evaluations: evals });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error obteniendo evaluaciones' });
  }
});

router.post('/evaluations', authenticateToken, async (req, res) => {
  try {
    const {
      client_id, evaluation_date, weight, height, fat_percentage,
      neck, shoulders, chest, waist, hips, thigh, calf, arm, forearm,
      triceps, biceps, subscapular, suprailiac, observations, professional_name
    } = req.body;

    if (!client_id || !weight || !height) {
      return res.status(400).json({ success: false, message: 'Cliente, peso y estatura son requeridos' });
    }

    // Cálculo automático de IMC
    const heightInMeters = height / 100;
    const bmi = +(weight / (heightInMeters * heightInMeters)).toFixed(2);

    // Cálculos de composición corporal
    const fatPct = fat_percentage || 20.0;
    const fatMass = +((weight * fatPct) / 100).toFixed(2);
    const fatFreeMass = +(weight - fatMass).toFixed(2);
    const muscleMass = +(fatFreeMass * 0.58).toFixed(2); // Estimación músculo esquelético

    const evalDate = evaluation_date || new Date().toISOString().split('T')[0];
    const profName = professional_name || (req.user ? req.user.name : 'Evaluador DreamFit');

    const result = await db.run(`
      INSERT INTO physical_evaluations (
        client_id, evaluation_date, weight, height, bmi, fat_percentage, fat_mass,
        fat_free_mass, muscle_mass, neck, shoulders, chest, waist, hips, thigh,
        calf, arm, forearm, triceps, biceps, subscapular, suprailiac,
        observations, professional_id, professional_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      client_id, evalDate, weight, height, bmi, fatPct, fatMass, fatFreeMass,
      muscleMass, neck || 0, shoulders || 0, chest || 0, waist || 0, hips || 0,
      thigh || 0, calf || 0, arm || 0, forearm || 0, triceps || 0, biceps || 0,
      subscapular || 0, suprailiac || 0, observations || '', req.user?.id || null, profName
    ]);

    // Crear notificación automática
    await db.run(
      'INSERT INTO notifications (type, title, message, client_id) VALUES (?, ?, ?, ?)',
      ['new_eval', 'Nueva Evaluación Física Registrada', `Se registró una nueva evaluación para el cliente ID ${client_id}.`, client_id]
    );

    const created = await db.query('SELECT * FROM physical_evaluations WHERE id = ?', [result.lastID]);
    res.status(201).json({ success: true, message: 'Evaluación física registrada', evaluation: created[0] });
  } catch (error) {
    console.error('Error registrando evaluación:', error);
    res.status(500).json({ success: false, message: 'Error registrando evaluación' });
  }
});

// Comparativa de evaluación Anterior vs Actual
router.get('/evaluations/compare/:clientId', authenticateToken, async (req, res) => {
  try {
    const evals = await db.query(
      'SELECT * FROM physical_evaluations WHERE client_id = ? ORDER BY evaluation_date DESC LIMIT 2',
      [req.params.clientId]
    );

    if (evals.length === 0) {
      return res.status(404).json({ success: false, message: 'No hay evaluaciones para este cliente' });
    }

    const current = evals[0];
    const previous = evals.length > 1 ? evals[1] : null;

    let deltas = null;
    if (previous) {
      deltas = {
        weight: +(current.weight - previous.weight).toFixed(2),
        fat_percentage: +(current.fat_percentage - previous.fat_percentage).toFixed(2),
        fat_mass: +(current.fat_mass - previous.fat_mass).toFixed(2),
        muscle_mass: +(current.muscle_mass - previous.muscle_mass).toFixed(2),
        waist: +(current.waist - previous.waist).toFixed(2),
        arm: +(current.arm - previous.arm).toFixed(2),
        thigh: +(current.thigh - previous.thigh).toFixed(2),
        chest: +(current.chest - previous.chest).toFixed(2)
      };
    }

    res.json({
      success: true,
      current,
      previous,
      deltas
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error comparando evaluaciones' });
  }
});

// ==========================================
// 5. MÓDULO PLAN NUTRICIONAL
// ==========================================
router.get('/nutrition/client/:clientId', authenticateToken, async (req, res) => {
  try {
    const plans = await db.query(
      'SELECT * FROM nutritional_plans WHERE client_id = ? ORDER BY id DESC',
      [req.params.clientId]
    );

    const formatted = plans.map(p => ({
      ...p,
      meals: typeof p.meals_json === 'string' ? JSON.parse(p.meals_json) : p.meals_json
    }));

    res.json({ success: true, plans: formatted });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error obteniendo planes nutricionales' });
  }
});

router.post('/nutrition', authenticateToken, async (req, res) => {
  try {
    const {
      client_id, title, objective, target_calories, target_protein,
      target_carbs, target_fats, hydration_liters, meals, recommendations,
      start_date, professional_name
    } = req.body;

    if (!client_id || !title) {
      return res.status(400).json({ success: false, message: 'Cliente y título requeridos' });
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const mealsJsonStr = typeof meals === 'object' ? JSON.stringify(meals) : meals;

    const result = await db.run(`
      INSERT INTO nutritional_plans (
        client_id, title, objective, target_calories, target_protein,
        target_carbs, target_fats, hydration_liters, meals_json,
        recommendations, start_date, update_date, professional_id, professional_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      client_id, title, objective || '', target_calories || 2000, target_protein || 150,
      target_carbs || 200, target_fats || 50, hydration_liters || 2.5, mealsJsonStr,
      recommendations || '', start_date || todayStr, todayStr, req.user?.id || null,
      professional_name || (req.user ? req.user.name : 'Nutricionista DreamFit')
    ]);

    res.status(201).json({ success: true, message: 'Plan nutricional guardado', id: result.lastID });
  } catch (error) {
    console.error('Error guardando nutrición:', error);
    res.status(500).json({ success: false, message: 'Error guardando plan nutricional' });
  }
});

// ==========================================
// 6. MÓDULO PLAN DE ENTRENAMIENTO
// ==========================================
router.get('/workouts/client/:clientId', authenticateToken, async (req, res) => {
  try {
    const plans = await db.query(
      'SELECT * FROM workout_plans WHERE client_id = ? ORDER BY id DESC',
      [req.params.clientId]
    );

    const formatted = plans.map(w => ({
      ...w,
      routines: typeof w.routines_json === 'string' ? JSON.parse(w.routines_json) : w.routines_json
    }));

    res.json({ success: true, plans: formatted });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error obteniendo rutinas' });
  }
});

router.post('/workouts', authenticateToken, async (req, res) => {
  try {
    const { client_id, title, objective, days_per_week, routines, observations, trainer_name } = req.body;
    if (!client_id || !title) {
      return res.status(400).json({ success: false, message: 'Cliente y título requeridos' });
    }

    const routinesJsonStr = typeof routines === 'object' ? JSON.stringify(routines) : routines;
    const result = await db.run(`
      INSERT INTO workout_plans (client_id, title, objective, days_per_week, routines_json, observations, trainer_name)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      client_id, title, objective || '', days_per_week || 4, routinesJsonStr,
      observations || '', trainer_name || (req.user ? req.user.name : 'Entrenador DreamFit')
    ]);

    res.status(201).json({ success: true, message: 'Plan de entrenamiento guardado', id: result.lastID });
  } catch (error) {
    console.error('Error guardando rutina:', error);
    res.status(500).json({ success: false, message: 'Error guardando rutina' });
  }
});

// ==========================================
// 7. MÓDULO ASISTENCIA DIGITAL (QR & MANUAL)
// ==========================================
router.get('/attendances', authenticateToken, async (req, res) => {
  try {
    const { date, client_id } = req.query;
    let sql = `
      SELECT a.*, c.first_name, c.last_name, c.client_code, c.dni, c.photo_url, c.membership_status
      FROM attendances a
      JOIN clients c ON a.client_id = c.id
      WHERE 1=1
    `;
    const params = [];
    if (date) {
      sql += ' AND a.date = ?';
      params.push(date);
    }
    if (client_id) {
      sql += ' AND a.client_id = ?';
      params.push(client_id);
    }
    sql += ' ORDER BY a.id DESC LIMIT 50';

    const attendances = await db.query(sql, params);
    res.json({ success: true, attendances });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error obteniendo asistencias' });
  }
});

router.post('/attendances/check-in', authenticateToken, async (req, res) => {
  try {
    const { client_identifier, method, notes } = req.body; // client_identifier can be DNI, QR code or Client ID

    if (!client_identifier) {
      return res.status(400).json({ success: false, message: 'Identificador del cliente requerido (DNI o Código QR)' });
    }

    // Buscar cliente por DNI, qr_code, client_code o ID
    const clients = await db.query(
      'SELECT * FROM clients WHERE dni = ? OR qr_code = ? OR client_code = ? OR id = ?',
      [client_identifier, client_identifier, client_identifier, client_identifier]
    );

    if (clients.length === 0) {
      return res.status(404).json({ success: false, message: 'Cliente no encontrado' });
    }

    const client = clients[0];

    // Verificar si membresía está vencida
    const isExpired = client.membership_status === 'expired';

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().split(' ')[0];

    const result = await db.run(`
      INSERT INTO attendances (client_id, date, time, method, notes)
      VALUES (?, ?, ?, ?, ?)
    `, [client.id, dateStr, timeStr, method || 'QR', notes || (isExpired ? 'Acceso con membresía vencida' : 'Ingreso exitoso')]);

    res.json({
      success: true,
      message: isExpired ? '¡Atención! Membresía Vencida. Registrar renovación.' : '¡Asistencia registrada con éxito!',
      client: {
        id: client.id,
        code: client.client_code,
        name: `${client.first_name} ${client.last_name}`,
        membership_status: client.membership_status,
        membership_expiry: client.membership_expiry,
        is_expired: isExpired
      },
      attendance: {
        id: result.lastID,
        date: dateStr,
        time: timeStr,
        method: method || 'QR'
      }
    });
  } catch (error) {
    console.error('Error registrando asistencia:', error);
    res.status(500).json({ success: false, message: 'Error registrando asistencia' });
  }
});

// ==========================================
// 8. MÓDULO MEMBRESÍAS
// ==========================================
router.get('/memberships', authenticateToken, async (req, res) => {
  try {
    const memberships = await db.query(`
      SELECT m.*, c.first_name, c.last_name, c.dni, c.client_code
      FROM memberships m
      JOIN clients c ON m.client_id = c.id
      ORDER BY m.id DESC
    `);
    res.json({ success: true, memberships });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error cargando membresías' });
  }
});

router.post('/memberships/renew', authenticateToken, async (req, res) => {
  try {
    const { client_id, plan_name, duration_months, price, payment_method, notes } = req.body;
    if (!client_id || !plan_name || !price) {
      return res.status(400).json({ success: false, message: 'Datos incompletos para renovación' });
    }

    const startDate = new Date();
    const expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + (duration_months || 1));

    const startStr = startDate.toISOString().split('T')[0];
    const expiryStr = expiryDate.toISOString().split('T')[0];

    // Registrar en tabla memberships
    await db.run(`
      INSERT INTO memberships (client_id, plan_name, price, start_date, expiry_date, status, payment_method, notes)
      VALUES (?, ?, ?, ?, ?, 'active', ?, ?)
    `, [client_id, plan_name, price, startStr, expiryStr, payment_method || 'Yape', notes || 'Renovación de membresía']);

    // Actualizar cliente
    await db.run(`
      UPDATE clients SET
        membership_type = ?,
        membership_status = 'active',
        membership_expiry = ?
      WHERE id = ?
    `, [plan_name, expiryStr, client_id]);

    // Registrar pago automáticamente
    await db.run(`
      INSERT INTO payments (client_id, concept, amount, payment_date, payment_method, operation_number, registered_by, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      client_id,
      `Renovación Membresía: ${plan_name}`,
      price,
      startStr,
      payment_method || 'Yape',
      `OP-${Math.floor(100000 + Math.random() * 900000)}`,
      req.user ? req.user.name : 'Recepción DreamFit',
      notes || 'Pago de membresía renovada'
    ]);

    res.json({ success: true, message: 'Membresía renovada y pago registrado exitosamente' });
  } catch (error) {
    console.error('Error renovando membresía:', error);
    res.status(500).json({ success: false, message: 'Error renovando membresía' });
  }
});

// ==========================================
// 9. MÓDULO PAGOS
// ==========================================
router.get('/payments', authenticateToken, async (req, res) => {
  try {
    const payments = await db.query(`
      SELECT p.*, c.first_name, c.last_name, c.dni, c.client_code
      FROM payments p
      JOIN clients c ON p.client_id = c.id
      ORDER BY p.payment_date DESC, p.id DESC
    `);
    res.json({ success: true, payments });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error cargando pagos' });
  }
});

router.post('/payments', authenticateToken, async (req, res) => {
  try {
    const { client_id, concept, amount, payment_method, operation_number, notes } = req.body;
    if (!client_id || !concept || !amount) {
      return res.status(400).json({ success: false, message: 'Cliente, concepto y monto requeridos' });
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const registeredBy = req.user ? req.user.name : 'Recepción';

    const result = await db.run(`
      INSERT INTO payments (client_id, concept, amount, payment_date, payment_method, operation_number, registered_by, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [client_id, concept, amount, todayStr, payment_method || 'Efectivo', operation_number || '', registeredBy, notes || '']);

    res.status(201).json({ success: true, message: 'Pago registrado exitosamente', id: result.lastID });
  } catch (error) {
    console.error('Error registrando pago:', error);
    res.status(500).json({ success: false, message: 'Error registrando pago' });
  }
});

// ==========================================
// 11. MÓDULO FOTOGRAFÍAS DE PROGRESO
// ==========================================
router.get('/photos/client/:clientId', authenticateToken, async (req, res) => {
  try {
    const photos = await db.query(
      'SELECT * FROM progress_photos WHERE client_id = ? ORDER BY date DESC, id DESC',
      [req.params.clientId]
    );
    res.json({ success: true, photos });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error obteniendo fotos' });
  }
});

router.post('/photos', authenticateToken, async (req, res) => {
  try {
    const { client_id, date, photo_type, photo_url, notes } = req.body;
    if (!client_id || !photo_type || !photo_url) {
      return res.status(400).json({ success: false, message: 'Cliente, tipo de foto y URL requeridos' });
    }

    const todayStr = date || new Date().toISOString().split('T')[0];
    const result = await db.run(`
      INSERT INTO progress_photos (client_id, date, photo_type, photo_url, notes)
      VALUES (?, ?, ?, ?, ?)
    `, [client_id, todayStr, photo_type, photo_url, notes || '']);

    res.status(201).json({ success: true, message: 'Foto de progreso guardada', id: result.lastID });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error guardando foto' });
  }
});

// ==========================================
// 12. MÓDULO REPORTES & EXPORTACIÓN
// ==========================================
router.get('/reports/summary', authenticateToken, async (req, res) => {
  try {
    const totalRevenueResult = await db.query('SELECT SUM(amount) as total FROM payments');
    const totalRevenue = totalRevenueResult[0].total || 0;

    const paymentsByMethod = await db.query(`
      SELECT payment_method, SUM(amount) as total, COUNT(*) as count 
      FROM payments GROUP BY payment_method
    `);

    const clientsByStatus = await db.query(`
      SELECT membership_status, COUNT(*) as count 
      FROM clients GROUP BY membership_status
    `);

    const recentAttendanceCount = await db.query(`
      SELECT date, COUNT(*) as count 
      FROM attendances 
      GROUP BY date 
      ORDER BY date DESC LIMIT 7
    `);

    res.json({
      success: true,
      summary: {
        totalRevenue,
        paymentsByMethod,
        clientsByStatus,
        recentAttendanceTrend: recentAttendanceCount
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error generando reporte' });
  }
});

// ==========================================
// 13. MÓDULO NOTIFICACIONES
// ==========================================
router.get('/notifications', authenticateToken, async (req, res) => {
  try {
    const notifs = await db.query('SELECT * FROM notifications ORDER BY id DESC LIMIT 30');
    res.json({ success: true, notifications: notifs });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error obteniendo notificaciones' });
  }
});

router.put('/notifications/:id/read', authenticateToken, async (req, res) => {
  try {
    await db.run('UPDATE notifications SET is_read = 1 WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Notificación marcada como leída' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error actualizando notificación' });
  }
});

module.exports = router;
