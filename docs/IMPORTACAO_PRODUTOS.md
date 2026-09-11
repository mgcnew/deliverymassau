# Cadastro em massa de produtos, fotos e código de barras

> Plano técnico para 3 melhorias na tela de Produtos. Decisões já validadas com
> o usuário em 20/08/2026 estão marcadas como **✅ decidido**; o resto são
> escolhas recomendadas que sigo por padrão, mas podem ser ajustadas.
>
> **Fases A, B e C entregues em 20/08/2026** (importação CSV, câmera do
> celular e código de barras). Plano concluído.

---

## Visão geral

Três frentes independentes, priorizadas por valor imediato:

| Fase | O que entrega | Esforço | Depende de |
|---|---|---|---|
| **A** ✅ | Importar produtos de uma planilha CSV | Alto | Nada |
| **B** ✅ | Tirar foto do produto pela câmera do celular | Trivial | Nada |
| **C** ✅ | Código de barras (campo + leitura por câmera) | Médio | Nada, mas complementa A e B |

Nenhuma delas toca no fluxo do pedido, no carrinho ou no checkout — é só
cadastro. **A** é a que dá o retorno mais rápido (aproveita o catálogo que
você já tem no seu sistema atual), por isso proponho começar por ela.

---

## Fase A — Importar produtos de planilha CSV

### Formato do arquivo ✅ decidido: CSV

Primeira linha é o cabeçalho, nesta ordem (aceito variação de acento/caixa):

```
produto,categoria,unidade,preco,codigo_barras
Alcatra,Acougue,kg,49.90,
Coca-Cola 2L,Bebidas,unidade,10.00,7894900011517
Queijo Mussarela,Frios,kg,42.00,
```

- **codigo_barras** é **opcional** (migration `0030`) e aceita os nomes
  `codigo_barras`, `código de barras`, `codigo`, `ean` ou `barcode`. Só entra
  com 8 a 14 dígitos — código interno curto do sistema de origem é ignorado.
  Se o código já pertence a outro produto, **o produto entra mesmo assim, sem
  o código**, e a tela informa quantos foram ignorados: uma colisão nunca
  derruba a importação inteira. Produto que já tem código cadastrado no
  painel mantém o dele — quem escaneou tinha a embalagem na mão, a planilha
  não.

- **unidade** aceita: `unidade`, `pacote`, `caixa`, `kg`, `g` (mesmas opções do
  cadastro manual). `kg`/`g` marcam o produto automaticamente como **vendido
  por peso** — mesma regra que já existe no formulário de produto hoje.
- **preco** aceita vírgula ou ponto decimal (`49,90` ou `49.90`).
- Exportar do Excel ou Google Sheets: "Arquivo → Fazer download → Valores
  separados por vírgula (.csv)". Dois cliques, nenhuma conversão manual.

### Comportamento com produto repetido ✅ decidido: atualiza o preço

Se o **nome normalizado** (sem acento, sem maiúscula, sem espaço duplo) já
existe no catálogo, a importação **atualiza preço, categoria e unidade** do
produto existente em vez de criar um duplicado. Isso é o que faz sentido para
reimportar a planilha sempre que os preços do seu sistema mudarem — vira uma
rotina, não um cadastro único.

### Categoria nova ✅ decidido: cria automaticamente

Se a planilha tem uma categoria que ainda não existe (ex.: "Congelados"), o
sistema **cria a categoria sozinho** — mas ela aparece destacada na prévia
antes de confirmar, então dá pra abortar se foi erro de digitação.

### Como vai funcionar na tela

Nova rota `/painel/produtos/importar`, atrás da mesma permissão que já existe
para cadastrar produto (`produtos.criar` — não crio permissão nova, importar
é só criar em lote).

1. **Upload do CSV** — um campo de arquivo, sem nada além disso na primeira
   tela.
