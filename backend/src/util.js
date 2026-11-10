const { q } = require('./db');

// Notification CRM (l'envoi e-mail pourra être branché ici plus tard : SMTP / WhatsApp)
async function notify(userIds, message, link = null) {
  const ids = [...new Set([].concat(userIds).filter(Boolean))];
  for (const id of ids) {
    await q('INSERT INTO notifications (user_id, message, link) VALUES (?,?,?)', [id, message, link]);
  }
}

async function notifyRole(roles, message, link = null) {
  const rows = await q('SELECT id FROM users WHERE active=1 AND role IN (?)', [[].concat(roles)]);
  await notify(rows.map((r) => r.id), message, link);
}

const pad = (n) => String(n).padStart(2, '0');
function ymd(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Semaine de travail : dimanche (0) → jeudi (4)
const isWorkday = (d) => d.getDay() >= 0 && d.getDay() <= 4;

function remainingWorkdays(from = new Date()) {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const month = d.getMonth();
  let n = 0;
  while (d.getMonth() === month) {
    if (isWorkday(d)) n++;
    d.setDate(d.getDate() + 1);
  }
  return n;
}

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

module.exports = { notify, notifyRole, ymd, isWorkday, remainingWorkdays, wrap, HttpError };
