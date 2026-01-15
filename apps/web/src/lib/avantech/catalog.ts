import type { Category, Product, SearchEntry, Variant, Language } from './types';
import { getLocalizedTextRequired } from './localize';

export const categories: Category[] = [
  {
    id: 'pipes',
    name: { en: 'Pipes', ru: 'Трубы', kg: 'Түтүктөр' },
    sortOrder: 0,
  },
  {
    id: 'fittings',
    name: { en: 'Fittings', ru: 'Фитинги', kg: 'Фитингдер' },
    sortOrder: 1,
  },
  {
    id: 'valves',
    name: { en: 'Valves', ru: 'Краны', kg: 'Крандар' },
    sortOrder: 2,
  },
  {
    id: 'fixtures',
    name: { en: 'Fixtures', ru: 'Смесители', kg: 'Аралаштыргычтар' },
    sortOrder: 3,
  },
  {
    id: 'consumables',
    name: { en: 'Consumables', ru: 'Расходники', kg: 'Сарпталуучу материалдар' },
    sortOrder: 4,
  },
];

export const products: Product[] = [
  {
    id: 'ppr-pipe',
    categoryId: 'pipes',
    name: { en: 'PPR Pipe', ru: 'ППР труба', kg: 'PPR түтүк' },
    imageUrl: '/avantech/pipe.svg',
  },
  {
    id: 'pvc-drain-pipe',
    categoryId: 'pipes',
    name: { en: 'PVC Drain Pipe', ru: 'ПВХ канализация түтүгү', kg: 'ПВХ канал түтүгү' },
    imageUrl: '/avantech/pipe.svg',
  },
  {
    id: 'ppr-elbow',
    categoryId: 'fittings',
    name: { en: 'PPR Elbow', ru: 'ППР уголок', kg: 'PPR бурчтук' },
    imageUrl: '/avantech/fitting.svg',
  },
  {
    id: 'ppr-coupling',
    categoryId: 'fittings',
    name: { en: 'PPR Coupling', ru: 'ППР муфта', kg: 'PPR муфта' },
    imageUrl: '/avantech/fitting.svg',
  },
  {
    id: 'pvc-tee',
    categoryId: 'fittings',
    name: { en: 'PVC Tee', ru: 'ПВХ тройник', kg: 'ПВХ тройник' },
    imageUrl: '/avantech/fitting.svg',
  },
  {
    id: 'ball-valve',
    categoryId: 'valves',
    name: { en: 'Ball Valve', ru: 'Шаровый кран', kg: 'Шар кран' },
    imageUrl: '/avantech/valve.svg',
  },
  {
    id: 'angle-stop-valve',
    categoryId: 'valves',
    name: { en: 'Angle Stop Valve', ru: 'Угловой вентиль', kg: 'Бурчтук вентиль' },
    imageUrl: '/avantech/valve.svg',
  },
  {
    id: 'faucet-mixer',
    categoryId: 'fixtures',
    name: { en: 'Faucet Mixer', ru: 'Смеситель', kg: 'Смеситель' },
    imageUrl: '/avantech/fixture.svg',
  },
  {
    id: 'shower-set',
    categoryId: 'fixtures',
    name: { en: 'Shower Set', ru: 'Душевой набор', kg: 'Душ топтому' },
    imageUrl: '/avantech/fixture.svg',
  },
  {
    id: 'ptfe-tape',
    categoryId: 'consumables',
    name: { en: 'PTFE Tape', ru: 'ФУМ лента', kg: 'ФУМ лента' },
    imageUrl: '/avantech/consumable.svg',
  },
  {
    id: 'silicone-sealant',
    categoryId: 'consumables',
    name: { en: 'Silicone Sealant', ru: 'Силикон герметик', kg: 'Силикон герметик' },
    imageUrl: '/avantech/consumable.svg',
  },
  {
    id: 'pipe-clamp',
    categoryId: 'consumables',
    name: { en: 'Pipe Clamp', ru: 'Хомут', kg: 'Кыскыч' },
    imageUrl: '/avantech/consumable.svg',
  },
];

