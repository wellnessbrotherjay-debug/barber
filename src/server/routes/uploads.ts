// ============================================================================
// Barber image upload lifecycle — avatar + work-photo gallery.
//
// Storage is LOCAL DISK only (no cloud provider). Files land under
//   <UPLOAD_DIR>/barber/{tenantId}/{barberId}/{avatar|gallery}/{uuid}.{ext}
// and are served read-only by the express.static mount at /uploads.
//
// Ownership model (matches the rest of /api/barber/*): the caller's identity
// comes exclusively from the verified JWT on req.tenant (userId + tenant_id).
// The barber_profiles row is resolved server-side from that userId, so a
// barber_id in the request body is never read and can never be spoofed —
// every write path and delete is scoped by that resolved barberId.
//
// HARD RULE: no raw SQL — every data operation calls a barber.* Postgres
// function (migrations/003_barber_functions.sql).
// ============================================================================

import express, { Request, Response, Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import type { Pool } from 'pg';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export const UPLOAD_DIR =
  process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');

const MAX_BYTES_PER_FILE = 8 * 1024 * 1024; // 8MB
const MAX_FILES_PER_REQUEST = 6;

const ALLOWED: Record<string, { ext: string }> = {
  'image/jpeg': { ext: 'jpg' },
  'image/png': { ext: 'png' },
  'image/webp': { ext: 'webp' },
  'image/heic': { ext: 'heic' },
  'image/heif': { ext: 'heic' },
};

// ---------------------------------------------------------------------------
// Magic-byte sniffing — the client's Content-Type is a hint, not evidence.
// The real type is derived from the buffer and must both be in the whitelist
// and agree with the declared type.
// ---------------------------------------------------------------------------

function sniffMime(buf: Buffer): string | null {
  if (buf.length < 12) return null;

  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  ) {
    return 'image/png';
  }

  // RIFF....WEBP
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    return 'image/webp';
  }

  // ISO-BMFF box: ....ftyp<brand>  — HEIC/HEIF brands
  if (buf.toString('ascii', 4, 8) === 'ftyp') {
    const brand = buf.toString('ascii', 8, 12);
    if (['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs', 'mif1', 'msf1'].includes(brand)) {
      return 'image/heic';
    }
  }

  return null;
}

/** Normalises heif -> heic so declared/sniffed comparison is stable. */
function canonical(mime: string): string {
  return mime === 'image/heif' ? 'image/heic' : mime.toLowerCase();
}

// ---------------------------------------------------------------------------
// Multer — memory storage so the buffer can be sniffed BEFORE anything is
// written to disk, and so a rejected upload never leaves a stray file behind.
// Filenames are always a server-generated uuid; the client's filename is
// discarded entirely (no path traversal, no collisions, no content sniffing
// off a user-controlled extension).
// ---------------------------------------------------------------------------

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES_PER_FILE, files: MAX_FILES_PER_REQUEST },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED[canonical(file.mimetype)]) {
      cb(new Error(`Unsupported file type "${file.mimetype}". Allowed: JPEG, PNG, WebP, HEIC.`));
      return;
    }
    cb(null, true);
  },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getOwnBarberProfileId(pool: Pool, userId: string): Promise<string | null> {
  const result = await pool.query('SELECT * FROM barber.get_own_barber_profile_id(user_id_ => $1)', [userId]);
  return result.rows[0]?.id || null;
}

/** Only [a-zA-Z0-9_-] survives — defence in depth for ids used as path segments. */
function safeSegment(value: string): string {
  return String(value).replace(/[^a-zA-Z0-9_-]/g, '');
}

function publicUrl(storageKey: string): string {
  return `/uploads/${storageKey}`;
}

interface StoredFile {
  storageKey: string;
  url: string;
  bytes: number;
  mimeType: string;
}

/**
 * Validates the buffer and writes it to
 * barber/{tenantId}/{barberId}/{kind}/{uuid}.{ext}.
 * Both ids are server-derived, so a barber can never write outside their
 * own directory.
 */
async function storeFile(
  file: Express.Multer.File,
  tenantId: string,
  barberId: string,
  kind: 'avatar' | 'gallery'
): Promise<StoredFile> {
  const declared = canonical(file.mimetype);
  const sniffed = sniffMime(file.buffer);

  if (!sniffed) {
    throw new UploadError('File content is not a recognised image (JPEG, PNG, WebP or HEIC).');
  }
  if (!ALLOWED[sniffed]) {
    throw new UploadError(`Unsupported image format detected in file content: ${sniffed}.`);
  }
  if (sniffed !== declared) {
    throw new UploadError(
      `File content (${sniffed}) does not match its declared type (${file.mimetype}).`
    );
  }
  if (file.size > MAX_BYTES_PER_FILE) {
    throw new UploadError('File exceeds the 8MB limit.');
  }

  const dirKey = path.posix.join('barber', safeSegment(tenantId), safeSegment(barberId), kind);
  const storageKey = path.posix.join(dirKey, `${randomUUID()}.${ALLOWED[sniffed].ext}`);
  const absDir = path.join(UPLOAD_DIR, dirKey);
  const absPath = path.join(UPLOAD_DIR, storageKey);

  await fsp.mkdir(absDir, { recursive: true });
  await fsp.writeFile(absPath, file.buffer, { mode: 0o644 });

  return { storageKey, url: publicUrl(storageKey), bytes: file.size, mimeType: sniffed };
}

