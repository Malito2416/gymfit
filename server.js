require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { initDB } = require('./database/db');
const { seed } = require('./database/seed');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));
app.use(morgan('dev'));

// Ruta de comprobación de salud
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    app: 'DREAM FIT REST API v1.0',
    documentation: '/api/docs',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'DREAM FIT API', time: new Date() });
});

// Rutas de la API
app.use('/api', apiRoutes);

// Manejador 404
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Ruta ${req.originalUrl} no encontrada` });
});

// Manejador de errores global
app.use((err, req, res, next) => {
  console.error('Error no controlado:', err);
  res.status(500).json({ success: false, message: 'Error interno del servidor', error: err.message });
});

// Iniciar base de datos, seed y servidor
async function startServer() {
  try {
    await initDB();
    await seed();

    app.listen(PORT, '0.0.0.0', () => {
      console.log('========================================================');
      console.log(`🚀 DREAM FIT BACKEND API ACTIVO EN: http://localhost:${PORT}`);
      console.log(`📱 Acceso desde Android Emulator:   http://10.0.2.2:${PORT}/api`);
      console.log(`🔐 Modo de Base de Datos:         ${process.env.DB_TYPE || 'sqlite'}`);
      console.log('========================================================');
    });
  } catch (error) {
    console.error('Error al iniciar el servidor:', error);
  }
}

startServer();
