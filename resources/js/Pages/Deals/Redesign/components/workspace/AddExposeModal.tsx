import { useEffect, useState, type ReactNode } from "react";
import useTranslation from "@/Hooks/useTranslation";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { useDebounce } from "@/Hooks/useDebounce";
import { Modal, ModalField } from "@/Components/Redesign/primitives/Modal";
import FileDropzone from "@/Components/Redesign/primitives/FileDropzone";
import DealButton from "../primitives/DealButton";
import DealIcon from "../primitives/DealIcon";
import type {
    AddExposeInput,
    DealExposeEntityQuery,
} from "../../hooks/useDealExposes";
import { useDealExposeEntities } from "../../hooks/useDealExposes";
import {
    titleFromFilename,
    formatExposeAmount,
    exposeEntityKey,
} from "../../adapters/dealExposeAdapter";
import type { DealExposeLinkableEntity } from "@/Types/api/dealExposes";
import { DEAL_REDESIGN_TOKENS as T } from "../../tokens";

interface AddExposeModalProps {
    open: boolean;
    /** Which of the two add paths from the design this dialog is serving. */
    source: "linked" | "manual";
    dealId: number;
    /** For the price tag on linked-entity cards. */
    currencySymbol: string;
    saving: boolean;
    isUploadingFile?: boolean;
    uploadProgress?: number;
    uploadBytesLoaded?: number;
    uploadBytesTotal?: number;
    onCancelUpload?: () => void;
    onSubmit: (input: AddExposeInput) => Promise<string | null>;
    onClose: () => void;
}

type LinkedTab = "properties" | "projects";

