import { BadRequestException } from "@nestjs/common";
import { randomUUID } from "crypto";
import { diskStorage } from "multer";
import { existsSync, mkdirSync } from "fs";
import { join } from "path";

/**
 * Хранилище вложений поддержки (ТЗ 1.4): скриншоты (PNG/JPG/WebP) и видео
 * (MP4/MOV/WebM), до 50 МБ на файл, до 5 файлов на сообщение.
 * Файлы кладутся в UPLOADS_DIR/support (docker volume) и раздаются статикой
 * по /api/uploads/support/<имя> (см. main.ts useStaticAssets).
 */
export const UPLOADS_ROOT = process.env.UPLOADS_DIR || join(process.cwd(), "uploads");
export const SUPPORT_UPLOADS_DIR = join(UPLOADS_ROOT, "support");
/** Публичный URL-префикс, под которым статика видна через nginx → backend. */
export const SUPPORT_UPLOADS_URL_PREFIX = "/api/uploads/support";

export const SUPPORT_MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 МБ (ТЗ)
export const SUPPORT_MAX_FILES = 5;

/** mime → расширение. Расширение берём ИЗ mime (не из имени файла — оно клиентское). */
const ALLOWED_MIME_EXT: Record<string, string> = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
    "video/mp4": ".mp4",
    "video/quicktime": ".mov",
    "video/webm": ".webm",
};

export const isAllowedSupportMime = (mime: string): boolean => mime in ALLOWED_MIME_EXT;

export const supportMulterOptions = {
    storage: diskStorage({
        destination: (_req, _file, cb) => {
            if (!existsSync(SUPPORT_UPLOADS_DIR)) mkdirSync(SUPPORT_UPLOADS_DIR, { recursive: true });
            cb(null, SUPPORT_UPLOADS_DIR);
        },
        filename: (_req, file, cb) => {
            const ext = ALLOWED_MIME_EXT[file.mimetype] ?? "";
            cb(null, `${Date.now()}-${randomUUID()}${ext}`);
        },
    }),
    limits: { fileSize: SUPPORT_MAX_FILE_SIZE, files: SUPPORT_MAX_FILES },
    fileFilter: (_req: unknown, file: { mimetype: string }, cb: (e: Error | null, ok: boolean) => void) => {
        if (!isAllowedSupportMime(file.mimetype)) {
            return cb(new BadRequestException("errors.support_file_type"), false);
        }
        cb(null, true);
    },
};

export type SupportAttachment = { url: string; name: string; mime: string; size: number };

/** Собрать метаданные вложений из сохранённых multer'ом файлов. */
export const toAttachments = (files: Express.Multer.File[] | undefined): SupportAttachment[] =>
    (files ?? []).map((f) => ({
        url: `${SUPPORT_UPLOADS_URL_PREFIX}/${f.filename}`,
        // Имя показываем как прислал клиент, но без управляющих символов/путей
        name: (f.originalname || f.filename).replace(/[\\/\r\n\t]/g, "_").slice(0, 120),
        mime: f.mimetype,
        size: f.size,
    }));