export const variants: Variant[] = [
  {
    id: 'ppr-pipe-20-2m',
    productId: 'ppr-pipe',
    label: { en: '20 mm x 2 m', ru: '20 мм x 2 м', kg: '20 мм x 2 м' },
    attributes: { diameter: '20 mm', length: '2 m', material: 'PPR' },
    price: 120,
    sku: 'PPR-20-2',
    isActive: true,
  },
  {
    id: 'ppr-pipe-25-2m',
    productId: 'ppr-pipe',
    label: { en: '25 mm x 2 m', ru: '25 мм x 2 м', kg: '25 мм x 2 м' },
    attributes: { diameter: '25 mm', length: '2 m', material: 'PPR' },
    price: 160,
    sku: 'PPR-25-2',
    isActive: true,
  },
  {
    id: 'ppr-pipe-32-2m',
    productId: 'ppr-pipe',
    label: { en: '32 mm x 2 m', ru: '32 мм x 2 м', kg: '32 мм x 2 м' },
    attributes: { diameter: '32 mm', length: '2 m', material: 'PPR' },
    price: 230,
    sku: 'PPR-32-2',
    isActive: true,
  },
  {
    id: 'pvc-drain-50-1m',
    productId: 'pvc-drain-pipe',
    label: { en: '50 mm x 1 m', ru: '50 мм x 1 м', kg: '50 мм x 1 м' },
    attributes: { diameter: '50 mm', length: '1 m', material: 'PVC' },
    price: 180,
    sku: 'PVC-50-1',
    isActive: true,
  },
  {
    id: 'pvc-drain-110-2m',
    productId: 'pvc-drain-pipe',
    label: { en: '110 mm x 2 m', ru: '110 мм x 2 м', kg: '110 мм x 2 м' },
    attributes: { diameter: '110 mm', length: '2 m', material: 'PVC' },
    price: 420,
    sku: 'PVC-110-2',
    isActive: true,
  },
  {
    id: 'ppr-elbow-20',
    productId: 'ppr-elbow',
    label: { en: '20 mm', ru: '20 мм', kg: '20 мм' },
    attributes: { diameter: '20 mm', angle: '90 deg' },
    price: 35,
    sku: 'ELB-20',
    isActive: true,
  },
  {
    id: 'ppr-elbow-25',
    productId: 'ppr-elbow',
    label: { en: '25 mm', ru: '25 мм', kg: '25 мм' },
    attributes: { diameter: '25 mm', angle: '90 deg' },
    price: 45,
    sku: 'ELB-25',
    isActive: true,
  },
  {
    id: 'ppr-elbow-32',
    productId: 'ppr-elbow',
    label: { en: '32 mm', ru: '32 мм', kg: '32 мм' },
    attributes: { diameter: '32 mm', angle: '90 deg' },
    price: 65,
    sku: 'ELB-32',
    isActive: true,
  },
  {
    id: 'ppr-coupling-20',
    productId: 'ppr-coupling',
    label: { en: '20 mm', ru: '20 мм', kg: '20 мм' },
    attributes: { diameter: '20 mm' },
    price: 30,
    sku: 'CPL-20',
    isActive: true,
  },
  {
    id: 'ppr-coupling-25',
    productId: 'ppr-coupling',
    label: { en: '25 mm', ru: '25 мм', kg: '25 мм' },
    attributes: { diameter: '25 mm' },
    price: 40,
    sku: 'CPL-25',
    isActive: true,
  },
  {
    id: 'ppr-coupling-32',
    productId: 'ppr-coupling',
    label: { en: '32 mm', ru: '32 мм', kg: '32 мм' },
    attributes: { diameter: '32 mm' },
    price: 55,
    sku: 'CPL-32',
    isActive: true,
  },
  {
    id: 'pvc-tee-50',
    productId: 'pvc-tee',
    label: { en: '50 mm', ru: '50 мм', kg: '50 мм' },
    attributes: { diameter: '50 mm', angle: '90 deg' },
    price: 90,
    sku: 'TEE-50',
    isActive: true,
  },
  {
    id: 'pvc-tee-110',
    productId: 'pvc-tee',
    label: { en: '110 mm', ru: '110 мм', kg: '110 мм' },
    attributes: { diameter: '110 mm', angle: '90 deg' },
    price: 180,
    sku: 'TEE-110',
    isActive: true,
  },
  {
    id: 'ball-valve-1-2',
    productId: 'ball-valve',
    label: { en: '1/2"', ru: '1/2"', kg: '1/2"' },
    attributes: { thread: '1/2"', pressure: 'PN20' },
    price: 220,
    sku: 'BV-12',
    isActive: true,
  },
  {
    id: 'ball-valve-3-4',
    productId: 'ball-valve',
    label: { en: '3/4"', ru: '3/4"', kg: '3/4"' },
    attributes: { thread: '3/4"', pressure: 'PN20' },
    price: 280,
    sku: 'BV-34',
    isActive: true,
  },
  {
    id: 'ball-valve-1',
    productId: 'ball-valve',
    label: { en: '1"', ru: '1"', kg: '1"' },
    attributes: { thread: '1"', pressure: 'PN20' },
    price: 380,
    sku: 'BV-1',
    isActive: true,
  },
  {
    id: 'angle-stop-1-2',
    productId: 'angle-stop-valve',
    label: { en: '1/2"', ru: '1/2"', kg: '1/2"' },
    attributes: { thread: '1/2"', angle: '90 deg' },
    price: 180,
    sku: 'ASV-12',
    isActive: true,
  },
  {
    id: 'angle-stop-3-4',
    productId: 'angle-stop-valve',
    label: { en: '3/4"', ru: '3/4"', kg: '3/4"' },
    attributes: { thread: '3/4"', angle: '90 deg' },
    price: 240,
    sku: 'ASV-34',
    isActive: true,
  },
  {
    id: 'faucet-short',
    productId: 'faucet-mixer',
    label: { en: 'Short spout', ru: 'Короткий излив', kg: 'Кыска мурун' },
    attributes: {},
    price: 1200,
    sku: 'FM-S',
    isActive: true,
  },
  {
    id: 'faucet-tall',
    productId: 'faucet-mixer',
    label: { en: 'Tall spout', ru: 'Высокий излив', kg: 'Узун мурун' },
    attributes: {},
    price: 1550,
    sku: 'FM-T',
    isActive: true,
  },
  {
    id: 'shower-standard',
    productId: 'shower-set',
    label: { en: 'Standard', ru: 'Стандарт', kg: 'Стандарт' },
    attributes: {},
    price: 2300,
    sku: 'SS-STD',
    isActive: true,
  },
  {
    id: 'shower-rain',
    productId: 'shower-set',
    label: { en: 'Rain', ru: 'Тропический', kg: 'Тропикалык' },
    attributes: {},
    price: 3200,
    sku: 'SS-RN',
    isActive: true,
  },
  {
    id: 'ptfe-12',
    productId: 'ptfe-tape',
    label: { en: '12 mm', ru: '12 мм', kg: '12 мм' },
    attributes: { width: '12 mm', length: '10 m' },
    price: 35,
    sku: 'PTFE-12',
    isActive: true,
  },
  {
    id: 'ptfe-19',
    productId: 'ptfe-tape',
    label: { en: '19 mm', ru: '19 мм', kg: '19 мм' },
    attributes: { width: '19 mm', length: '10 m' },
    price: 55,
    sku: 'PTFE-19',
    isActive: true,
  },
  {
    id: 'sealant-white',
    productId: 'silicone-sealant',
    label: { en: 'White 280 ml', ru: 'Белый 280 мл', kg: 'Ак 280 мл' },
    attributes: { volume: '280 ml' },
    price: 280,
    sku: 'SL-280-W',
    isActive: true,
  },
  {
    id: 'sealant-clear',
    productId: 'silicone-sealant',
    label: { en: 'Clear 280 ml', ru: 'Прозрачный 280 мл', kg: 'Тунук 280 мл' },
    attributes: { volume: '280 ml' },
    price: 300,
    sku: 'SL-280-C',
    isActive: true,
  },
  {
    id: 'clamp-20',
    productId: 'pipe-clamp',
    label: { en: '20 mm', ru: '20 мм', kg: '20 мм' },
    attributes: { diameter: '20 mm' },
    price: 15,
    sku: 'CL-20',
    isActive: true,
  },
  {
    id: 'clamp-32',
    productId: 'pipe-clamp',
    label: { en: '32 mm', ru: '32 мм', kg: '32 мм' },
    attributes: { diameter: '32 mm' },
    price: 20,
    sku: 'CL-32',
    isActive: true,
  },
  {
    id: 'clamp-40',
    productId: 'pipe-clamp',
    label: { en: '40 mm', ru: '40 мм', kg: '40 мм' },
    attributes: { diameter: '40 mm' },
    price: 25,
    sku: 'CL-40',
    isActive: true,
  },
];

