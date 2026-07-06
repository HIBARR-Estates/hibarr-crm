import type { DealFile } from "@/Types/api/file";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

export interface WorkspaceFilePreview {
    id: number;
    name: string;
    sizeLabel: string;
    uploadedLabel: string;
    iconName: string;
    file: DealFile;
}

export function formatFileSize(bytes: string | number): string {
    const size = Number.parseInt(String(bytes), 10);
    if (!size || size === 0) return "0 B";

    const units = ["B", "KB", "MB", "GB"];
    const index = Math.floor(Math.log(size) / Math.log(1024));
    const value = size / 1024 ** index;

    return `${value.toFixed(index === 0 ? 0 : 2)} ${units[index]}`;
}

export function getFileIconName(filename: string): string {
    const extension = filename.split(".").pop()?.toLowerCase() || "";

    if (
        ["jpg", "jpeg", "png", "gif", "bmp", "svg", "webp"].includes(extension)
    ) {
        return "image";
    }

    if (["zip", "rar", "7z", "tar", "gz"].includes(extension)) {
        return "archive";
    }

    return "file-text";
}

export function toWorkspaceFilePreview(file: DealFile): WorkspaceFilePreview {
    return {
        id: file.id,
        name: file.filename,
        sizeLabel: formatFileSize(file.size),
        uploadedLabel: file.created_at
            ? dayjs(file.created_at).fromNow()
            : "recently",
        iconName: getFileIconName(file.filename),
        file,
    };
}

export function downloadDealFile(file: DealFile): void {
    if (file.external_url) {
        window.open(file.external_url, "_blank");
        return;
    }

    const link = document.createElement("a");
    link.href = route("deal-files.download", file.id);
    link.download = file.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
