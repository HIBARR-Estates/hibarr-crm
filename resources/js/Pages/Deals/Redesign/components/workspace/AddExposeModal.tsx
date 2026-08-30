import { useEffect, useMemo, useState } from "react";
import { usePage } from "@inertiajs/react";
import type { PageProps } from "@/Components/DashboardLayout";
import useTranslation from "@/Hooks/useTranslation";
import CurrencyInput from "@/Components/CurrencyInput";
import { Modal, ModalField } from "@/Components/Redesign/primitives/Modal";
import SearchableSelect from "@/Components/Redesign/primitives/SearchableSelect";
import FileDropzone from "@/Components/Redesign/primitives/FileDropzone";
import DealButton from "../primitives/DealButton";
import type { AddExposeInput } from "../../hooks/useDealExposes";
import { useDealExposeSnapshots } from "../../hooks/useDealExposes";
import { titleFromFilename, parseExposeAmount, parseOptionalSelectId } from "../../adapters/dealExposeAdapter";
import { DEAL_REDESIGN_TOKENS as T } from "../../tokens";

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
    onSubmit: (input: AddExposeInput) => Promise<string | null>;
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
    const { props } = usePage<PageProps>();
    const defaultCurrencyCode = props.default_currency_code || "TRY";
    const [title, setTitle] = useState("");
    const [amount, setAmount] = useState<{
        amount: string | number | null;
        currency: string;
    }>({ amount: null, currency: defaultCurrencyCode });
    const [snapshotId, setSnapshotId] = useState<number | undefined>(undefined);
    const [file, setFile] = useState<File | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const isBusy = saving || submitting;
    const isLinked = source === "linked";
    const manualUploadActive =
        !isLinked && file != null && (isUploadingFile || saving);
    const {
        snapshots,
        loading: snapshotsLoading,
        loadFailed: snapshotsLoadFailed,
        reload: reloadSnapshots,
    } = useDealExposeSnapshots(dealId, open && isLinked);

    useEffect(() => {
        if (!open) {
            setTitle("");
            setAmount({ amount: null, currency: defaultCurrencyCode });
            setSnapshotId(undefined);
            setFile(null);
            setError(null);
            setSubmitting(false);
        }
    }, [open, defaultCurrencyCode]);

    const options = useMemo(
        () =>
            snapshots.map((snapshot) => ({
                value: snapshot.id,
                label: snapshot.entity_label
                    ? `${snapshot.title} (${snapshot.entity_label})`
                    : snapshot.title,
            })),
        [snapshots],
    );

    const selected = snapshots.find((snapshot) => snapshot.id === snapshotId);

    const handleSubmit = async () => {
        if (isBusy) return;

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

            const parsedAmount = parseExposeAmount(amount);
            if (parsedAmount !== null && parsedAmount < 0) {
                setError(
                    t("pages.deals.workspace.exposes.validation.amount_invalid"),
                );
                return;
            }

            setError(null);
            setSubmitting(true);
            try {
                const failure = await onSubmit({
                    source,
                    title: trimmedTitle,
                    sourceLabel: t("pages.deals.workspace.exposes.source_linked"),
                    amount: parsedAmount,
                    exposeSnapshotId: snapshotId,
                    file: null,
                });
                if (failure) {
                    setError(failure);
                    return;
                }
                onClose();
            } finally {
                setSubmitting(false);
            }
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
        setSubmitting(true);
        try {
            const failure = await onSubmit({
                source,
                title: derivedTitle,
                sourceLabel: t("pages.deals.workspace.exposes.source_manual"),
                amount: null,
                exposeSnapshotId: null,
                file,
            });
            if (failure) {
                setError(failure);
                return;
            }
            onClose();
        } finally {
            setSubmitting(false);
        }
    };

    const dirty = isLinked
        ? title.trim() !== "" ||
          parseExposeAmount(amount) !== null ||
          snapshotId != null
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
                if (manualUploadActive) {
                    onCancelUpload?.();
                    return;
                }
                if (!isBusy) onClose();
            }}
            closeAriaLabel={t("app.close")}
            footer={
                <>
                    <DealButton
                        onClick={() => {
                            if (manualUploadActive) {
                                onCancelUpload?.();
                                return;
                            }
                            onClose();
                        }}
                        disabled={isBusy && !manualUploadActive}
                    >
                        {manualUploadActive
                            ? t("pages.deals.workspace.files.cancel_upload")
                            : t("app.cancel")}
                    </DealButton>
                    <DealButton
                        variant="primary"
                        loading={isBusy}
                        disabled={isBusy}
                        onClick={() => {
                            void handleSubmit();
                        }}
                    >
                        {manualUploadActive && isUploadingFile
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
                            disabled={isBusy}
                            placeholder={t(
                                "pages.deals.workspace.exposes.field_expose_placeholder",
                            )}
                            notFoundContent={
                                snapshotsLoading
                                    ? null
                                    : t("pages.deals.workspace.exposes.no_exposes")
                            }
                            onChange={(value) => {
                                const nextId = parseOptionalSelectId(value);
                                setSnapshotId(nextId);
                                const snap = snapshots.find(
                                    (row) => row.id === nextId,
                                );
                                if (!snap) {
                                    return;
                                }
                                setTitle(snap.title);
                                if (
                                    snap.suggested_amount != null &&
                                    parseExposeAmount(amount) === null
                                ) {
                                    setAmount({
                                        amount: snap.suggested_amount,
                                        currency: defaultCurrencyCode,
                                    });
                                }
                            }}
                        />
                    </ModalField>
                    {snapshotsLoadFailed && (
                        <div
                            role="alert"
                            className="text-xs flex items-center gap-2"
                            style={{ color: T.RED }}
                        >
                            <span>
                                {t("pages.deals.workspace.exposes.load_failed")}
                            </span>
                            <button
                                type="button"
                                onClick={reloadSnapshots}
                                style={{
                                    color: T.RED,
                                    textDecoration: "underline",
                                    background: "none",
                                    border: "none",
                                    cursor: "pointer",
                                    padding: 0,
                                    font: "inherit",
                                }}
                            >
                                {t("pages.deals.workspace.exposes.retry")}
                            </button>
                        </div>
                    )}

                    <ModalField
                        label={t("pages.deals.workspace.exposes.field_title")}
                    >
                        <input
                            className="dr-input"
                            value={title}
                            placeholder={selected?.title ?? ""}
                            disabled={isBusy}
                            onChange={(event) => setTitle(event.target.value)}
                        />
                    </ModalField>

                    <ModalField
                        label={t("pages.deals.workspace.exposes.field_amount")}
                    >
                        <CurrencyInput
                            value={amount}
                            // deal_exposes has no currency column — only the
                            // number is persisted, and ExposesPanel always
                            // formats it with the deal's own currency symbol.
                            // Pin the currency here so CurrencyInput's picker
                            // can't silently record an amount as one currency
                            // while it displays as another.
                            onChange={(next) =>
                                setAmount({
                                    ...next,
                                    currency: defaultCurrencyCode,
                                })
                            }
                            noFormItem
                            disabled={isBusy}
                        />
                    </ModalField>
                </>
            ) : (
                <ModalField
                    label={t("pages.deals.workspace.exposes.field_document")}
                >
                    <FileDropzone
                        multiple={false}
                        disabled={isBusy}
                        isUploading={manualUploadActive}
                        uploadProgress={uploadProgress}
                        uploadBytesLoaded={uploadBytesLoaded}
                        uploadBytesTotal={uploadBytesTotal}
                        dropHint={t("pages.deals.workspace.files.drop_hint")}
                        uploadingLabel={t("pages.deals.workspace.files.uploading")}
                        sizeHint={t("pages.deals.workspace.exposes.size_hint")}
                        onFilesSelected={(files) => {
                            if (isBusy) return;
                            const next = files ? Array.from(files)[0] : null;
                            setFile(next ?? null);
                        }}
                    />
                    {file && !manualUploadActive && (
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
