import { useEffect, useRef, useState } from "react";
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
    /**
     * Renames the file's display label within the CRM (the stored file
     * itself is untouched) — omit to hide the rename action entirely.
     */
    onRename?: (label: string) => void | Promise<void>;
    renameLabel?: string;
    renameSaveLabel?: string;
    renameCancelLabel?: string;
    renamePlaceholder?: string;
    renaming?: boolean;
    /**
     * Swaps the stored file's content in place (same row, new upload) —
     * omit to hide the replace action entirely.
     */
    onReplace?: (file: File) => void | Promise<void>;
    replaceLabel?: string;
    replacing?: boolean;
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
    onRename,
    renameLabel = "Rename",
    renameSaveLabel = "Save",
    renameCancelLabel = "Cancel",
    renamePlaceholder,
    renaming = false,
    onReplace,
    replaceLabel = "Replace",
    replacing = false,
}: AttachmentFileCardProps) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(name);
    const replaceInputRef = useRef<HTMLInputElement>(null);

    // The name prop can change under an in-progress edit (e.g. a sibling
    // list refresh) — only resync while not actively editing, so a save
    // doesn't get its own optimistic input value stomped mid-flight.
    useEffect(() => {
        if (!editing) setDraft(name);
    }, [name, editing]);

    const startEditing = () => {
        setDraft(name);
        setEditing(true);
    };

    const save = () => {
        const trimmed = draft.trim();
        if (trimmed && trimmed !== name) {
            onRename?.(trimmed);
        }
        setEditing(false);
    };

    if (editing) {
        return (
            <article className="mb-2 flex items-center gap-3 rounded-lg border border-[#e2e5ea] bg-white px-3.5 py-2.5 last:mb-0">
                <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md"
                    style={{ background: T.GRAY }}
                >
                    <Icon name={iconName} size={17} color={T.GRAY_DARKER} />
                </div>

                <input
                    className="dr-input min-w-0 flex-1"
                    style={{ padding: "6px 10px", fontSize: 13 }}
                    value={draft}
                    placeholder={renamePlaceholder}
                    autoFocus
                    disabled={renaming}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") save();
                        if (e.key === "Escape") setEditing(false);
                    }}
                />

                <div className="flex shrink-0 gap-1.5">
                    <Button variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={renaming}>
                        {renameCancelLabel}
                    </Button>
                    <Button variant="primary" size="sm" onClick={save} loading={renaming} disabled={!draft.trim()}>
                        {renameSaveLabel}
                    </Button>
                </div>
            </article>
        );
    }

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
                <div className="truncate text-[12px] text-[#9ca3af]">
                    {sizeLabel} · {uploadedPrefix} {uploadedLabel}
                </div>
            </div>

            <div className="flex shrink-0 gap-1.5">
                {onRename ? (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={startEditing}
                        title={renameLabel}
                        aria-label={renameLabel}
                    >
                        <Icon name="edit" size={13} />
                        <span>{renameLabel}</span>
                    </Button>
                ) : null}
                {onReplace ? (
                    <>
                        <input
                            ref={replaceInputRef}
                            type="file"
                            className="hidden"
                            onChange={(event) => {
                                const file = event.target.files?.[0];
                                if (file) onReplace(file);
                                event.target.value = "";
                            }}
                        />
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => replaceInputRef.current?.click()}
                            loading={replacing}
                            title={replaceLabel}
                            aria-label={replaceLabel}
                        >
                            <Icon name="refresh" size={13} />
                            <span>{replaceLabel}</span>
                        </Button>
                    </>
                ) : null}
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onDownload}
                    title={downloadLabel}
                    aria-label={downloadLabel}
                >
                    <Icon name="external-link" size={13} />
                </Button>
                {onDelete ? (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onDelete}
                        title={deleteLabel}
                        aria-label={deleteLabel}
                    >
                        <Icon name="trash" size={13} color="#dc2626" />
                    </Button>
                ) : null}
            </div>
        </article>
    );
}
