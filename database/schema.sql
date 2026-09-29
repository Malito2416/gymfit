-- ===================================================
-- DREAM FIT - BASE DE DATOS MYSQL / MARIADB
-- Esquema relacional completo para gestión de gimnasio
-- ===================================================

CREATE DATABASE IF NOT EXISTS dreamfit_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE dreamfit_db;

-- 1. Tabla de Usuarios y Roles del Sistema
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(120) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role ENUM('admin', 'trainer', 'nutritionist', 'reception', 'client') NOT NULL DEFAULT 'reception',
    status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_email (email),
    INDEX idx_user_role (role)
) ENGINE=InnoDB;

-- 2. Tabla de Clientes
CREATE TABLE IF NOT EXISTS clients (
    id INT AUTO_INCREMENT PRIMARY KEY,
    client_code VARCHAR(30) NOT NULL UNIQUE,
    dni VARCHAR(20) NOT NULL UNIQUE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    birthdate DATE NULL,
    age INT NULL,
    gender ENUM('M', 'F', 'Otro') DEFAULT 'M',
    phone VARCHAR(30) NULL,
    email VARCHAR(120) NULL,
    address VARCHAR(255) NULL,
    emergency_contact VARCHAR(100) NULL,
    emergency_phone VARCHAR(30) NULL,
    join_date DATE NOT NULL,
    membership_type VARCHAR(100) NOT NULL,
    membership_status ENUM('active', 'expiring', 'expired', 'suspended') NOT NULL DEFAULT 'active',
    membership_expiry DATE NOT NULL,
    photo_url TEXT NULL,
    qr_code VARCHAR(100) NULL,
    notes TEXT NULL,
    status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_client_dni (dni),
    INDEX idx_client_code (client_code),
    INDEX idx_client_status (membership_status)
) ENGINE=InnoDB;

-- 3. Tabla de Evaluaciones Físicas (Antropometría digitalizada)
CREATE TABLE IF NOT EXISTS physical_evaluations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    client_id INT NOT NULL,
    evaluation_date DATE NOT NULL,
    weight DECIMAL(5,2) NOT NULL,        -- kg
    height DECIMAL(5,2) NOT NULL,        -- cm
    bmi DECIMAL(4,2) NOT NULL,           -- IMC
    fat_percentage DECIMAL(4,2) NOT NULL,-- % grasa corporal
    fat_mass DECIMAL(5,2) NOT NULL,      -- kg
    fat_free_mass DECIMAL(5,2) NOT NULL, -- masa libre de grasa en kg
    muscle_mass DECIMAL(5,2) NOT NULL,   -- masa muscular kg
    -- Perímetros corporales (cm)
    neck DECIMAL(5,2) DEFAULT 0,
    shoulders DECIMAL(5,2) DEFAULT 0,
    chest DECIMAL(5,2) DEFAULT 0,
    waist DECIMAL(5,2) DEFAULT 0,
    hips DECIMAL(5,2) DEFAULT 0,
    thigh DECIMAL(5,2) DEFAULT 0,
    calf DECIMAL(5,2) DEFAULT 0,
    arm DECIMAL(5,2) DEFAULT 0,
    forearm DECIMAL(5,2) DEFAULT 0,
    -- Pliegues cutáneos (mm)
    triceps DECIMAL(5,2) DEFAULT 0,
    biceps DECIMAL(5,2) DEFAULT 0,
    subscapular DECIMAL(5,2) DEFAULT 0,
    suprailiac DECIMAL(5,2) DEFAULT 0,
    observations TEXT NULL,
    professional_id INT NULL,
    professional_name VARCHAR(100) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
    FOREIGN KEY (professional_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_eval_client (client_id),
    INDEX idx_eval_date (evaluation_date)
) ENGINE=InnoDB;