/** Best-effort unlink; a missing file must not fail the DB delete. */
async function removeFile(storageKey: string): Promise<void> {
  const absPath = path.resolve(UPLOAD_DIR, storageKey);
  // Never unlink outside UPLOAD_DIR, whatever the stored key says.
  if (!absPath.startsWith(path.resolve(UPLOAD_DIR) + path.sep)) return;
  try {
    await fsp.unlink(absPath);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.error('[uploads] failed to unlink', storageKey, err);
    }
  }
}

/**
 * Re-denormalises barber_profiles.work_photos (jsonb string[] of URLs) and
 * work_photos_count from the relational barber_work_photos rows, so the public
 * GET /api/barbers/:id keeps returning work_photos as a plain string[].
 */
async function syncWorkPhotosJsonb(pool: Pool, barberId: string): Promise<void> {
  await pool.query('SELECT * FROM barber.sync_work_photos(barber_id_ => $1)', [barberId]);
}

class UploadError extends Error {}

/** Resolves { pool, tenantId, barberId } or writes the error response. */
async function resolveOwner(
  req: Request,
  res: Response
): Promise<{ pool: Pool; tenantId: string; barberId: string } | null> {
  const pool = req.tenant!.pool as Pool;
  const tenantId = req.tenant!.companyId;
  const userId = req.tenant!.userId!;
  const barberId = await getOwnBarberProfileId(pool, userId);
  if (!barberId) {
    res.status(404).json({ error: 'Barber profile not found' });
    return null;
  }
  return { pool, tenantId, barberId };
}

