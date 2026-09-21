interface FileCardProps {
    name: string;
    sizeLabel?: string;
    uploadedAt?: string;
    onClick?: () => void;
}

export default function FileCard({
    name,
    sizeLabel,
    uploadedAt,
    onClick,
}: FileCardProps) {
    return (
        <button
            type="button"
            className="v2-file-card mb-2 flex w-full cursor-pointer items-center justify-between gap-3 text-left"
            onClick={onClick}
        >
            <div className="min-w-0">
                <div className="truncate text-[13px] font-medium text-dr-text">
                    {name}
                </div>
                {uploadedAt && (
                    <div className="text-[11px] text-dr-text-hint">{uploadedAt}</div>
                )}
            </div>
            {sizeLabel && (
                <span className="shrink-0 text-[11px] text-dr-text-muted">
                    {sizeLabel}
                </span>
            )}
        </button>
    );
}
