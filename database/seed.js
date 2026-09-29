const bcrypt = require('bcryptjs');
const { db, initDB } = require('./db');

async function seed() {
  await initDB();

  // Verificar si ya hay usuarios
  const users = await db.query('SELECT count(*) as count FROM users');
  const count = users[0].count || users[0]['count(*)'] || 0;
  if (count > 0) {
    console.log('[SEED] Base de datos ya cuenta con registros. Omitiendo seed inicial.');
    return;
  }

  console.log('[SEED] Poblando base de datos con datos de prueba realistas para DREAM FIT...');

  // 1. USUARIOS Y ROLES
  const hashedPasswordAdmin = await bcrypt.hash('admin123', 10);
  const hashedPasswordTrainer = await bcrypt.hash('trainer123', 10);
  const hashedPasswordNutri = await bcrypt.hash('nutri123', 10);
  const hashedPasswordRecep = await bcrypt.hash('recep123', 10);
  const hashedPasswordClient = await bcrypt.hash('cliente123', 10);

  await db.run(
    `INSERT INTO users (name, email, password, role, status) VALUES 
    ('Administrador General', 'admin@dreamfit.com', ?, 'admin', 'active'),
    ('Prof. Marco Entrenador', 'entrenador@dreamfit.com', ?, 'trainer', 'active'),
    ('Lic. Sofia Nutricionista', 'nutri@dreamfit.com', ?, 'nutritionist', 'active'),
    ('Carla Recepción', 'recepcion@dreamfit.com', ?, 'reception', 'active'),
    ('Carlos Mendoza (Cliente)', 'cliente@dreamfit.com', ?, 'client', 'active')`,
    [hashedPasswordAdmin, hashedPasswordTrainer, hashedPasswordNutri, hashedPasswordRecep, hashedPasswordClient]
  );

  // 2. CLIENTES
  const today = new Date();
  const formatDate = (d) => d.toISOString().split('T')[0];

  const in30Days = new Date();
  in30Days.setDate(today.getDate() + 30);

  const in3Days = new Date();
  in3Days.setDate(today.getDate() + 3);

  const past10Days = new Date();
  past10Days.setDate(today.getDate() - 10);

  const in60Days = new Date();
  in60Days.setDate(today.getDate() + 60);

  await db.run(
    `INSERT INTO clients (client_code, dni, first_name, last_name, birthdate, age, gender, phone, email, address, emergency_contact, emergency_phone, join_date, membership_type, membership_status, membership_expiry, photo_url, qr_code, notes, status) VALUES 
    ('DF-1001', '71234567', 'Carlos', 'Mendoza Ramos', '1995-04-12', 31, 'M', '987654321', 'carlos.mendoza@gmail.com', 'Av. La Marina 1420, San Miguel', 'Rosa Ramos (Madre)', '998877665', '2026-01-15', 'Trimestral Pro', 'active', ?, 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150', 'DF-1001-QR', 'Objetivo: Pérdida de grasa e hipertrofia. Disciplinado.', 'active'),
    ('DF-1002', '72345678', 'Mariana', 'Flores Silva', '1998-09-22', 28, 'F', '912345678', 'mariana.flores@hotmail.com', 'Calle Las Begonias 320, San Isidro', 'Jorge Flores (Hermano)', '911223344', '2026-02-01', 'Mensual VIP', 'expiring', ?, 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150', 'DF-1002-QR', 'Próxima a renovar membresía trimestral.', 'active'),
    ('DF-1003', '73456789', 'Rodrigo', 'Alarcón Peña', '1990-11-05', 35, 'M', '923456789', 'rodrigo.alarcon@gmail.com', 'Jr. Huancavelica 550, Magdalena', 'Lucía Peña', '933445566', '2025-11-10', 'Mensual VIP', 'expired', ?, 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150', 'DF-1003-QR', 'Membresía vencida, pendiente contactar por WhatsApp.', 'active'),
    ('DF-1004', '74567890', 'Valeria', 'Castillo Luna', '2001-07-18', 25, 'F', '934567890', 'valeria.castillo@gmail.com', 'Av. Arequipa 2240, Lince', 'Miguel Castillo (Padre)', '944556677', '2026-03-01', 'Semestral Elite', 'active', ?, 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150', 'DF-1004-QR', 'Nueva socia, evaluación física pendiente.', 'active'),
    ('DF-1005', '75678901', 'Mateo', 'Gutierrez Solis', '1993-02-14', 33, 'M', '945678901', 'mateo.gutierrez@outlook.com', 'Av. Brasil 3410, Jesús María', 'Elena Solis', '955667788', '2026-01-10', 'Anual Black', 'active', ?, 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150', 'DF-1005-QR', 'Entrenamiento funcional y calistenia.', 'active')`,
    [formatDate(in30Days), formatDate(in3Days), formatDate(past10Days), formatDate(in60Days), formatDate(in60Days)]
  );

  // 3. EVALUACIONES FÍSICAS (Cliente 1: Carlos Mendoza - 2 evaluaciones para mostrar comparativa y evolución en gráficos)
  await db.run(
    `INSERT INTO physical_evaluations (client_id, evaluation_date, weight, height, bmi, fat_percentage, fat_mass, fat_free_mass, muscle_mass, neck, shoulders, chest, waist, hips, thigh, calf, arm, forearm, triceps, biceps, subscapular, suprailiac, observations, professional_id, professional_name) VALUES 
    (1, '2026-01-15', 84.5, 175.0, 27.59, 22.4, 18.9, 65.6, 38.2, 39.0, 118.0, 102.0, 93.0, 104.0, 59.0, 38.5, 36.0, 29.0, 14.0, 10.0, 18.0, 20.0, 'Evaluación inicial de ingreso. Nivel de grasa elevado en zona abdominal. Buena base muscular.', 2, 'Prof. Marco Entrenador'),
    (1, '2026-03-01', 81.2, 175.0, 26.51, 18.5, 15.0, 66.2, 39.4, 38.5, 120.0, 104.0, 86.5, 101.0, 60.5, 39.0, 37.8, 29.5, 11.0, 7.5, 14.0, 15.0, 'Excelente progreso a 6 semanas. Disminución de 3.3kg de peso, -3.9% de grasa y aumento de masa muscular en brazos y piernas.', 2, 'Prof. Marco Entrenador'),
    (2, '2026-02-05', 62.0, 163.0, 23.34, 25.1, 15.6, 46.4, 27.5, 33.0, 98.0, 88.0, 72.0, 96.0, 54.0, 34.0, 26.5, 22.0, 16.0, 12.0, 17.0, 19.0, 'Evaluación inicial Mariana Flores. Enfoque en tonificación de glúteos y core.', 2, 'Prof. Marco Entrenador')`
  );

  // 4. PLANES NUTRICIONALES (Con múltiples opciones: Opción 1, Opción 2, Opción 3)
  const mealsCarlos = JSON.stringify({
    breakfast: [
      { id: 'b1', name: 'Opción 1: Clásica Proteica', items: 'Omelette de 3 claras + 1 huevo entero con espinacas y champiñones, 50g de avena en hojuelas con canela y 1 taza de café pasado sin azúcar.' },
      { id: 'b2', name: 'Opción 2: Tostadas Fit', items: '2 rebanadas de pan de masa madre tostado, 60g de palta hass, 120g de pechuga de pollo deshilachada y té verde con limón.' },
      { id: 'b3', name: 'Opción 3: Pancakes de Avena & Whey', items: 'Pancakes de avena (45g) con 1 scoop de proteína Whey sabor vainilla, 1 plátano de seda en rodajas y 1 cucharadita de miel de abeja pura.' }
    ],
    lunch: [
      { id: 'l1', name: 'Opción 1: Pechuga a la Plancha', items: '180g de pechuga de pollo marinada a las finas hierbas, 150g de camote asado, ensalada de hojas verdes, pepino y 1 cucharada de aceite de oliva extravirgen.' },
      { id: 'l2', name: 'Opción 2: Pescado Blanco al Horno', items: '200g de filete de corvina o tilapia a la plancha, 120g de arroz integral al vapor, brócoli y zanahoria salteados al wok.' },
      { id: 'l3', name: 'Opción 3: Lomo Fino & Quinoa', items: '180g de corte de lomo fino a la plancha, 140g de quinoa perlada cocida con verduras y ensalada fresca mixta con vinagreta de limón.' }
    ],
    snack: [
      { id: 's1', name: 'Opción 1: Batido Post-Entreno', items: '1 scoop de proteína aislada con 250ml de leche de almendras sin azúcar, 1 manzana verde y 20g de almendras tostadas.' },
      { id: 's2', name: 'Opción 2: Tostadas de Arroz & Maní', items: '2 galletas de arroz inflado integral con 25g de crema de maní 100% natural y rodajas de fresas frescas.' },
      { id: 's3', name: 'Opción 3: Parfait Griego', items: '150g de yogur griego descremado natural sin azúcar, 30g de arándanos frescos y 1 cucharada de semillas de chía hidratadas.' }
    ],
    dinner: [
      { id: 'd1', name: 'Opción 1: Ensalada César Fit', items: '160g de pechuga de pollo deshilachada o a la parrilla, abundante lechuga romana, tomatitos cherry y aderezo a base de yogur griego y mostaza dijon.' },
      { id: 'd2', name: 'Opción 2: Tortilla Liviana de Atún', items: '1 lata de atún al agua escurrida, revuelta con 2 claras de huevo, cebolla, tomate y un toque de orégano, acompañada de espárragos al vapor.' },
      { id: 'd3', name: 'Opción 3: Salteado de Verduras & Tofu/Pollo', items: '150g de pechuga de pollo o tofu a la plancha en cubos, pimiento rojo, zuchinni y champiñones salteados con unas gotas de salsa de soya reducida en sodio.' }
    ]
  });

  await db.run(
    `INSERT INTO nutritional_plans (client_id, title, objective, target_calories, target_protein, target_carbs, target_fats, hydration_liters, meals_json, recommendations, start_date, update_date, professional_id, professional_name) VALUES 
    (1, 'Plan Recomposición Corporal - Fase 2', 'Disminución de grasa subcutánea y preservación de masa muscular magra', 2200, 175, 210, 58, 3.2, ?, 'Priorizar hidratación antes y durante el entrenamiento. Consumir la comida post-entreno dentro de los 45 minutos. Evitar ultraprocesados y bebidas azucaradas.', '2026-01-20', '2026-03-01', 3, 'Lic. Sofia Nutricionista')`,
    [mealsCarlos]
  );

  // 5. PLANES DE ENTRENAMIENTO (Organizado por grupos musculares)
  const workoutsCarlos = JSON.stringify({
    pecho: [
      { exercise: 'Press de Banca Plano con Barra', sets: 4, reps: '8-10', weight: '70 kg', rest: '90s', notes: 'Controlar fase excéntrica en 2 segundos' },
      { exercise: 'Press Inclinado con Mancuernas', sets: 3, reps: '10-12', weight: '24 kg c/u', rest: '75s', notes: 'Ángulo de banco a 30 grados' },
      { exercise: 'Cruces en Polea Media', sets: 3, reps: '12-15', weight: '15 kg', rest: '60s', notes: 'Sostener 1 segundo en contracción máxima' }
    ],
    espalda: [
      { exercise: 'Jalón al Pecho con Agarre Neutro', sets: 4, reps: '10-12', weight: '55 kg', rest: '90s', notes: 'Enfocar tracción desde los codos' },
      { exercise: 'Remo con Barra T apoyado', sets: 4, reps: '8-10', weight: '45 kg', rest: '90s', notes: 'Espalda recta, sin balanceo lumbar' },
      { exercise: 'Remo Unilateral con Mancuerna', sets: 3, reps: '12', weight: '22 kg', rest: '60s', notes: 'Buena extensión de dorsales abajo' }
    ],
    piernas: [
      { exercise: 'Sentadilla Libre con Barra (Squat)', sets: 4, reps: '8-10', weight: '80 kg', rest: '120s', notes: 'Profundidad paralela o más' },
      { exercise: 'Prensa Inclinada 45°', sets: 4, reps: '12', weight: '160 kg', rest: '90s', notes: 'No bloquear rodillas al extender' },
      { exercise: 'Curl Femoral Tumbado en Máquina', sets: 3, reps: '12-15', weight: '35 kg', rest: '60s', notes: 'Fase excéntrica lenta' },
      { exercise: 'Elevación de Gemelos en Máquina', sets: 4, reps: '15', weight: '50 kg', rest: '45s', notes: 'Pausa en elongación' }
    ],
    hombros: [
      { exercise: 'Press Militar con Mancuernas sentado', sets: 4, reps: '10-12', weight: '18 kg c/u', rest: '90s', notes: 'Rango completo de movimiento' },
      { exercise: 'Elevaciones Laterales en Polea', sets: 4, reps: '15', weight: '7.5 kg', rest: '60s', notes: 'Tensión constante' },
      { exercise: 'Pájaros posteriores en máquina pec-deck', sets: 3, reps: '15', weight: '30 kg', rest: '60s', notes: 'Enfoque en deltoides posterior' }
    ],
    brazos: [
      { exercise: 'Curl de Bíceps en Banco Scott con Barra Z', sets: 3, reps: '10-12', weight: '25 kg', rest: '60s', notes: 'Aislamiento estricto de bíceps' },
      { exercise: 'Extensión de Tríceps en Polea Alta con Cuerda', sets: 4, reps: '12-15', weight: '25 kg', rest: '60s', notes: 'Abrir cuerda al final del recorrido' },
      { exercise: 'Fondos en Paralelas para Tríceps', sets: 3, reps: '12', weight: 'Corporal', rest: '75s', notes: 'Tronco erguido para enfatizar tríceps' }
    ],
    core: [
      { exercise: 'Plancha Abdominal Estática (Plank)', sets: 4, reps: '45 seg', weight: 'Corporal', rest: '45s', notes: 'Activar glúteos y transverso' },
      { exercise: 'Elevaciones de Piernas colgado en barra', sets: 3, reps: '15', weight: 'Corporal', rest: '60s', notes: 'Sin balanceo pendular' }
    ],
    cardio: [
      { exercise: 'Caminadora Inclinada (LISS)', sets: 1, reps: '25 min', weight: 'Inclinación 8%, Vel 5.2 km/h', rest: '0s', notes: 'Mantener frecuencia cardíaca en zona 2 (120-135 bpm)' }
    ]
  });

  await db.run(
    `INSERT INTO workout_plans (client_id, title, objective, days_per_week, routines_json, observations, trainer_name) VALUES 
    (1, 'Rutina Torso / Pierna / Hipertrofia 4 Días', 'Desarrollo de fuerza base e hipertrofia sarcoplasmática con estímulo metabólico', 4, ?, 'Realizar movilidad articular y calentamiento dinámico previo por 8 minutos. Respetar los tiempos de descanso.', 'Prof. Marco Entrenador')`,
    [workoutsCarlos]
  );

  // 6. ASISTENCIAS DIGITALES
  const todayStr = formatDate(today);
  const yest = new Date();
  yest.setDate(today.getDate() - 1);
  const yestStr = formatDate(yest);

  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(today.getDate() - 2);
  const twoDaysAgoStr = formatDate(twoDaysAgo);

  await db.run(
    `INSERT INTO attendances (client_id, date, time, method, notes) VALUES 
    (1, ?, '07:15:22', 'QR', 'Ingreso por torniquete principal con QR'),
    (2, ?, '08:30:10', 'QR', 'Ingreso con QR celular'),
    (5, ?, '09:05:40', 'MANUAL', 'Ingreso manual por recepción'),
    (1, ?, '07:22:15', 'QR', 'Entrenamiento de Pecho y Bíceps'),
    (2, ?, '18:45:00', 'QR', 'Clase de Spinning'),
    (1, ?, '07:10:05', 'QR', 'Entrenamiento de Piernas')`,
    [todayStr, todayStr, todayStr, yestStr, yestStr, twoDaysAgoStr]
  );

  // 7. MEMBRESÍAS
  await db.run(
    `INSERT INTO memberships (client_id, plan_name, price, start_date, expiry_date, status, payment_method, notes) VALUES 
    (1, 'Trimestral Pro', 320.00, '2026-01-15', ?, 'active', 'Yape', 'Incluye acceso libre a máquinas, lockers y evaluación bimensual'),
    (2, 'Mensual VIP', 130.00, '2026-02-01', ?, 'expiring', 'Plin', 'Alerta: Vence en 3 días'),
    (3, 'Mensual VIP', 130.00, '2025-11-10', ?, 'expired', 'Efectivo', 'Vencida sin renovación'),
    (4, 'Semestral Elite', 580.00, '2026-03-01', ?, 'active', 'Tarjeta', 'Incluye nutrición deportiva mensual'),
    (5, 'Anual Black', 990.00, '2026-01-10', ?, 'active', 'Transferencia', 'Pase ilimitado a todas las sedes DREAM FIT')`,
    [formatDate(in30Days), formatDate(in3Days), formatDate(past10Days), formatDate(in60Days), formatDate(in60Days)]
  );

  // 8. PAGOS
  await db.run(
    `INSERT INTO payments (client_id, concept, amount, payment_date, payment_method, operation_number, registered_by, notes) VALUES 
    (1, 'Membresía Trimestral Pro', 320.00, '2026-01-15', 'Yape', 'OP-8829103', 'Carla Recepción', 'Pago validado por captura Yape'),
    (2, 'Membresía Mensual VIP', 130.00, '2026-02-01', 'Plin', 'OP-4491021', 'Carla Recepción', 'Transferencia Plin inmediata'),
    (4, 'Membresía Semestral Elite + Matrícula', 620.00, '2026-03-01', 'Tarjeta', 'VISA-7782', 'Carla Recepción', 'POS Niubiz en recepción'),
    (5, 'Membresía Anual Black', 990.00, '2026-01-10', 'Transferencia', 'BCP-991203', 'Administrador General', 'Abono en cuenta corriente BCP')`
  );

  // 9. FOTOGRAFÍAS DE PROGRESO (Cliente 1: Carlos Mendoza)
  await db.run(
    `INSERT INTO progress_photos (client_id, date, photo_type, photo_url, notes) VALUES 
    (1, '2026-01-15', 'front', 'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=500', 'Foto inicial frontal. 84.5kg.'),
    (1, '2026-01-15', 'side', 'https://images.unsplash.com/photo-1574680096145-d05b474e2155?w=500', 'Foto inicial perfil. 84.5kg.'),
    (1, '2026-01-15', 'back', 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=500', 'Foto inicial espalda. 84.5kg.'),
    (1, '2026-03-01', 'front', 'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=500', 'Foto seguimiento frontal semana 6. 81.2kg, mayor definición abdominal.'),
    (1, '2026-03-01', 'side', 'https://images.unsplash.com/photo-1574680096145-d05b474e2155?w=500', 'Foto seguimiento perfil semana 6. Reducción notoria de perímetro de cintura.'),
    (1, '2026-03-01', 'back', 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=500', 'Foto seguimiento espalda semana 6. Mayor densidad en dorsales.')`
  );

  // 10. NOTIFICACIONES
  await db.run(
    `INSERT INTO notifications (type, title, message, client_id, is_read) VALUES 
    ('membership_expiring', 'Membresía por vencer: Mariana Flores', 'La membresía de Mariana Flores vence en 3 días. Contactar para renovación con tarifa promocional.', 2, 0),
    ('eval_pending', 'Evaluación Física Pendiente: Valeria Castillo', 'Valeria Castillo se inscribió hace 5 días y aún no agenda su evaluación física inicial.', 4, 0),
    ('new_eval', 'Nueva Evaluación Registrada: Carlos Mendoza', 'Prof. Marco registró la evaluación de seguimiento del cliente Carlos Mendoza con notables avances.', 1, 1),
    ('membership_expired', 'Membresía Vencida: Rodrigo Alarcón', 'El socio Rodrigo Alarcón tiene su membresía vencida desde hace 10 días.', 3, 0)`
  );

  console.log('[SEED] Base de datos DREAM FIT inicializada y poblada exitosamente con datos de prueba.');
}

module.exports = { seed };

if (require.main === module) {
  seed().then(() => process.exit(0)).catch((err) => {
    console.error('[SEED] Error en seed:', err);
    process.exit(1);
  });
}
