import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { prisma, ImportJobStatus, ImportRowStatus, ImportSourceType } from '@qr/db';
import { importRowsFromDb } from '@/lib/importer/jobs';
import { commitImportRows } from '@/lib/importer/service';
import { resolveCloudshopRetailPrice, resolveCloudshopWholesalePrice } from '@/lib/importer/cloudshop';
import { checkRateLimit } from '@/lib/rateLimit';
import { logAdminAction } from '@/lib/audit';
import { buildProductKey } from '@/lib/importer/variant';
import type { CloudshopCommitOptions, CloudshopPriceStrategy, ImportOverrides, PriceMode } from '@/lib/importer/types';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const rate = checkRateLimit({
    key: `import:commit:${auth.user.id}`,
    limit: 5,
    windowMs: 10 * 60 * 1000,
  });
  if (!rate.ok) {
    return NextResponse.json(
      { code: 'errors.rateLimited' },
      {
        status: 429,
        headers: { 'Retry-After': Math.ceil(rate.retryAfterMs / 1000).toString() },
      }
    );
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body.importId !== 'string') {
    return NextResponse.json({ code: 'errors.invalidPayload' }, { status: 400 });
  }

  const priceMode: PriceMode = body.priceMode === 'wholesale' ? 'wholesale' : 'retail';
  if (typeof body.checksum !== 'string') {
    return NextResponse.json({ code: 'errors.invalidChecksum' }, { status: 400 });
  }
  const checksum = body.checksum;
  const allowNeedsReview = body.allowNeedsReview === true;
  const overrides: ImportOverrides | null =
    body.overrides && typeof body.overrides === 'object' && !Array.isArray(body.overrides)
      ? (body.overrides as ImportOverrides)
      : null;
  const priceStrategy: CloudshopPriceStrategy = body.priceStrategy === 'maxLocation' ? 'maxLocation' : 'sale';
  const wholesaleLocation =
    typeof body.wholesaleLocation === 'string' && body.wholesaleLocation.trim()
      ? body.wholesaleLocation.trim()
      : null;
  const skipPriceZero = body.skipPriceZero !== false;
  const skipMissingImage = body.skipMissingImage === true;

  const commitOptions: CloudshopCommitOptions = {
    priceStrategy,
    wholesaleLocation,
    skipPriceZero,
    skipMissingImage,
  };

  const applyCloudshopCommitOptions = (rows: ReturnType<typeof importRowsFromDb>) => {
    const skipped: Array<{ rowId: string; sku?: string; message: string }> = [];
    const updated = rows.map((row) => {
      const raw = row.raw && typeof row.raw === 'object' ? (row.raw as Record<string, unknown>) : null;
      const priceRetail = raw
        ? resolveCloudshopRetailPrice(raw, commitOptions.priceStrategy)
        : row.variant.priceRetail ?? row.variant.price;
      const priceWholesale = raw
        ? resolveCloudshopWholesalePrice(raw, commitOptions.wholesaleLocation)
        : row.variant.priceWholesale ?? null;

      const nextRow = {
        ...row,
        variant: {
          ...row.variant,
          price: priceRetail,
          priceRetail,
          priceWholesale,
        },
      };

      const missingImage = !row.image?.url;
      if (commitOptions.skipPriceZero && priceRetail === 0) {
        skipped.push({
          rowId: row.id,
          sku: row.variant.sku,
          message: 'Skipped: price is 0.',
        });
        return null;
      }
      if (commitOptions.skipMissingImage && missingImage) {
        skipped.push({
          rowId: row.id,
          sku: row.variant.sku,
          message: 'Skipped: missing image.',
        });
        return null;
      }

      return nextRow;
    });

    return {
      rows: updated.filter((row): row is typeof rows[number] => Boolean(row)),
      skipped,
    };
  };

  try {
    const job = await prisma.importJob.findUnique({
      where: { id: body.importId },
      include: { rows: { orderBy: { rowIndex: 'asc' } } },
    });

    if (!job) {
      return NextResponse.json({ code: 'errors.importNotFound' }, { status: 404 });
    }

    if (job.status === ImportJobStatus.COMMITTED) {
      return NextResponse.json({ code: 'errors.importAlreadyCommitted' }, { status: 409 });
    }
    if (job.status === ImportJobStatus.UNDONE) {
      return NextResponse.json({ code: 'errors.importAlreadyUndone' }, { status: 409 });
    }

    if (checksum && checksum !== job.checksum) {
      return NextResponse.json({ code: 'errors.importChecksumMismatch' }, { status: 400 });
    }

    const readyRows = job.rows.filter((row) => row.status === ImportRowStatus.READY);
    let rows = importRowsFromDb(readyRows);
    let skippedRows: Array<{ rowId: string; sku?: string; message: string }> = [];

    if (overrides?.groups) {
      rows = rows.map((row) => {
        const baseName = row.product.ruBase ?? row.product.ru;
        const productKey = row.productKey || buildProductKey(row.category.ru || 'Без категории', baseName);
        const groupOverride = overrides.groups[productKey];
        if (!groupOverride) return row;

        const labelKey = row.rowFingerprint ?? row.id;
        const labelOverride = groupOverride.labels?.[labelKey];
        const categoryRu = groupOverride.categoryRu?.trim();
        const nextCategory = categoryRu ? { ...row.category, ru: categoryRu } : row.category;
        const nextBaseName = baseName;
        const nextProductKey = categoryRu ? buildProductKey(categoryRu, nextBaseName) : productKey;

        return {
          ...row,
          category: nextCategory,
          productKey: nextProductKey,
          targetProductId: groupOverride.productId,
          variant: {
            ...row.variant,
            labelRu: labelOverride ?? row.variant.labelRu,
          },
        };
      });
    }

    if (job.sourceType === ImportSourceType.CLOUDSHOP_XLSX) {
      const applied = applyCloudshopCommitOptions(rows);
      rows = applied.rows;
      skippedRows = applied.skipped;
    }

    const hasNeedsReview = rows.some((row) => row.source?.needsReview);
    if (hasNeedsReview && !allowNeedsReview) {
      return NextResponse.json({ code: 'errors.importNeedsReview' }, { status: 409 });
    }

    const report = await commitImportRows(rows, priceMode);
    if (skippedRows.length) {
      report.skipped += skippedRows.length;
      report.details.push(
        ...skippedRows.map((row) => ({
          rowId: row.rowId,
          sku: row.sku,
          status: 'skipped' as const,
          message: row.message,
        }))
      );
    }

    const groupedIds: Record<ImportRowStatus, string[]> = {
      [ImportRowStatus.CREATED]: [],
      [ImportRowStatus.UPDATED]: [],
      [ImportRowStatus.SKIPPED]: [],
      [ImportRowStatus.FAILED]: [],
      [ImportRowStatus.ERROR]: [],
      [ImportRowStatus.READY]: [],
    };

    report.details.forEach((detail) => {
      if (detail.status === 'created') groupedIds[ImportRowStatus.CREATED].push(detail.rowId);
      else if (detail.status === 'updated') groupedIds[ImportRowStatus.UPDATED].push(detail.rowId);
      else if (detail.status === 'skipped') groupedIds[ImportRowStatus.SKIPPED].push(detail.rowId);
      else if (detail.status === 'failed') groupedIds[ImportRowStatus.FAILED].push(detail.rowId);
    });

    const baseTotals =
      job.totals && typeof job.totals === 'object' && !Array.isArray(job.totals) ? job.totals : {};
    const totals = {
      ...baseTotals,
      committed: {
        created: report.created,
        updated: report.updated,
        skipped: report.skipped,
        failed: report.failed,
      },
    };

    const createdEntities = {
      categories: Array.from(new Set(report.createdEntities?.categories ?? [])),
      products: Array.from(new Set(report.createdEntities?.products ?? [])),
      variants: Array.from(new Set(report.createdEntities?.variants ?? [])),
    };

    const reportJson = {
      report: report.details,
      summary: {
        created: report.created,
        updated: report.updated,
        skipped: report.skipped,
        failed: report.failed,
      },
      createdEntities,
      committedAt: new Date().toISOString(),
      priceMode,
      commitOptions: job.sourceType === ImportSourceType.CLOUDSHOP_XLSX ? commitOptions : undefined,
    };

    const mapping =
      job.mapping && typeof job.mapping === 'object' && !Array.isArray(job.mapping) ? { ...job.mapping } : {};
    if (job.sourceType === ImportSourceType.CLOUDSHOP_XLSX) {
      mapping.commitOptions = commitOptions;
    }
    if (overrides) {
      mapping.overrides = overrides;
    }

    await prisma.$transaction(async (tx) => {
      await Promise.all(
        [
          ImportRowStatus.CREATED,
          ImportRowStatus.UPDATED,
          ImportRowStatus.SKIPPED,
          ImportRowStatus.FAILED,
        ].map((status) =>
          groupedIds[status].length
            ? tx.importRow.updateMany({
                where: { id: { in: groupedIds[status] } },
                data: { status },
              })
            : Promise.resolve()
        )
      );

      await tx.importJob.update({
        where: { id: job.id },
        data: {
          status: ImportJobStatus.COMMITTED,
          totals,
          reportJson,
          mapping,
        },
      });
    });

    await logAdminAction({
      userId: auth.user.id,
      action: 'import.commit',
      importJobId: job.id,
      metadata: {
        created: report.created,
        updated: report.updated,
        skipped: report.skipped,
        failed: report.failed,
      },
    });

    return NextResponse.json(report);
  } catch (error) {
    console.error(error);
    if (body?.importId) {
      await prisma.importJob
        .update({
          where: { id: body.importId },
          data: {
            status: ImportJobStatus.FAILED,
            reportJson: {
              error: 'Commit failed',
              failedAt: new Date().toISOString(),
            },
          },
        })
        .catch((err) => console.error('Failed to mark import as failed', err));
    }
    return NextResponse.json({ code: 'errors.importFailed' }, { status: 500 });
  }
}
