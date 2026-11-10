require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { auth } = require('./auth');

const app = express();
// Derrière Nginx : l'adresse du visiteur arrive dans X-Forwarded-For (utile au limiteur d'essais)
app.set('trust proxy', 'loopback');
app.use(cors({ origin: (process.env.CORS_ORIGIN || 'http://localhost:3000').split(',') }));
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'incom-crm-api' }));

const carts = require('./routes/carts');
app.use('/api', carts.pub); // panier public + suivi (avant core, qui exige l'auth ensuite)
app.use('/api', require('./routes/core')); // public + auth + users + dashboard (applique auth après les routes publiques)
app.use('/api', auth, require('./routes/commercial'));
app.use('/api/dossiers', auth, require('./routes/dossiers'));
app.use('/api/tasks', auth, require('./routes/tasks'));
app.use('/api', auth, require('./routes/support'));
app.use('/api', carts.crm);

app.use((req, res) => res.status(404).json({ error: 'Route inconnue' }));
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (!err.status) console.error(err);
  res.status(err.status || 500).json({ error: err.status ? err.message : 'Erreur serveur' });
});

const PORT = Number(process.env.PORT || 4000);
app.listen(PORT, () => console.log(`API IN COM sur http://localhost:${PORT}`));