export const categoriesById = Object.fromEntries(categories.map((category) => [category.id, category]));

export const productsById = Object.fromEntries(products.map((product) => [product.id, product]));

export const variantsById = Object.fromEntries(variants.map((variant) => [variant.id, variant]));

export const variantsByProductId = variants.reduce<Record<string, Variant[]>>((acc, variant) => {
  if (!acc[variant.productId]) acc[variant.productId] = [];
  acc[variant.productId].push(variant);
  return acc;
}, {});

export const productsByCategory = categories
  .slice()
  .sort((a, b) => a.sortOrder - b.sortOrder)
  .map((category) => ({
    category,
    products: products.filter((product) => product.categoryId === category.id),
  }));

export const buildSearchEntries = (lang: Language): SearchEntry[] =>
  variants
    .filter((variant) => variant.isActive)
    .map((variant) => {
      const product = productsById[variant.productId];
      const title = getLocalizedTextRequired(product.name, lang);
      const subtitle = getLocalizedTextRequired(variant.label, lang);
      const sku = variant.sku;
      const searchText = [title, subtitle, sku].filter(Boolean).join(' ').toLowerCase();
      return {
        id: variant.id,
        productId: variant.productId,
        variantId: variant.id,
        title,
        subtitle,
        price: variant.price,
        sku,
        searchText,
      };
    });
