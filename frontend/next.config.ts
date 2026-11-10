import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Deux espaces séparés : /dashboard (CRM de l'équipe) et /espace-client (clients).
  // Les anciennes adresses renvoient au bon endroit.
  async redirects() {
    return [
      { source: "/connexion", destination: "/dashboard/connexion", permanent: true },
      { source: "/espace", destination: "/dashboard", permanent: true },
      { source: "/espace/:path*", destination: "/dashboard/:path*", permanent: true },
      { source: "/dashboard/inscription", destination: "/espace-client/inscription", permanent: true },
      { source: "/dashboard/mes-demandes", destination: "/espace-client/demandes", permanent: true },
    ];
  },
};

export default nextConfig;
