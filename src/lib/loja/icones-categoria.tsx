import { createElement } from 'react'
import {
  Apple,
  Bath,
  Beef,
  Candy,
  Cigarette,
  Coffee,
  Cookie,
  Croissant,
  CupSoda,
  Milk,
  Package,
  PawPrint,
  Pill,
  Popcorn,
  ShoppingBasket,
  Snowflake,
  Soup,
  SprayCan,
  Utensils,
  type LucideIcon,
  type LucideProps,
} from 'lucide-react'

/**
 * Icone de cada categoria, pelo slug. Aparece no lugar da foto quando o
 * produto (ou a categoria inteira) ainda nao tem imagem: um desenho do
 * assunto ajuda mais do que um carrinho generico repetido na tela toda.
 * Categoria nova sem entrada aqui cai na caixa.
 */
const ICONES: Record<string, LucideIcon> = {
  acougue: Beef,
  bebidas: CupSoda,
  frios: Milk,
  padaria: Croissant,
  mercearia: ShoppingBasket,
  hortifruti: Apple,
  higiene: Bath,
  limpeza: SprayCan,
  cigarro: Cigarette,
  matinais: Coffee,
  'biscoitos-e-snacks': Cookie,
  'doces-e-chocolates': Candy,
  'molhos-e-conservas': Soup,
  congelados: Snowflake,
  'bazar-e-utilidades': Utensils,
  pet: PawPrint,
  salgadinhos: Popcorn,
  medicamentos: Pill,
}

export function IconeCategoria({ slug, ...props }: { slug?: string } & LucideProps) {
  return createElement((slug && ICONES[slug]) || Package, { 'aria-hidden': true, ...props })
}
