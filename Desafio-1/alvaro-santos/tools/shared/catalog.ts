export interface CatalogProduct {
  readonly id: string;
  readonly nome: string;
  readonly preco: number;
  readonly moeda: 'BRL';
  readonly estoque: number;
  readonly categoria: string;
}

/**
 * Catálogo determinístico oficial da Nexus Store (Fonte da Verdade no backend).
 * IDs alinhados às imagens estáticas em `frontend/public/products/prod_001.png`..`prod_007.png`.
 */
export const CATALOG_PRODUCTS: readonly CatalogProduct[] = [
  {
    id: 'prod_001',
    nome: 'PlayStation 5 Slim 1TB',
    preco: 3799.9,
    moeda: 'BRL',
    estoque: 5,
    categoria: 'consoles',
  },
  {
    id: 'prod_002',
    nome: 'Headset Gamer Sem Fio 7.1',
    preco: 449.9,
    moeda: 'BRL',
    estoque: 14,
    categoria: 'headsets',
  },
  {
    id: 'prod_003',
    nome: 'Teclado Mecânico RGB Switch Brown',
    preco: 329.9,
    moeda: 'BRL',
    estoque: 18,
    categoria: 'teclados',
  },
  {
    id: 'prod_004',
    nome: 'Mouse Gamer Wireless 26000 DPI',
    preco: 249.9,
    moeda: 'BRL',
    estoque: 22,
    categoria: 'mouses',
  },
  {
    id: 'prod_005',
    nome: 'Astro Bot — Edição Física PS5',
    preco: 299.9,
    moeda: 'BRL',
    estoque: 11,
    categoria: 'jogos',
  },
  {
    id: 'prod_006',
    nome: 'Monitor Gamer 27" IPS 180Hz',
    preco: 1499.9,
    moeda: 'BRL',
    estoque: 7,
    categoria: 'monitores',
  },
  {
    id: 'prod_007',
    nome: 'Mousepad Speed Estendido 90x40cm',
    preco: 79.9,
    moeda: 'BRL',
    estoque: 35,
    categoria: 'acessorios',
  },
] as const;

export function listCatalogProducts(categoria?: string): CatalogProduct[] {
  const normalizedCategory = categoria?.trim().toLowerCase();
  if (!normalizedCategory) {
    return [...CATALOG_PRODUCTS];
  }

  return CATALOG_PRODUCTS.filter(
    (product) => product.categoria.toLowerCase() === normalizedCategory,
  );
}

export function findCatalogProductById(produtoId: string): CatalogProduct | undefined {
  return CATALOG_PRODUCTS.find((product) => product.id === produtoId);
}
