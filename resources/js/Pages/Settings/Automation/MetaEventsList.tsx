import { useState } from "react";
import { PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import Button from "@/Components/Redesign/primitives/Button";
import EmptyState from "@/Components/Redesign/primitives/EmptyState";
import ConfirmDialog from "@/Components/Redesign/primitives/ConfirmDialog";
import { Modal, ModalField } from "@/Components/Redesign/primitives/Modal";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import useTranslation from "@/Hooks/useTranslation";
import { MetaEvent } from "./types";
import { useAutomationWorkspace } from "./context/AutomationWorkspaceContext";
import useMetaEventMutations from "./hooks/useMetaEventMutations";

interface MetaEventsListProps {
    onOpenAutomation: (id: number) => void;
}

const ROW_GRID = "grid items-center gap-x-3 px-3.5 py-3 border-b last:border-b-0";

export default function MetaEventsList({ onOpenAutomation }: MetaEventsListProps) {
    const { t } = useTranslation();
    const { metaEvents, metaEventsLoading } = useAutomationWorkspace();
    const { createMetaEvent, updateMetaEvent, deleteMetaEvent, savingId } = useMetaEventMutations();

    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<MetaEvent | null>(null);
    const [name, setName] = useState("");
    const [value, setValue] = useState("");
    const [description, setDescription] = useState("");
    const [deleteTarget, setDeleteTarget] = useState<MetaEvent | null>(null);
    const [deletingId, setDeletingId] = useState<number | null>(null);

    const isSaving = savingId === (editing?.id ?? "new");

    function closeModal() {
        setModalOpen(false);
        setEditing(null);
        setName("");
        setValue("");
        setDescription("");
    }

    function openCreate() {
        setEditing(null);
        setName("");
        setValue("");
        setDescription("");
        setModalOpen(true);
    }

    function openEdit(event: MetaEvent) {
        setEditing(event);
        setName(event.name);
        setValue(event.value !== null ? String(event.value) : "");
        setDescription(event.description ?? "");
        setModalOpen(true);
    }

    async function handleSubmit() {
        const trimmed = name.trim();
        if (!trimmed) return;

        const payload = {
            name: trimmed,
            value: value.trim() ? Number(value) : null,
            description: description.trim() || null,
        };

        const saved = editing ? await updateMetaEvent(editing.id, payload) : await createMetaEvent(payload);
        if (saved) closeModal();
    }

    async function handleDelete() {
        if (!deleteTarget) return;
        setDeletingId(deleteTarget.id);
        const ok = await deleteMetaEvent(deleteTarget.id);
        setDeletingId(null);
        if (ok) setDeleteTarget(null);
    }

    return (
        <div>
            <div className="flex items-end justify-between gap-4 mb-4 flex-wrap">
                <div>
                    <h1 className="m-0 font-bold" style={{ fontSize: 19, color: T.NAVY }}>
                        {t("app.automation.metaEvents")}
                    </h1>
                    <p className="mt-1 mb-0" style={{ fontSize: 13, color: T.TEXT_MUTED }}>
                        {t("app.automation.metaEventsSubtitle")}
                    </p>
                </div>
                <Button variant="primary" icon={<PlusOutlined />} onClick={openCreate}>
                    {t("app.automation.newMetaEvent")}
                </Button>
            </div>

            {!metaEventsLoading && metaEvents.length === 0 && (
                <EmptyState
                    title={t("app.automation.noMetaEventsYet")}
                    description={t("app.automation.noMetaEventsYetDescription")}
                />
            )}

            {(metaEventsLoading || metaEvents.length > 0) && (
                <div className="flex flex-col overflow-hidden rounded-[10px] border bg-white" style={{ borderColor: T.BORDER }}>
                    <div
                        className={ROW_GRID}
                        style={{
                            gridTemplateColumns: "minmax(0,1.4fr) 110px minmax(0,1.6fr) 90px",
                            background: T.SURFACE_2,
                            borderColor: T.BORDER,
                            fontSize: 11,
                            fontWeight: 700,
                            letterSpacing: "0.05em",
                            textTransform: "uppercase",
                            color: T.TEXT_MUTED,
                        }}
                    >
                        <span>{t("app.automation.eventName")}</span>
                        <span>{t("app.automation.eventValue")}</span>
                        <span>{t("app.automation.usedByAutomations")}</span>
                        <span className="text-right">{t("app.action")}</span>
                    </div>

                    {metaEventsLoading ? (
                        <div className="px-3.5 py-6 text-center text-sm" style={{ color: T.TEXT_MUTED }}>
                            {t("app.loading")}
                        </div>
                    ) : (
                        metaEvents.map((event) => (
                            <div
                                key={event.id}
                                className={ROW_GRID}
                                style={{ gridTemplateColumns: "minmax(0,1.4fr) 110px minmax(0,1.6fr) 90px", borderColor: T.BORDER }}
                            >
                                <div className="min-w-0">
                                    <div className="truncate text-sm font-semibold" style={{ color: T.TEXT }} title={event.name}>
                                        {event.name}
                                    </div>
                                    {event.description && (
                                        <div className="truncate mt-0.5" style={{ fontSize: 12, color: T.TEXT_HINT }} title={event.description}>
                                            {event.description}
                                        </div>
                                    )}
                                </div>
                                <span className="tabular-nums text-sm" style={{ color: T.TEXT_MUTED }}>
                                    {event.value !== null ? event.value : "—"}
                                </span>
                                <div className="flex flex-wrap gap-1.5">
                                    {event.using_automations.length === 0 ? (
                                        <span style={{ fontSize: 12, color: T.TEXT_HINT }}>{t("app.automation.notUsedYet")}</span>
                                    ) : (
                                        event.using_automations.map((a) => (
                                            <button
                                                key={a.id}
                                                type="button"
                                                onClick={() => onOpenAutomation(a.id)}
                                                className="inline-flex items-center cursor-pointer whitespace-nowrap"
                                                style={{
                                                    padding: "3px 8px",
                                                    borderRadius: 6,
                                                    background: T.SURFACE_2,
                                                    border: `1px solid ${T.BORDER_SOFT}`,
                                                    fontSize: 12,
                                                    color: T.BLUE_DARK,
                                                    fontWeight: 500,
                                                }}
                                            >
                                                {a.name}
                                            </button>
                                        ))
                                    )}
                                </div>
                                <span className="flex items-center justify-end gap-1">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        icon={<EditOutlined />}
                                        aria-label={t("app.edit")}
                                        onClick={() => openEdit(event)}
                                    />
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        icon={<DeleteOutlined />}
                                        aria-label={t("app.delete")}
                                        loading={deletingId === event.id}
                                        onClick={() => setDeleteTarget(event)}
                                        style={{ color: T.RED }}
                                    />
                                </span>
                            </div>
                        ))
                    )}
                </div>
            )}

            <Modal
                open={modalOpen}
                title={editing ? t("app.automation.editMetaEvent") : t("app.automation.newMetaEvent")}
                onClose={closeModal}
                dirty={name.trim() !== "" || value.trim() !== "" || description.trim() !== ""}
                footer={
                    <>
                        <Button variant="ghost" onClick={closeModal} disabled={isSaving}>
                            {t("app.cancel")}
                        </Button>
                        <Button variant="primary" onClick={handleSubmit} loading={isSaving} disabled={!name.trim()}>
                            {t("app.save")}
                        </Button>
                    </>
                }
            >
                <ModalField label={t("app.automation.eventName")}>
                    <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder={t("app.automation.eventNamePlaceholder")}
                        className="dr-input w-full"
                        autoFocus
                    />
                </ModalField>
                <ModalField label={t("app.automation.eventValue")}>
                    <input
                        type="number"
                        step="0.01"
                        min={0}
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        className="dr-input w-full"
                    />
                </ModalField>
                <ModalField label={t("app.automation.description")}>
                    <input
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="dr-input w-full"
                    />
                </ModalField>
            </Modal>

            <ConfirmDialog
                open={deleteTarget !== null}
                title={t("app.delete")}
                message={t("app.automation.metaEvents") + ": " + (deleteTarget?.name ?? "")}
                confirmLabel={t("app.delete")}
                cancelLabel={t("app.cancel")}
                danger
                confirmLoading={deletingId !== null}
                onConfirm={() => void handleDelete()}
                onCancel={() => setDeleteTarget(null)}
            />
        </div>
    );
}