interface PhotoRow {
  id: string;
  url: string;
  storage_key: string;
  sort_order: number;
  caption: string | null;
  bytes: number | null;
  mime_type: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Router factory
// ---------------------------------------------------------------------------

type Middleware = (req: Request, res: Response, next: express.NextFunction) => void;

export function createUploadsRouter(requireBarberAuth: Middleware): Router {
  const router = express.Router();

  // Ensure the storage root exists at boot so the first upload doesn't race.
  try {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  } catch (err) {
    console.error('[uploads] could not create UPLOAD_DIR', UPLOAD_DIR, err);
  }

  // -------------------------------------------------------------------------
  // POST /api/barber/upload/avatar  (multipart, field: file)
  // -> { url }
  // -------------------------------------------------------------------------
  router.post(
    '/api/barber/upload/avatar',
    requireBarberAuth,
    (req: Request, res: Response, next: express.NextFunction) => {
      upload.single('file')(req, res, (err: unknown) => {
        if (err) return res.status(400).json({ error: multerMessage(err) });
        next();
      });
    },
    async (req: Request, res: Response) => {
      try {
        const owner = await resolveOwner(req, res);
        if (!owner) return;
        const file = req.file;
        if (!file) return res.status(400).json({ error: 'No file uploaded (expected field "file")' });

        const stored = await storeFile(file, owner.tenantId, owner.barberId, 'avatar');
        await owner.pool.query('SELECT * FROM barber.set_user_avatar(user_id_ => $1, avatar_url_ => $2)', [
          req.tenant!.userId,
          stored.url,
        ]);
        res.json({ url: stored.url });
      } catch (error) {
        if (error instanceof UploadError) return res.status(400).json({ error: error.message });
        console.error('Avatar upload failed:', error);
        res.status(500).json({ error: (error as Error).message });
      }
    }
  );

  // -------------------------------------------------------------------------
  // POST /api/barber/upload/gallery  (multipart, field: files, max 6)
  // -> { photos: PhotoRow[] }  (the caller's full gallery, ordered)
  // -------------------------------------------------------------------------
  router.post(
    '/api/barber/upload/gallery',
    requireBarberAuth,
    (req: Request, res: Response, next: express.NextFunction) => {
      upload.array('files', MAX_FILES_PER_REQUEST)(req, res, (err: unknown) => {
        if (err) return res.status(400).json({ error: multerMessage(err) });
        next();
      });
    },
    async (req: Request, res: Response) => {
      const written: string[] = [];
      try {
        const owner = await resolveOwner(req, res);
        if (!owner) return;
        const files = (req.files as Express.Multer.File[] | undefined) || [];
        if (files.length === 0) {
          return res.status(400).json({ error: 'No files uploaded (expected field "files")' });
        }
        if (files.length > MAX_FILES_PER_REQUEST) {
          return res.status(400).json({ error: `At most ${MAX_FILES_PER_REQUEST} photos per upload` });
        }

        // Validate + write all files first; if any fails, unwind the ones
        // already on disk so a rejected batch leaves nothing behind.
        const stored: StoredFile[] = [];
        for (const file of files) {
          const s = await storeFile(file, owner.tenantId, owner.barberId, 'gallery');
          stored.push(s);
          written.push(s.storageKey);
        }

        const maxRes = await owner.pool.query(
          'SELECT * FROM barber.get_max_work_photo_sort(barber_id_ => $1)',
          [owner.barberId]
        );
        let nextOrder = Number(maxRes.rows[0]?.max ?? -1) + 1;

        for (const s of stored) {
          await owner.pool.query(
            'SELECT * FROM barber.add_work_photo(barber_id_ => $1, storage_key_ => $2, url_ => $3, sort_order_ => $4, bytes_ => $5, mime_type_ => $6)',
            [owner.barberId, s.storageKey, s.url, nextOrder++, s.bytes, s.mimeType]
          );
        }

        await syncWorkPhotosJsonb(owner.pool, owner.barberId);
        const photos = await listPhotos(owner.pool, owner.barberId);
        res.json({ photos });
      } catch (error) {
        await Promise.all(written.map(removeFile));
        if (error instanceof UploadError) return res.status(400).json({ error: error.message });
        console.error('Gallery upload failed:', error);
        res.status(500).json({ error: (error as Error).message });
      }
    }
  );

  // -------------------------------------------------------------------------
  // GET /api/barber/photos -> PhotoRow[]
  // -------------------------------------------------------------------------
  router.get('/api/barber/photos', requireBarberAuth, async (req: Request, res: Response) => {
    try {
      const owner = await resolveOwner(req, res);
      if (!owner) return;
      res.json(await listPhotos(owner.pool, owner.barberId));
    } catch (error) {
      console.error('Error listing work photos:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // -------------------------------------------------------------------------
  // DELETE /api/barber/photos/:id -> { success, photos }
  // Ownership enforced in the DELETE predicate itself; 404 when not owned.
  // -------------------------------------------------------------------------
  router.delete('/api/barber/photos/:id', requireBarberAuth, async (req: Request, res: Response) => {
    try {
      const owner = await resolveOwner(req, res);
      if (!owner) return;

      const result = await owner.pool.query(
        'SELECT * FROM barber.delete_work_photo(photo_id_ => $1, barber_id_ => $2)',
        [req.params.id, owner.barberId]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Photo not found' });
      }

      await removeFile(result.rows[0].storage_key);
      await syncWorkPhotosJsonb(owner.pool, owner.barberId);
      res.json({ success: true, photos: await listPhotos(owner.pool, owner.barberId) });
    } catch (error) {
      console.error('Error deleting work photo:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // -------------------------------------------------------------------------
  // PATCH /api/barber/photos/reorder   body { ids: string[] } -> { photos }
  // 403 if ANY id in the list is not owned by the caller.
  // -------------------------------------------------------------------------
  router.patch('/api/barber/photos/reorder', requireBarberAuth, async (req: Request, res: Response) => {
    try {
      const owner = await resolveOwner(req, res);
      if (!owner) return;

      const ids = (req.body?.ids ?? []) as unknown;
      if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string' || !id)) {
        return res.status(400).json({ error: 'Body must be { ids: string[] }' });
      }
      const list = ids as string[];
      if (new Set(list).size !== list.length) {
        return res.status(400).json({ error: 'Duplicate photo ids in reorder request' });
      }

      const ownedRes = await owner.pool.query(
        'SELECT * FROM barber.get_work_photo_ids(barber_id_ => $1)',
        [owner.barberId]
      );
      const owned = new Set(ownedRes.rows.map((r: { id: string }) => String(r.id)));
      if (list.some((id) => !owned.has(id))) {
        return res.status(403).json({ error: 'One or more photos do not belong to you' });
      }

      for (let i = 0; i < list.length; i++) {
        await owner.pool.query(
          'SELECT * FROM barber.set_work_photo_order(photo_id_ => $1, barber_id_ => $2, sort_order_ => $3)',
          [list[i], owner.barberId, i]
        );
      }

      await syncWorkPhotosJsonb(owner.pool, owner.barberId);
      res.json({ photos: await listPhotos(owner.pool, owner.barberId) });
    } catch (error) {
      console.error('Error reordering work photos:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  });

  return router;
}

async function listPhotos(pool: Pool, barberId: string): Promise<PhotoRow[]> {
  const { rows } = await pool.query(
    'SELECT * FROM barber.list_work_photos(barber_id_ => $1)',
    [barberId]
  );
  return rows as PhotoRow[];
}

function multerMessage(err: unknown): string {
  const e = err as { code?: string; message?: string };
  if (e?.code === 'LIMIT_FILE_SIZE') return 'Each photo must be 8MB or smaller.';
  if (e?.code === 'LIMIT_FILE_COUNT') return `At most ${MAX_FILES_PER_REQUEST} photos per upload.`;
  if (e?.code === 'LIMIT_UNEXPECTED_FILE') return 'Unexpected file field in upload.';
  return e?.message || 'Upload rejected.';
}

export default createUploadsRouter;
