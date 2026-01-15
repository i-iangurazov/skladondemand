import { NextResponse } from 'next/server';
import { prisma } from '@qr/db';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { listDriveFiles, getDriveAccessToken, downloadDriveFile, ensureDriveFilePublic } from '@/lib/images/driveApi';
import {
  buildDriveDirectUrl,
  extensionFromMime,
  normalizeSkuFromFilename,
  resolveImageKey,
  updateProductImageForVariant,
} from '@/lib/images/driveSync';
import { buildDriveSyncMarker, readDriveSyncState, writeDriveSyncState } from '@/lib/images/syncState';
import { uploadToStorage } from '@/lib/images/storage';
import { logAdminAction } from '@/lib/audit';

export const runtime = 'nodejs';

const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp']);

const getImageMode = () => {
  const mode = process.env.IMAGE_MODE;
  if (mode === 'copyToStorage') return 'copyToStorage' as const;
  return 'driveDirect' as const;
};

const extensionFromFilename = (filename: string) => {
  const parts = filename.split('.');
  if (parts.length < 2) return null;
  const ext = parts[parts.length - 1].toLowerCase();
  if (!IMAGE_EXTENSIONS.has(ext)) return null;
  return ext === 'jpeg' ? 'jpg' : ext;
};

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  if (!auth.user) {
    return NextResponse.json({ code: 'errors.unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const folderId = typeof body?.folderId === 'string' && body.folderId.trim().length > 0
    ? body.folderId.trim()
    : process.env.DRIVE_IMAGES_FOLDER_ID;

  if (!folderId) {
    return NextResponse.json({ code: 'errors.missingFolderId' }, { status: 400 });
  }

  try {
    const accessToken = await getDriveAccessToken();
    const files = await listDriveFiles(folderId, accessToken);
    const syncState = await readDriveSyncState();
    const nextState = { ...syncState };

    let matched = 0;
    let updated = 0;
    let unmatched = 0;
    let skipped = 0;
    let errors = 0;
    const warnings: string[] = [];
    const unmatchedFiles: string[] = [];

    for (const file of files) {
      const extFromName = extensionFromFilename(file.name);
      const extFromMime = extensionFromMime(file.mimeType);
      const extension = extFromName ?? extFromMime;

      if (!extension || (!IMAGE_MIME_TYPES.has(file.mimeType) && !extFromName)) {
        skipped += 1;
        continue;
      }

      const marker = buildDriveSyncMarker(file);
      const previousMarker = syncState[file.id] ? buildDriveSyncMarker(syncState[file.id]) : '';
      if (marker && previousMarker && marker === previousMarker) {
        skipped += 1;
        continue;
      }

      const sku = normalizeSkuFromFilename(file.name);
      if (!sku) {
        unmatched += 1;
        unmatchedFiles.push(file.name);
        nextState[file.id] = { etag: file.etag, modifiedTime: file.modifiedTime };
        continue;
      }

      const variant = await prisma.variant.findFirst({
        where: { sku: { equals: sku, mode: 'insensitive' } },
        include: { product: true },
      });

      if (!variant) {
        unmatched += 1;
        unmatchedFiles.push(file.name);
        nextState[file.id] = { etag: file.etag, modifiedTime: file.modifiedTime };
        continue;
      }

      matched += 1;
      try {
        const mode = getImageMode();
        let imageUrl = '';
        let imageSource = '';
        let imageSourceId = '';

        if (mode === 'driveDirect') {
          imageUrl = buildDriveDirectUrl(file.id);
          imageSource = 'drive';
          imageSourceId = file.id;
          try {
            await ensureDriveFilePublic(file.id, accessToken);
          } catch (error) {
            warnings.push(`Drive file ${file.name} may not be public.`);
          }
        } else {
          const buffer = await downloadDriveFile(file.id, accessToken);
          const key = resolveImageKey(sku, extension);
          imageUrl = await uploadToStorage({ key, body: buffer, contentType: file.mimeType });
          imageSource = 'storage';
          imageSourceId = key;
        }

        await updateProductImageForVariant(prisma, variant, imageUrl, {
          imageSource,
          imageSourceId,
          imageUpdatedAt: new Date(),
        });
        updated += 1;
        nextState[file.id] = { etag: file.etag, modifiedTime: file.modifiedTime };
      } catch (error) {
        console.error(error);
        errors += 1;
      }
    }

    await writeDriveSyncState(nextState);

    await logAdminAction({
      userId: auth.user.id,
      action: 'images.sync.drive',
      metadata: {
        folderId,
        matched,
        updated,
        unmatched,
        skipped,
        errors,
      },
    });

    return NextResponse.json({
      matched,
      updated,
      unmatched,
      skipped,
      errors,
      warnings,
      unmatchedFiles,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ code: 'errors.syncFailed' }, { status: 500 });
  }
}