2. **Prévia antes de gravar qualquer coisa** — uma tabela mostrando linha por
   linha:
   - ✅ *Novo* — produto que vai ser criado
   - 🔄 *Atualizar* — produto existente, mostrando preço atual → preço novo
   - 🆕 *Categoria nova* — destacada em amarelo
   - ⚠️ *Erro* — linha com problema (preço inválido, unidade desconhecida,
     nome vazio), explicado ao lado; essa linha **não bloqueia as outras**,
     só ela fica de fora
3. **Confirmar importação** — um botão só, com o resumo ("12 novos, 3
   atualizados, 1 categoria nova, 1 erro ignorado"). Ao confirmar, tudo é
   gravado **numa única transação no banco**: ou entra tudo que é válido, ou
   não entra nada — nunca fica produto pela metade se a conexão cair no meio.

### O que a planilha NÃO traz (e como isso é resolvido)

- **Foto**: produtos importados nascem sem imagem. Aparecem normalmente na
  lista de Produtos (com um ícone de placeholder) — a equipe completa a foto
  depois, um por um, usando a Fase B (câmera do celular) pra ser mais rápido
  que no computador.
- **Disponibilidade**: nasce `ativo = true` e `disponível = true` por padrão
  — já pode vender assim que a planilha for confirmada.
- **Descrição curta, ordem de exibição, peso mínimo/incremento**: ficam com
  os valores padrão de sempre (editáveis depois, produto por produto, se
  quiser refinar).

### Impacto técnico

- **Banco**: nenhuma tabela nova. Uma função `import_products(payload jsonb)`
  nos moldes de `create_public_order` — `SECURITY DEFINER`, confere
  `produtos.criar` internamente, roda tudo dentro de uma transação, e usa a
  mesma lógica de `normalize_text` que já protege a busca de bairro contra
  variação de acentuação.
- **Permissão**: reaproveita `produtos.criar`. Sem RLS nova.
- **Auditoria**: já é automática — o trigger de auditoria de produtos
  (migration `0014`) cobre `INSERT` e `UPDATE`, então cada linha importada
  fica registrada com autor e data, igual a um cadastro manual.
- **Fluxo do pedido**: nenhum impacto.

---

## Fase B — Foto pela câmera do celular

Mudança pequena, não depende de nada, dá pra fazer imediatamente se você
topar.

Hoje o campo de imagem do formulário de produto é um `<input type="file">`
simples. Adicionando o atributo `capture="environment"`, o celular passa a
oferecer a câmera traseira como opção direta — ao lado de galeria/arquivos —
sem precisar de nenhuma biblioteca nova nem mudança de banco. Funciona tanto
no cadastro novo quanto na edição de produto existente.

---

## Fase C — Código de barras

**Faz sentido, com uma ressalva de compatibilidade**: a leitura automática
pela câmera usa a `BarcodeDetector` do navegador, que funciona bem no Chrome
Android; no iPhone/Safari o suporte é mais recente e inconsistente — nesse
caso a equipe digita o código manualmente como alternativa, sem travar o
cadastro.

### O que entra

1. **Banco**: coluna `products.barcode` (texto, opcional, único quando
   preenchido) — uma migration simples.
2. **Formulário de produto** (novo e editar): campo "Código de barras" com um
   botão "Escanear" que abre a câmera e preenche sozinho quando reconhece o
   código; digitação manual sempre disponível como alternativa.
3. **Ganho futuro**: ao escanear um código que já existe em outro produto, o
   sistema avisa "já existe um produto com este código" — evita duplicar
   cadastro de um item que só mudou de nome no fornecedor.

Não mexe no portal do cliente, no carrinho nem no checkout — é 100%
ferramenta interna de cadastro, útil principalmente para produto novo que
ainda não está na planilha do seu sistema atual.

---

## Ordem sugerida

**B primeiro** (trivial, sem risco, ganho imediato) → **A** (o grosso do
trabalho, mas o que mais economiza tempo de cadastro) → **C** (complementa as
duas anteriores, mas é o único opcional dos três).

Se preferir, começo pela Fase A direto — a ordem não muda nada tecnicamente,
é só uma sugestão de prioridade.


---

## Reclassificação em massa (28/08/2026)

A carga do sistema antigo não traz seção: os 5.024 produtos entraram quase
todos em "Mercearia" (4.218, ou 84%). A classificação foi refeita a partir do
**nome do produto**, com sete categorias novas — Matinais, Biscoitos e snacks,
Doces e chocolates, Molhos e conservas, Congelados, Bazar e utilidades e Pet —
e duas renomeadas (Frios → **Frios e laticínios**, Higiene → **Higiene e
beleza**; o slug não mudou, então os endereços da loja continuam valendo).

Resultado: Mercearia caiu de 4.218 para **1.923** produtos.

**A classificação erra e vai continuar errando** onde o nome menciona um
ingrediente: "SALG.BACON" não é açougue, "PIPOCA SABOR QUEIJO" não é frios.
Uma passada de correção tratou os casos conhecidos (biscoito/salgadinho →
snacks; caldo/sopa/miojo → molhos), mas o certo é a equipe ir ajustando pela
tela de Produtos conforme aparecer.

### Como voltar atrás

A categoria de cada produto foi salva antes da mudança:

```sql
-- desfaz a reclassificação inteira
update public.products p
   set category_id = b.category_id
  from public.products_categoria_backup b
 where b.id = p.id and p.category_id is distinct from b.category_id;
```

A tabela `public.products_categoria_backup` tem RLS ligada e nenhuma política:
não é acessível pela API, só pelo servidor. Pode ser descartada quando a
classificação estiver estável.

## Categorias do cliente (11/09/2026)

Mesmo depois da reclassificação de agosto, "Mercearia" seguia com 1.918
produtos e virou gaveta de tudo (escova de dente, água sanitária, cerveja,
chinelo, fralda, cigarro). E "Frios e laticínios" e "Congelados" estavam
desligadas: 184 produtos só apareciam pela busca.

Agora são **20 categorias, sem "Mercearia"**, com o nome que o cliente
procura: Hortifrúti, Açougue, Padaria, Frios e laticínios, Café da manhã,
Arroz, feijão e grãos, Massas e instantâneos, Óleos e temperos, Molhos e
conservas, Farinhas, açúcar e confeitaria, Congelados, Bebidas, Biscoitos e
salgadinhos, Doces e chocolates, Higiene e beleza, Bebê, Limpeza, Casa e
utilidades, Pet e Tabacaria.

- Cada produto foi classificado pelo nome (regras + revisão um a um dos que
  a regra não resolvia) numa planilha revisada pelo mercado, carregada em
  `reclassificacao_0044` e aplicada pela migration 0045.
- Categorias renomeadas mantêm o slug: `/c/matinais` abre "Café da manhã",
  `/c/cigarro` abre "Tabacaria", `/c/bazar-e-utilidades` abre "Casa e
  utilidades", `/c/biscoitos-e-snacks` abre "Biscoitos e salgadinhos".
- Mercearia, Salgadinhos e Medicamentos ficaram vazias e **desligadas** (não
  apagadas).
- 10 itens que eram atalhos do caixa ("CANCELAR COMPRA", "DIVERSOS", chips
  de celular...) foram **desativados** — continuam no cadastro.

### Como voltar atrás

```sql
-- produtos: categoria e ativo/inativo como estavam
update public.products p
   set category_id = b.category_id, is_active = b.is_active
  from public.products_categoria_backup_0044 b
 where b.id = p.id
   and (p.category_id is distinct from b.category_id or p.is_active is distinct from b.is_active);

-- categorias: nome, ordem e visibilidade como estavam
update public.categories c
   set name = b.name, sort_order = b.sort_order, is_active = b.is_active
  from public.categories_backup_0044 b
 where b.id = c.id;
-- as 5 novas (arroz-feijao-e-graos, massas-e-instantaneos, oleos-e-temperos,
-- farinhas-acucar-e-confeitaria, bebe) ficam vazias: desligue-as.
```

As tabelas `products_categoria_backup_0044`, `categories_backup_0044` e
`reclassificacao_0044` têm RLS ligada e nenhuma política (só o servidor lê).
Podem ser descartadas quando a nova organização estiver estável.
