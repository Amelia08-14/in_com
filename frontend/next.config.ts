import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // L'administration (CRM + espace client) vit sous /dashboard.
  // Les anciennes adresses /espace et /connexion y renvoient.
  async redirects() {
    return [
      { source: "/connexion", destination: "/dashboard/connexion", permanent: true },
      { source: "/espace", destination: "/dashboard", permanent: true },
      { source: "/espace/:path*", destination: "/dashboard/:path*", permanent: true },
    ];
  },
};

export default nextConfig;
