import type { LeadContactFile } from "@/Types/api/file";
import {
    formatFileSize,
    getFileIconName,
} from "@/Pages/Deals/Redesign/adapters/fileAdapter";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

export interface LeadWorkspaceFilePreview {
    id: number;
    name: string;
    sizeLabel: string;
    uploadedLabel: string;
    iconName: string;
    file: LeadContactFile;
}

export function toLeadWorkspaceFilePreview(
    file: LeadContactFile,
): LeadWorkspaceFilePreview {
    return {
        id: file.id,
        // A user-set label (AttachmentFileCard's rename action) always wins
        // over the raw uploaded filename.
        name: file.description?.trim() || file.filename,
        sizeLabel: formatFileSize(file.size),
        uploadedLabel: file.created_at
            ? dayjs(file.created_at).fromNow()
            : "recently",
        iconName: getFileIconName(file.filename),
        file,
    };
}

export function downloadLeadContactFile(file: LeadContactFile): void {
    if (file.external_url) {
        window.open(file.external_url, "_blank");
        return;
    }

    const link = document.createElement("a");
    link.href = route("lead-contact-files.download", file.id);
    link.download = file.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
