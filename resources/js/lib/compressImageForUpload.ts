/**
 * Client-side image downscale / WebP conversion before upload.
 * Keeps CRM gallery loads lighter without requiring a server image pipeline.
 */

export interface CompressImageOptions {
    /** Longest edge in pixels (default 1920). */
    maxDimension?: number;
    /** WebP/JPEG quality 0–1 (default 0.82). */
    quality?: number;
    /** Skip compression when file is already at/under this size (default 400 KB). */
    skipBelowBytes?: number;
}

const DEFAULTS: Required<CompressImageOptions> = {
    maxDimension: 1920,
    quality: 0.82,
    skipBelowBytes: 400 * 1024,
};

const supportsWebpEncode = (): boolean => {
    try {
        const canvas = document.createElement("canvas");
        canvas.width = 1;
        canvas.height = 1;
        return canvas.toDataURL("image/webp").startsWith("data:image/webp");
    } catch {
        return false;
    }
};

const loadImage = (file: File): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(url);
            resolve(img);
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error("Failed to decode image"));
        };
        img.src = url;
    });

const canvasToBlob = (
    canvas: HTMLCanvasElement,
    type: string,
    quality: number,
): Promise<Blob> =>
    new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) => {
                if (blob) resolve(blob);
                else reject(new Error("Image encoding failed"));
            },
            type,
            quality,
        );
    });

const replaceExtension = (name: string, ext: string): string => {
    const base = name.replace(/\.[^.]+$/, "") || name;
    return `${base}.${ext}`;
};

/**
 * Downscale and re-encode an image for web delivery.
 * Returns the original file when compression is skipped or fails.
 */
export async function compressImageForUpload(
    file: File,
    options: CompressImageOptions = {},
): Promise<File> {
    const { maxDimension, quality, skipBelowBytes } = {
        ...DEFAULTS,
        ...options,
    };

    if (!file.type.startsWith("image/")) {
        return file;
    }

    // Preserve animated GIFs; leave SVGs alone.
    if (file.type === "image/gif" || file.type === "image/svg+xml") {
        return file;
    }

    if (file.size <= skipBelowBytes) {
        return file;
    }

    try {
        const img = await loadImage(file);
        const longest = Math.max(img.naturalWidth, img.naturalHeight);

        const scale =
            longest > maxDimension ? maxDimension / longest : 1;
        const width = Math.max(1, Math.round(img.naturalWidth * scale));
        const height = Math.max(1, Math.round(img.naturalHeight * scale));

        // Already within bounds and reasonably sized — still re-encode to WebP
        // when the original is a huge JPEG/PNG, otherwise skip if small resize
        // wouldn't help much and type is already webp under 1.5MB.
        if (
            scale === 1 &&
            file.type === "image/webp" &&
            file.size < 1.5 * 1024 * 1024
        ) {
            return file;
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return file;

        ctx.drawImage(img, 0, 0, width, height);

        const preferWebp = supportsWebpEncode();
        const mime = preferWebp ? "image/webp" : "image/jpeg";
        const ext = preferWebp ? "webp" : "jpg";

        const blob = await canvasToBlob(canvas, mime, quality);

        // Keep original if compression somehow grew the file.
        if (blob.size >= file.size) {
            return file;
        }

        return new File([blob], replaceExtension(file.name, ext), {
            type: mime,
            lastModified: Date.now(),
        });
    } catch {
        return file;
    }
}

/** Compress a list of images in sequence (keeps memory predictable). */
export async function compressImagesForUpload(
    files: File[],
    options?: CompressImageOptions,
): Promise<File[]> {
    const out: File[] = [];
    for (const file of files) {
        out.push(await compressImageForUpload(file, options));
    }
    return out;
}
