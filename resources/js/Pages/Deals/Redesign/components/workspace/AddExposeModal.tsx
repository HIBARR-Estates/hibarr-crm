import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import useTranslation from "@/Hooks/useTranslation";
import { Modal, ModalField } from "@/Components/Redesign/primitives/Modal";
import SearchableSelect from "@/Components/Redesign/primitives/SearchableSelect";
import FileDropzone from "@/Components/Redesign/primitives/FileDropzone";
import DealButton from "../primitives/DealButton";
import type { AddExposeInput } from "../../hooks/useDealExposes";
import { titleFromFilename } from "../../adapters/dealExposeAdapter";
import { DEAL_REDESIGN_TOKENS as T } from "../../tokens";

interface AvailableSnapshot {
    id: number;
    entity_type: string;
    title: string;
    created_at: string | null;
}

interface AddExposeModalProps {
    open: boolean;
    /** Which of the two add paths from the design this dialog is serving. */
    source: "linked" | "manual";
    dealId: number;
    saving: boolean;
    isUploadingFile?: boolean;
    uploadProgress?: number;
    uploadBytesLoaded?: number;
    uploadBytesTotal?: number;
    onCancelUpload?: () => void;
    onSubmit: (input: AddExposeInput) => void;
    onClose: () => void;
}