-- 4. Tabla de Planes Nutricionales (Multiopción)
CREATE TABLE IF NOT EXISTS nutritional_plans (
    id INT AUTO_INCREMENT PRIMARY KEY,
    client_id INT NOT NULL,
    title VARCHAR(150) NOT NULL,
    objective VARCHAR(255) NOT NULL,
    target_calories INT NOT NULL,
    target_protein INT NOT NULL,
    target_carbs INT NOT NULL,
    target_fats INT NOT NULL,
    hydration_liters DECIMAL(3,1) DEFAULT 2.5,
    meals_json JSON NOT NULL,            -- Desayuno, Almuerzo, Merienda, Cena (Opciones 1, 2, 3)
    recommendations TEXT NULL,
    start_date DATE NOT NULL,
    update_date DATE NOT NULL,
    professional_id INT NULL,
    professional_name VARCHAR(100) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
    FOREIGN KEY (professional_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_nutri_client (client_id)
) ENGINE=InnoDB;

-- 5. Tabla de Planes de Entrenamiento
CREATE TABLE IF NOT EXISTS workout_plans (
    id INT AUTO_INCREMENT PRIMARY KEY,
    client_id INT NOT NULL,
    title VARCHAR(150) NOT NULL,
    objective VARCHAR(255) NOT NULL,
    days_per_week INT NOT NULL DEFAULT 4,
    routines_json JSON NOT NULL,         -- Pecho, Espalda, Piernas, Hombros, Brazos, Core, Cardio
    observations TEXT NULL,
    trainer_name VARCHAR(100) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
    INDEX idx_workout_client (client_id)
) ENGINE=InnoDB;

-- 6. Tabla de Asistencias Digitales (QR y Manual)
CREATE TABLE IF NOT EXISTS attendances (
    id INT AUTO_INCREMENT PRIMARY KEY,
    client_id INT NOT NULL,
    date DATE NOT NULL,
    time VARCHAR(10) NOT NULL,
    method ENUM('QR', 'MANUAL') NOT NULL DEFAULT 'QR',
    notes VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
    INDEX idx_att_client (client_id),
    INDEX idx_att_date (date)
) ENGINE=InnoDB;

-- 7. Tabla de Membresías
CREATE TABLE IF NOT EXISTS memberships (
    id INT AUTO_INCREMENT PRIMARY KEY,
    client_id INT NOT NULL,
    plan_name VARCHAR(100) NOT NULL,
    price DECIMAL(8,2) NOT NULL,
    start_date DATE NOT NULL,
    expiry_date DATE NOT NULL,
    status ENUM('active', 'expiring', 'expired', 'suspended') NOT NULL DEFAULT 'active',
    payment_method VARCHAR(50) NOT NULL,
    notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
    INDEX idx_memb_client (client_id),
    INDEX idx_memb_status (status)
) ENGINE=InnoDB;

-- 8. Tabla de Pagos
CREATE TABLE IF NOT EXISTS payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    client_id INT NOT NULL,
    concept VARCHAR(150) NOT NULL,
    amount DECIMAL(8,2) NOT NULL,
    payment_date DATE NOT NULL,
    payment_method ENUM('Efectivo', 'Yape', 'Plin', 'Transferencia', 'Tarjeta', 'Otros') NOT NULL,
    operation_number VARCHAR(80) NULL,
    registered_by VARCHAR(100) NOT NULL,
    notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
    INDEX idx_pay_client (client_id),
    INDEX idx_pay_date (payment_date)
) ENGINE=InnoDB;

-- 9. Tabla de Fotografías de Progreso
CREATE TABLE IF NOT EXISTS progress_photos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    client_id INT NOT NULL,
    date DATE NOT NULL,
    photo_type ENUM('front', 'side', 'back') NOT NULL,
    photo_url TEXT NOT NULL,
    notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
    INDEX idx_photos_client (client_id)
) ENGINE=InnoDB;

-- 10. Tabla de Notificaciones
CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    client_id INT NULL,
    is_read TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_notif_read (is_read)
) ENGINE=InnoDB;
