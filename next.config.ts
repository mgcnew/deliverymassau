import type { NextConfig } from "next";

// Deriva o host do Storage a partir da mesma env var usada no resto do app,
// em vez de fixar o dominio do Supabase na mao (evita ficar preso a este
// projeto especifico caso ele mude no futuro).
const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;

const nextConfig: NextConfig = {
  experimental: {
    // Aumenta o tempo de reuso do Client Cache (default de `dynamic` e 0 =
    // nao cacheia).
    //
    // ATENCAO ao que isto NAO faz: medi antes e depois, e voltar para uma
    // pagina ja visitada CONTINUA indo ao servidor. Para rota dinamica com
    // loading.tsx, o que fica no cache do cliente e so a casca ("layout ate
    // o primeiro loading boundary", conforme docs/prefetching) -- os dados
    // sempre chegam do servidor via streaming. Ou seja: o jeito de a
    // navegacao parecer instantanea nao e cache, e o loading.tsx aparecendo
    // na hora enquanto o dado vem. O que da pra encurtar e o tempo de
    // resposta (regiao da Vercel + menos idas ao Supabase), nao a existencia
    // da requisicao.
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
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
