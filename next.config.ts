import type { NextConfig } from "next";

// Deriva o host do Storage a partir da mesma env var usada no resto do app,
// em vez de fixar o dominio do Supabase na mao (evita ficar preso a este
// projeto especifico caso ele mude no futuro).
const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;

const nextConfig: NextConfig = {
  images: {
    // Fotos de produto/logo vem do Storage do Supabase. Com isso o
    // next/image passa a redimensionar, converter formato (webp/avif) e
    // fazer lazy loading sozinho - sem isso toda imagem ia crua e no
    // tamanho original (uma foto tirada pelo celular chega a 300+ KB para
    // aparecer num quadrado de 60px).
    remotePatterns: supabaseHost
      ? [
          {
            protocol: "https",
            hostname: supabaseHost,
            pathname: "/storage/v1/object/public/**",
          },
        ]
      : [],
  },
};

export default nextConfig;
