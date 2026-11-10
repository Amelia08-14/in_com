// PM2 : garde l'API et le site en vie et les relance au redémarrage du VPS.
// Ports choisis pour ne pas gêner les autres sites du serveur (à changer si déjà pris).
// Lancement : pm2 start deploy/ecosystem.config.js && pm2 save
module.exports = {
  apps: [
    {
      name: 'incom-api',
      cwd: __dirname + '/../backend',
      script: 'src/server.js',
      env: { NODE_ENV: 'production', PORT: 4100 },
      max_memory_restart: '400M',
    },
    {
      name: 'incom-web',
      cwd: __dirname + '/../frontend',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3100 -H 127.0.0.1',
      env: { NODE_ENV: 'production' },
      max_memory_restart: '600M',
    },
  ],
};
