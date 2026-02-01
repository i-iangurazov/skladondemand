import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { PrismaClient } from '@qr/db';

const prisma = new PrismaClient();

const clampRating = (value: number) => Math.max(1, Math.min(5, value));

const extractHandle = (row: Record<string, string>) => {
  const direct = row.product_handle || row.productHandle || row.handle;
  if (direct) return direct.trim();
  const url = row.product_url || row.productUrl || row.url;
  if (url) {
    const match = url.match(/\/products\/([^/?#]+)/);
    if (match?.[1]) return match[1];
  }
  return null;
};

const parseDate = (value?: string) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const dedupeKey = (productHandle: string, authorName: string, body: string) =>
  `${productHandle}::${authorName.toLowerCase()}::${body.slice(0, 128).toLowerCase()}`;

const run = async () => {
  const inputPath = process.argv[2];
  const cwd = process.cwd();
  const candidateRoots = [cwd, path.resolve(cwd, '..'), path.resolve(cwd, '..', '..')];
  const defaultPath =
    candidateRoots
      .map((root) => path.join(root, 'docs', 'reviews.Eybh8PKfDj.csv'))
      .find((candidate) => fs.existsSync(candidate)) ?? path.join(cwd, 'docs', 'reviews.Eybh8PKfDj.csv');
  const resolvedPath = inputPath
    ? path.isAbsolute(inputPath)
      ? inputPath
      : candidateRoots
          .map((root) => path.join(root, inputPath))
          .find((candidate) => fs.existsSync(candidate)) ?? path.resolve(cwd, inputPath)
    : defaultPath;

  if (!fs.existsSync(resolvedPath)) {
    console.error(
      `CSV file not found. Resolved path: ${resolvedPath}\n` +
        'Usage: pnpm --filter ./apps/web tsx scripts/import-reviews.ts /absolute/path/to/reviews.csv'
    );
    process.exit(1);
  }

  const csv = fs.readFileSync(resolvedPath, 'utf8');
  const records = parse(csv, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Array<Record<string, string>>;

  const seen = new Set<string>();
  let imported = 0;
  let skipped = 0;

  for (const row of records) {
    const productHandle = extractHandle(row);
    if (!productHandle) {
      skipped += 1;
      continue;
    }
    const body = (row.body || row.text || row.content || row.review || '').trim();
    if (!body) {
      skipped += 1;
      continue;
    }

    const authorName = (row.authorName || row.author || row.name || 'Anonymous').trim() || 'Anonymous';
    const authorEmail = row.authorEmail || row.email || null;
    const ratingRaw = Number(row.rating || row.stars || row.score || 0);
    if (!Number.isFinite(ratingRaw)) {
      skipped += 1;
      continue;
    }
    const rating = clampRating(ratingRaw);
    const createdAt = parseDate(row.createdAt || row.created_at || row.date) ?? new Date();

    const key = dedupeKey(productHandle, authorName, body);
    if (seen.has(key)) {
      skipped += 1;
      continue;
    }
    seen.add(key);

    const existing = await prisma.review.findFirst({
      where: { productHandle, body },
      select: { id: true },
    });
    if (existing) {
      skipped += 1;
      continue;
    }

    await prisma.review.create({
      data: {
        productHandle,
        rating,
        title: row.title?.trim() || null,
        body,
        authorName,
        authorEmail: authorEmail?.trim() || null,
        avatarUrl: row.avatarUrl || row.avatar || null,
        source: 'import',
        createdAt,
      },
    });

    imported += 1;
  }

  console.log(`Imported ${imported} reviews. Skipped ${skipped}.`);
};

run()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