export default function AddExposeModal({
    open,
    source,
    dealId,
    saving,
    isUploadingFile = false,
    uploadProgress = 0,
    uploadBytesLoaded = 0,
    uploadBytesTotal = 0,
    onCancelUpload,
    onSubmit,
    onClose,
}: AddExposeModalProps) {
    const { t } = useTranslation();
    const [title, setTitle] = useState("");
    const [amount, setAmount] = useState("");
    const [snapshotId, setSnapshotId] = useState<number | undefined>(undefined);
    const [file, setFile] = useState<File | null>(null);
    const [snapshots, setSnapshots] = useState<AvailableSnapshot[]>([]);
    const [snapshotsLoading, setSnapshotsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isLinked = source === "linked";

    useEffect(() => {
        if (!open) {
            setTitle("");
            setAmount("");
            setSnapshotId(undefined);
            setFile(null);
            setError(null);
        }
    }, [open]);

    // Only the linked path needs the picker, so the list is fetched when that
    // dialog opens rather than alongside the tab itself.
    useEffect(() => {
        if (!open || !isLinked) return;

        let cancelled = false;
        setSnapshotsLoading(true);
        axios
            .get<{ snapshots: AvailableSnapshot[] }>(
                route("deals.exposes.available", dealId),
                { headers: { Accept: "application/json" } },
            )
            .then(({ data }) => {
                if (!cancelled) setSnapshots(data.snapshots ?? []);
            })
            .catch(() => {
                if (!cancelled) setSnapshots([]);
            })
            .finally(() => {
                if (!cancelled) setSnapshotsLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [open, isLinked, dealId]);

    const options = useMemo(
        () =>
            snapshots.map((snapshot) => ({
                value: snapshot.id,
                label: snapshot.title,
            })),
        [snapshots],
    );

    const selected = snapshots.find((snapshot) => snapshot.id === snapshotId);

    const handleSubmit = () => {
        if (saving) return;

        if (isLinked) {
            const trimmedTitle = title.trim() || selected?.title || "";

            if (snapshotId == null) {
                setError(
                    t("pages.deals.workspace.exposes.validation.expose_required"),
                );
                return;
            }
            if (!trimmedTitle) {
                setError(
                    t("pages.deals.workspace.exposes.validation.title_required"),
                );
                return;
            }

            const parsedAmount = amount.trim() === "" ? null : Number(amount);
            if (parsedAmount !== null && Number.isNaN(parsedAmount)) {
                setError(
                    t("pages.deals.workspace.exposes.validation.amount_invalid"),
                );
                return;
            }

            setError(null);
            onSubmit({
                source,
                title: trimmedTitle,
                sourceLabel: t("pages.deals.workspace.exposes.source_linked"),
                amount: parsedAmount,
                exposeSnapshotId: snapshotId,
                file: null,
            });
            return;
        }

        if (file == null) {
            setError(t("pages.deals.workspace.exposes.validation.file_required"));
            return;
        }

        const derivedTitle = titleFromFilename(file.name);
        if (!derivedTitle) {
            setError(t("pages.deals.workspace.exposes.validation.title_required"));
            return;
        }

        setError(null);
        onSubmit({
            source,
            title: derivedTitle,
            sourceLabel: t("pages.deals.workspace.exposes.source_manual"),
            amount: null,
            exposeSnapshotId: null,
            file,
        });
    };

    const dirty = isLinked
        ? title.trim() !== "" || amount.trim() !== "" || snapshotId != null
        : file !== null;

    return (
        <Modal
            open={open}
            dirty={dirty}
            title={
                isLinked
                    ? t("pages.deals.workspace.exposes.add_linked")
                    : t("pages.deals.workspace.exposes.add_manual")
            }
            subtitle={
                isLinked
                    ? t("pages.deals.workspace.exposes.add_linked_hint")
                    : t("pages.deals.workspace.exposes.add_manual_hint")
            }
            onClose={() => {
                if (isUploadingFile) {
                    onCancelUpload?.();
                    return;
                }
                if (!saving) onClose();
            }}
            closeAriaLabel={t("app.close")}
            footer={
                <>
                    <DealButton
                        onClick={() => {
                            if (isUploadingFile) {
                                onCancelUpload?.();
                                return;
                            }
                            onClose();
                        }}
                        disabled={saving && !isUploadingFile}
                    >
                        {isUploadingFile
                            ? t("pages.deals.workspace.files.cancel_upload")
                            : t("app.cancel")}
                    </DealButton>
                    <DealButton
                        variant="primary"
                        loading={saving}
                        disabled={saving}
                        onClick={handleSubmit}
                    >
                        {isUploadingFile
                            ? t("pages.deals.workspace.files.uploading")
                            : t("pages.deals.workspace.exposes.add")}
                    </DealButton>
                </>
            }
        >
            {isLinked ? (
                <>
                    <ModalField
                        label={t("pages.deals.workspace.exposes.field_expose")}
                    >
                        <SearchableSelect<number>
                            value={snapshotId}
                            options={options}
                            loading={snapshotsLoading}
                            style={{ width: "100%" }}
                            disabled={saving}
                            placeholder={t(
                                "pages.deals.workspace.exposes.field_expose_placeholder",
                            )}
                            notFoundContent={
                                snapshotsLoading
                                    ? null
                                    : t("pages.deals.workspace.exposes.no_exposes")
                            }
                            onChange={(value) => setSnapshotId(value)}
                        />
                    </ModalField>

                    <ModalField
                        label={t("pages.deals.workspace.exposes.field_title")}
                    >
                        <input
                            className="dr-input"
                            value={title}
                            placeholder={selected?.title ?? ""}
                            disabled={saving}
                            onChange={(event) => setTitle(event.target.value)}
                        />
                    </ModalField>

                    <ModalField
                        label={t("pages.deals.workspace.exposes.field_amount")}
                    >
                        <input
                            className="dr-input"
                            inputMode="decimal"
                            value={amount}
                            disabled={saving}
                            onChange={(event) => setAmount(event.target.value)}
                        />
                    </ModalField>
                </>
            ) : (
                <ModalField
                    label={t("pages.deals.workspace.exposes.field_document")}
                >
                    <FileDropzone
                        multiple={false}
                        disabled={saving}
                        isUploading={isUploadingFile}
                        uploadProgress={uploadProgress}
                        uploadBytesLoaded={uploadBytesLoaded}
                        uploadBytesTotal={uploadBytesTotal}
                        dropHint={t("pages.deals.workspace.files.drop_hint")}
                        uploadingLabel={t("pages.deals.workspace.files.uploading")}
                        sizeHint={t("pages.deals.workspace.exposes.size_hint")}
                        onFilesSelected={(files) => {
                            if (saving) return;
                            const next = files ? Array.from(files)[0] : null;
                            setFile(next ?? null);
                        }}
                    />
                    {file && !isUploadingFile && (
                        <div
                            className="mt-2 text-xs"
                            style={{ color: T.TEXT_MUTED }}
                        >
                            {titleFromFilename(file.name)}
                        </div>
                    )}
                </ModalField>
            )}

            {error && (
                <div role="alert" className="text-xs" style={{ color: T.RED }}>
                    {error}
                </div>
            )}
        </Modal>
    );
}