export default function AddExposeModal({
    open,
    source,
    dealId,
    currencySymbol,
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
    const { td } = useTd();
    const isLinked = source === "linked";

    // ── Linked flow: browse -> (optionally drill into a project) -> pick ──
    const [tab, setTab] = useState<LinkedTab>("properties");
    const [activeProject, setActiveProject] =
        useState<DealExposeLinkableEntity | null>(null);
    const [filterText, setFilterText] = useState("");
    const [linkingKey, setLinkingKey] = useState<string | null>(null);

    // ── Manual flow ──
    const [file, setFile] = useState<File | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const [error, setError] = useState<string | null>(null);

    const manualUploadActive =
        !isLinked && file != null && (isUploadingFile || saving);
    const linkingBusy = linkingKey !== null || saving;

    const debouncedFilterText = useDebounce(filterText, 350);
    const isProjectBrowseView = !activeProject && tab === "projects";
    const entityQuery: DealExposeEntityQuery = activeProject
        ? {
              scope: "unit_type",
              projectId: activeProject.entity_id,
              search: debouncedFilterText,
          }
        : {
              scope: tab === "properties" ? "property" : "developer_project",
              search: debouncedFilterText,
          };

    const {
        entities,
        loading: entitiesLoading,
        loadingMore: entitiesLoadingMore,
        loadFailed: entitiesLoadFailed,
        hasMore: entitiesHasMore,
        loadMore: loadMoreEntities,
        reload: reloadEntities,
    } = useDealExposeEntities(dealId, entityQuery, open && isLinked);

    useEffect(() => {
        if (!open) {
            setTab("properties");
            setActiveProject(null);
            setFilterText("");
            setLinkingKey(null);
            setFile(null);
            setError(null);
            setSubmitting(false);
        }
    }, [open]);

    const emptyMessage = activeProject
        ? td("No unit types found", { source: "en" })
        : tab === "properties"
          ? td("No properties found", { source: "en" })
          : td("No projects found", { source: "en" });

    const pickEntity = async (entity: DealExposeLinkableEntity) => {
        if (linkingBusy) return;

        setLinkingKey(exposeEntityKey(entity));
        setError(null);
        try {
            const failure = await onSubmit({
                source: "linked",
                title: entity.title,
                sourceLabel: t("pages.deals.workspace.exposes.source_linked"),
                amount: null,
                entityType: entity.entity_type,
                entityId: entity.entity_id,
                unitTypeId: entity.unit_type_id,
                file: null,
            });
            if (failure) {
                setError(failure);
                return;
            }
            onClose();
        } finally {
            setLinkingKey(null);
        }
    };

    const handleManualSubmit = async () => {
        if (saving || submitting) return;

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
                source: "manual",
                title: derivedTitle,
                sourceLabel: t("pages.deals.workspace.exposes.source_manual"),
                amount: null,
                entityType: null,
                entityId: null,
                unitTypeId: null,
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

    const isManualBusy = saving || submitting;

    return (
        <Modal
            open={open}
            dirty={isLinked ? linkingKey !== null : manualUploadActive}
            title={
                isLinked
                    ? t("pages.deals.workspace.exposes.add_linked")
                    : t("pages.deals.workspace.exposes.add_manual")
            }
            subtitle={
                isLinked
                    ? td(
                          "Pick a property, or a project and unit, to generate a personalized exposé link for this deal's lead",
                          { source: "en" },
                      )
                    : t("pages.deals.workspace.exposes.add_manual_hint")
            }
            maxWidth={isLinked ? 760 : undefined}
            onClose={() => {
                if (manualUploadActive) {
                    onCancelUpload?.();
                    return;
                }
                if (linkingKey !== null) return;
                onClose();
            }}
            closeAriaLabel={t("app.close")}
            footer={
                isLinked ? (
                    <DealButton onClick={onClose} disabled={linkingKey !== null}>
                        {t("app.cancel")}
                    </DealButton>
                ) : (
                    <>
                        <DealButton
                            onClick={() => {
                                if (manualUploadActive) {
                                    onCancelUpload?.();
                                    return;
                                }
                                onClose();
                            }}
                            disabled={isManualBusy && !manualUploadActive}
                        >
                            {manualUploadActive
                                ? t("pages.deals.workspace.files.cancel_upload")
                                : t("app.cancel")}
                        </DealButton>
                        <DealButton
                            variant="primary"
                            loading={isManualBusy}
                            disabled={isManualBusy}
                            onClick={() => {
                                void handleManualSubmit();
                            }}
                        >
                            {manualUploadActive && isUploadingFile
                                ? t("pages.deals.workspace.files.uploading")
                                : t("pages.deals.workspace.exposes.add")}
                        </DealButton>
                    </>
                )
            }
        >
            {isLinked ? (
                <div className="flex flex-col gap-3">
                    {entitiesLoadFailed ? (
                        <div
                            role="alert"
                            className="flex items-center gap-2 text-xs"
                            style={{ color: T.RED }}
                        >
                            <span>
                                {t("pages.deals.workspace.exposes.load_failed")}
                            </span>
                            <DealButton
                                variant="ghost"
                                size="sm"
                                onClick={reloadEntities}
                            >
                                {t("pages.deals.workspace.exposes.retry")}
                            </DealButton>
                        </div>
                    ) : (
                        <>
                            {activeProject ? (
                                <button
                                    type="button"
                                    className="flex w-fit cursor-pointer items-center gap-1 border-none bg-transparent p-0 text-[13px] font-semibold"
                                    style={{ color: T.BLUE }}
                                    disabled={linkingBusy}
                                    onClick={() => {
                                        setActiveProject(null);
                                        setFilterText("");
                                    }}
                                >
                                    <DealIcon name="chevron-left" size={15} />
                                    {activeProject.title}
                                </button>
                            ) : (
                                <div className="flex gap-1.5">
                                    <TabButton
                                        active={tab === "properties"}
                                        disabled={linkingBusy}
                                        onClick={() => {
                                            setTab("properties");
                                            setFilterText("");
                                        }}
                                    >
                                        {td("Properties", { source: "en" })}
                                    </TabButton>
                                    <TabButton
                                        active={tab === "projects"}
                                        disabled={linkingBusy}
                                        onClick={() => {
                                            setTab("projects");
                                            setFilterText("");
                                        }}
                                    >
                                        {td("Projects", { source: "en" })}
                                    </TabButton>
                                </div>
                            )}

                            <input
                                className="dr-input"
                                value={filterText}
                                placeholder={td("Filter by name...", {
                                    source: "en",
                                })}
                                onChange={(event) =>
                                    setFilterText(event.target.value)
                                }
                            />

                            {entitiesLoading ? (
                                <EntityGridSkeleton />
                            ) : (
                                <>
                                    <div
                                        className="grid grid-cols-2 gap-3 overflow-y-auto pr-1"
                                        style={{ maxHeight: 520, overflowY: "auto" }}
                                    >
                                        {activeProject && (
                                            <EntityCard
                                                title={td(
                                                    "Link this project (no specific unit)",
                                                    { source: "en" },
                                                )}
                                                coverImage={
                                                    activeProject.cover_image
                                                }
                                                priceLabel={formatOptionalAmount(
                                                    activeProject.suggested_amount,
                                                    currencySymbol,
                                                )}
                                                loading={
                                                    linkingKey ===
                                                    exposeEntityKey(
                                                        activeProject,
                                                    )
                                                }
                                                disabled={linkingBusy}
                                                onClick={() =>
                                                    pickEntity(activeProject)
                                                }
                                            />
                                        )}

                                        {entities.length === 0 ? (
                                            <EmptyState message={emptyMessage} />
                                        ) : (
                                            entities.map((entity) => (
                                                <EntityCard
                                                    key={exposeEntityKey(entity)}
                                                    title={entity.title}
                                                    coverImage={entity.cover_image}
                                                    priceLabel={formatOptionalAmount(
                                                        entity.suggested_amount,
                                                        currencySymbol,
                                                    )}
                                                    loading={
                                                        linkingKey ===
                                                        exposeEntityKey(entity)
                                                    }
                                                    disabled={linkingBusy}
                                                    onClick={() =>
                                                        isProjectBrowseView
                                                            ? setActiveProject(
                                                                  entity,
                                                              )
                                                            : pickEntity(entity)
                                                    }
                                                />
                                            ))
                                        )}
                                    </div>

                                    {entitiesHasMore && (
                                        <div className="flex justify-center">
                                            <DealButton
                                                variant="ghost"
                                                size="sm"
                                                loading={entitiesLoadingMore}
                                                disabled={
                                                    entitiesLoadingMore ||
                                                    linkingBusy
                                                }
                                                onClick={loadMoreEntities}
                                            >
                                                {td("Load more", {
                                                    source: "en",
                                                })}
                                            </DealButton>
                                        </div>
                                    )}
                                </>
                            )}
                        </>
                    )}
                </div>
            ) : (
                <ModalField
                    label={t("pages.deals.workspace.exposes.field_document")}
                >
                    <FileDropzone
                        multiple={false}
                        disabled={isManualBusy}
                        isUploading={manualUploadActive}
                        uploadProgress={uploadProgress}
                        uploadBytesLoaded={uploadBytesLoaded}
                        uploadBytesTotal={uploadBytesTotal}
                        dropHint={t("pages.deals.workspace.files.drop_hint")}
                        uploadingLabel={t("pages.deals.workspace.files.uploading")}
                        sizeHint={t("pages.deals.workspace.exposes.size_hint")}
                        onFilesSelected={(files) => {
                            if (isManualBusy) return;
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
                <div
                    role="alert"
                    className="mt-3 text-xs"
                    style={{ color: T.RED }}
                >
                    {error}
                </div>
            )}
        </Modal>
    );
}

function formatOptionalAmount(
    amount: number | null | undefined,
    currencySymbol: string,
): string | null {
    if (amount == null) return null;
    return formatExposeAmount(amount, currencySymbol);
}

interface TabButtonProps {
    active: boolean;
    disabled?: boolean;
    onClick: () => void;
    children: ReactNode;
}

function TabButton({ active, disabled, onClick, children }: TabButtonProps) {
    return (
        <button
            type="button"
            className="dr-btn dr-btn-sm cursor-pointer"
            disabled={disabled}
            onClick={onClick}
            style={{
                background: active ? T.NAVY : T.WHITE,
                color: active ? T.WHITE : T.TEXT_MUTED,
                border: `1px solid ${active ? T.NAVY : T.BORDER}`,
            }}
        >
            {children}
        </button>
    );
}

interface EntityCardProps {
    title: string;
    coverImage: string | null;
    priceLabel?: string | null;
    loading?: boolean;
    disabled?: boolean;
    onClick: () => void;
}

function EntityCard({
    title,
    coverImage,
    priceLabel,
    loading = false,
    disabled = false,
    onClick,
}: EntityCardProps) {
    return (
        <button
            type="button"
            className="dr-card dr-card-btn overflow-hidden"
            style={{
                opacity: disabled && !loading ? 0.5 : 1,
                margin: 0,
                padding: 0,
                width: "100%",
                minHeight: 210,
                display: "flex",
                flexDirection: "column",
            }}
            disabled={disabled}
            onClick={onClick}
        >
            <div
                className="relative flex w-full shrink-0 items-center justify-center overflow-hidden"
                style={{ background: T.SURFACE_2, height: 150, minHeight: 150 }}
            >
                {coverImage ? (
                    <img
                        src={coverImage}
                        alt=""
                        className="h-full w-full object-cover"
                    />
                ) : (
                    <DealIcon name="building" size={32} color={T.TEXT_HINT} />
                )}
                {loading && (
                    <div
                        className="absolute inset-0 flex items-center justify-center"
                        style={{ background: "rgba(255,255,255,0.75)" }}
                    >
                        <span
                            className="animate-spin rounded-full border-2 border-solid border-current"
                            style={{
                                width: 22,
                                height: 22,
                                borderTopColor: "transparent",
                                color: T.BLUE,
                            }}
                        />
                    </div>
                )}
            </div>
            <div style={{ padding: "12px 14px", minHeight: 60 }}>
                <div
                    className="truncate text-[15px] font-semibold"
                    style={{ color: T.TEXT }}
                    title={title}
                >
                    {title}
                </div>
                {priceLabel && (
                    <div
                        className="mt-1 truncate text-[13px]"
                        style={{ color: T.TEXT_MUTED }}
                    >
                        {priceLabel}
                    </div>
                )}
            </div>
        </button>
    );
}

function EntityGridSkeleton() {
    return (
        <div role="status" className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((row) => (
                <div
                    key={row}
                    className="overflow-hidden rounded-[10px] border"
                    style={{ borderColor: T.BORDER, minHeight: 210 }}
                >
                    <span
                        className="dr-skeleton block w-full"
                        style={{ height: 150 }}
                    />
                    <div style={{ padding: "12px 14px" }}>
                        <span className="dr-skeleton block h-4 w-3/4" />
                    </div>
                </div>
            ))}
        </div>
    );
}

function EmptyState({ message }: { message: string }) {
    return (
        <div
            className="col-span-2 rounded-[10px] border border-dashed px-3.5 py-6 text-center text-xs"
            style={{ borderColor: T.BORDER, background: T.SURFACE_2, color: T.TEXT_MUTED }}
        >
            {message}
        </div>
    );
}
