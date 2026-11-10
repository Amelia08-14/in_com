const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'dev-secret-a-changer';

const ROLES = {
  admin: 'Direction (CEO)',
  responsable_commercial: 'Responsable commercial',
  commercial_sedentaire: 'Commercial sédentaire',
  commercial_terrain: 'Commercial terrain',
  responsable_communication: 'Responsable communication',
  responsable_technique: 'Responsable technique',
  charge_clientele: 'Chargé de clientèle',
  graphiste: 'Graphiste',
  community_manager: 'Community manager',
  photographe: 'Photographe / vidéaste',
  media_buyer: 'Media buyer',
  developpeur: 'Développeur (IN DEV)',
  recouvrement: 'Recouvrement',
  client: 'Client',
};

const PRODUCTION = ['graphiste', 'photographe', 'developpeur', 'community_manager', 'media_buyer'];
const COMMERCIAL = ['responsable_commercial', 'commercial_sedentaire', 'commercial_terrain'];

function sign(user) {
  return jwt.sign({ id: user.id, role: user.role, name: user.name }, SECRET, { expiresIn: '7d' });
}

function auth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Non authentifié' });
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Session expirée' });
  }
}

// allow('admin', 'graphiste') — l'admin a toujours accès
function allow(...roles) {
  return (req, res, next) => {
    if (req.user.role === 'admin' || roles.includes(req.user.role)) return next();
    res.status(403).json({ error: 'Accès refusé pour ce rôle' });
  };
}

module.exports = { sign, auth, allow, ROLES, PRODUCTION, COMMERCIAL };
