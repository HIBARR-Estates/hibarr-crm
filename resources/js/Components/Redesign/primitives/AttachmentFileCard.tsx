import Icon from "./Icon";
import Button from "./Button";
import { REDESIGN_TOKENS as T } from "../tokens";

interface AttachmentFileCardProps {
    name: string;
    sizeLabel: string;
    /** Relative time already formatted, e.g. "2 hours ago". */
    uploadedLabel: string;
    /** Prefix before the relative time, e.g. "Uploaded". */
    uploadedPrefix: string;
    iconName: string;
    downloadLabel: string;
    deleteLabel: string;
    onDownload: () => void;
    onDelete?: () => void;
}

/** Shared loose-attachment row used on lead + deal Files tabs. */
export default function AttachmentFileCard({
    name,
    sizeLabel,
    uploadedLabel,
    uploadedPrefix,
    iconName,
    downloadLabel,
    deleteLabel,
    onDownload,
    onDelete,
}: AttachmentFileCardProps) {
    return (
        <article className="mb-2 flex items-center gap-3 rounded-lg border border-[#e2e5ea] bg-white px-3.5 py-2.5 last:mb-0">
            <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md"
                style={{ background: T.GRAY }}
            >
                <Icon name={iconName} size={17} color={T.GRAY_DARKER} />
            </div>

            <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium text-[#1a1f2e]">
                    {name}
                </div>
                <div className="text-[12px] text-[#9ca3af]">
                    {sizeLabel} · {uploadedPrefix} {uploadedLabel}
                </div>
            </div>

            <div className="flex shrink-0 gap-1.5">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onDownload}
                    aria-label={downloadLabel}
                >
                    <Icon name="external-link" size={13} />
                </Button>
                {onDelete ? (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onDelete}
                        aria-label={deleteLabel}
                    >
                        <Icon name="trash" size={13} color="#dc2626" />
                    </Button>
                ) : null}
            </div>
        </article>
    );
}
