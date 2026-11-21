// Envoi des notifications par e-mail (SMTP). Sans SMTP_HOST dans .env, rien n'est envoyé :
// les notifications restent visibles dans le CRM (cloche).
// .env : SMTP_HOST, SMTP_PORT (465 ou 587), SMTP_USER, SMTP_PASS, MAIL_FROM, SITE_URL,
//        NOTIFY_EMAIL_ROLES (rôles qui reçoivent aussi les e-mails, par défaut « admin,client »)
const nodemailer = require('nodemailer');

let transport = null;
function getTransport() {
  if (!process.env.SMTP_HOST) return null;
  if (!transport) {
    const port = Number(process.env.SMTP_PORT || 465);
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
  }
  return transport;
}

const emailRoles = () => (process.env.NOTIFY_EMAIL_ROLES || 'admin,client').split(',').map((r) => r.trim()).filter(Boolean);

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Un e-mail court : le message de la notification et un bouton vers la bonne page du CRM
async function sendNotificationEmail(user, message, link) {
  const t = getTransport();
  if (!t || !user?.email || !emailRoles().includes(user.role)) return;
  const site = (process.env.SITE_URL || '').replace(/\/$/, '');
  const url = link ? `${site}${link}` : site;
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;color:#001042;max-width:520px">
    <p style="font-size:13px;color:#fd5816;letter-spacing:.08em;text-transform:uppercase;margin:0 0 12px">IN COMMUNICATION</p>
    <p>Bonjour ${esc(String(user.name || '').split(' ')[0])},</p>
    <p style="font-size:16px"><b>${esc(message)}</b></p>
    ${url ? `<p><a href="${esc(url)}" style="display:inline-block;background:#fd5816;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none">Ouvrir</a></p>` : ''}
    <p style="color:#667085;font-size:12px">Message automatique de la plateforme IN COM.</p></div>`;
  try {
    await t.sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to: user.email,
      subject: `IN COM · ${message}`.slice(0, 150),
      text: `${message}\n\n${url}`,
      html,
    });
  } catch (e) {
    console.error('E-mail non envoyé :', e.message);
  }
}

module.exports = { sendNotificationEmail };
