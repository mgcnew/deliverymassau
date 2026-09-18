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
    // Otimizacao de imagem DESLIGADA de proposito.
    //
    // A vitrine paginada expos o catalogo inteiro (1.500 fotos), e cada foto
    // distinta conta uma transformacao na Vercel. A cota do plano gratuito
    // estourou e o /_next/image passou a responder 402
    // (OPTIMIZED_IMAGE_REQUEST_PAYMENT_REQUIRED) - foto quebrada na loja,
    // que e pior que foto grande. O arquivo cru no Storage continua 200.
    //
    // Sai barato porque as fotos ja nascem pequenas: mediana de 23 KB, p90
    // de 41 KB, e so 5 arquivos passam de 150 KB. As da base publica vem em
    // 400 px e as da equipe passam pelo comprimir-imagem.ts no navegador.
    // Uma pagina de 20 produtos fica em ~520 KB sem otimizacao nenhuma.
    //
    // O next/image continua valendo a pena: lazy loading, reserva de espaco
    // (sem pulo de layout) e o mesmo componente em todo lugar. O que deixa
    // de acontecer e so o redimensionamento no servidor.
    //
    // Para religar: plano pago na Vercel, ou transformacao de imagem do
    // proprio Supabase (que tambem e recurso de plano pago).
    unoptimized: true,
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
