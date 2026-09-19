import { Dispatch, SetStateAction, useRef, useState } from "react";
import Button from "@/Components/Redesign/primitives/Button";
import ConfirmDialog from "@/Components/Redesign/primitives/ConfirmDialog";
import EmptyState from "@/Components/Redesign/primitives/EmptyState";
import Icon from "@/Components/Redesign/primitives/Icon";
import { Modal } from "@/Components/Redesign/primitives/Modal";
import {
    REDESIGN_RADIUS,
    REDESIGN_TOKENS as T,
    REDESIGN_TYPE,
} from "@/Components/Redesign/tokens";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import useLeadSourceMutations from "./hooks/useLeadSourceMutations";
import type { LeadSourcePermissions, LeadSourceRow } from "./types";

const ROW_GRID =
    "grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-x-3 px-3.5 py-2.5 border-b last:border-b-0";

export default function LeadSourcesSection({
    sources,
    setSources,
    permissions,
    currentUserId,
}: {
    sources: LeadSourceRow[];
    setSources: Dispatch<SetStateAction<LeadSourceRow[]>>;
    permissions: LeadSourcePermissions;
    currentUserId: number;
}) {
    const { t } = useTranslation();
    const { td } = useTd();
    const mutations = useLeadSourceMutations(setSources);

    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<LeadSourceRow | null>(null);
    const [name, setName] = useState("");
    const [deleteTarget, setDeleteTarget] = useState<LeadSourceRow | null>(null);
    const [dragId, setDragId] = useState<number | null>(null);
    const sourcesRef = useRef(sources);
    sourcesRef.current = sources;

    const canEdit = (source: LeadSourceRow) =>
        permissions.edit === "all" ||
        (permissions.edit === "added" && source.added_by === currentUserId);

    const canDelete = (source: LeadSourceRow) =>
        permissions.delete === "all" ||
        (permissions.delete === "added" && source.added_by === currentUserId);

    const closeModal = () => {
        setModalOpen(false);
        setEditing(null);
        setName("");
    };

    const openCreate = () => {
        setEditing(null);
        setName("");
        setModalOpen(true);
    };

    const openEdit = (source: LeadSourceRow) => {
        setEditing(source);
        setName(source.type);
        setModalOpen(true);
    };

    const handleSubmit = async () => {
        const trimmed = name.trim();
        if (!trimmed) return;
        const ok = editing
            ? await mutations.updateSource(editing.id, trimmed)
            : await mutations.createSource(trimmed);
        if (ok) closeModal();
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        const ok = await mutations.deleteSource(deleteTarget.id);
        if (ok) setDeleteTarget(null);
    };

    const moveSource = (fromId: number, toId: number) => {
        if (fromId === toId) return;
        setSources((prev) => {
            const from = prev.findIndex((source) => source.id === fromId);
            const to = prev.findIndex((source) => source.id === toId);
            if (from < 0 || to < 0) return prev;
            const next = [...prev];
            const [moved] = next.splice(from, 1);
            next.splice(to, 0, moved);
            sourcesRef.current = next;
            return next;
        });
    };

    return (
        <section
            style={{
                background: T.SURFACE,
                border: `1px solid ${T.BORDER}`,
                borderRadius: REDESIGN_RADIUS.MD,
                padding: 20,
            }}
        >
            <div
                style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap",
                }}
            >
                <div style={{ minWidth: 0, flex: "1 1 220px" }}>
                    <div
                        style={{
                            fontSize: REDESIGN_TYPE.CAPTION,
                            fontWeight: 700,
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                            color: T.GRAY_DARKER,
                        }}
                    >
                        {td("Lead sources", { source: "en" })}
                    </div>
                    <p
                        style={{
                            margin: "4px 0 0",
                            fontSize: REDESIGN_TYPE.BODY,
                            color: T.TEXT_MUTED,
                            lineHeight: 1.45,
                        }}
                    >
                        {td(
                            "Names that appear on the lead source field. Drag to set the order they show in lists.",
                            { source: "en" },
                        )}
                    </p>
                </div>
                {permissions.add && sources.length > 0 && (
                    <Button
                        variant="primary"
                        size="sm"
                        icon={<Icon name="plus" size={14} />}
                        onClick={openCreate}
                    >
                        {t("app.addNewLeadSource")}
                    </Button>
                )}
            </div>

            <div style={{ marginTop: 16 }}>
                {sources.length === 0 ? (
                    <EmptyState
                        icon="list"
                        title={t("messages.noLeadSourceAdded")}
                        description={td(
                            "Add the channels leads come from — website, referral, walk-in, and so on.",
                            { source: "en" },
                        )}
                        action={
                            permissions.add
                                ? {
                                      label: t("app.addNewLeadSource"),
                                      onClick: openCreate,
                                  }
                                : undefined
                        }
                    />
                ) : (
                    <div
                        className="overflow-hidden rounded-[10px] border"
                        style={{ borderColor: T.BORDER }}
                    >
                        {sources.map((source) => {
                            const editThis = canEdit(source);
                            const deleteThis = canDelete(source);

                            return (
                                <div
                                    key={source.id}
                                    className={ROW_GRID}
                                    style={{
                                        borderColor: T.BORDER_SOFT,
                                        background:
                                            dragId === source.id
                                                ? T.SURFACE_2
                                                : T.SURFACE,
                                        opacity: dragId === source.id ? 0.6 : 1,
                                    }}
                                    draggable={permissions.reorder}
                                    onDragStart={() => {
                                        if (!permissions.reorder) return;
                                        mutations.beginReorder(sourcesRef.current);
                                        setDragId(source.id);
                                    }}
                                    onDragOver={(event) => {
                                        if (!permissions.reorder || dragId === null) {
                                            return;
                                        }
                                        event.preventDefault();
                                        moveSource(dragId, source.id);
                                    }}
                                    onDragEnd={() => {
                                        if (!permissions.reorder) return;
                                        setDragId(null);
                                        void mutations.persistReorder(
                                            sourcesRef.current,
                                        );
                                    }}
                                >
                                    <span
                                        aria-hidden="true"
                                        style={{
                                            color: T.TEXT_HINT,
                                            cursor: permissions.reorder
                                                ? "grab"
                                                : "default",
                                            display: "flex",
                                            justifyContent: "center",
                                        }}
                                    >
                                        {permissions.reorder ? (
                                            <Icon name="grip-vertical" size={14} />
                                        ) : null}
                                    </span>
                                    <span
                                        className="min-w-0 truncate text-sm font-medium"
                                        style={{ color: T.TEXT }}
                                        title={source.type}
                                    >
                                        {source.type}
                                    </span>
                                    <span className="flex items-center justify-end gap-1">
                                        {editThis && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                icon={<Icon name="edit" size={14} />}
                                                aria-label={t("app.edit")}
                                                onClick={() => openEdit(source)}
                                            />
                                        )}
                                        {deleteThis && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                icon={<Icon name="trash" size={14} />}
                                                aria-label={t("app.delete")}
                                                loading={
                                                    mutations.deletingId === source.id
                                                }
                                                onClick={() => setDeleteTarget(source)}
                                                style={{ color: T.RED }}
                                            />
                                        )}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <Modal
                open={modalOpen}
                title={
                    editing
                        ? t("modules.lead.editLeadSource")
                        : t("modules.lead.addLeadSource")
                }
                onClose={closeModal}
                dirty={name.trim().length > 0}
                footer={
                    <>
                        <Button
                            variant="ghost"
                            onClick={closeModal}
                            disabled={mutations.saving}
                        >
                            {t("app.cancel")}
                        </Button>
                        <Button
                            variant="primary"
                            onClick={() => void handleSubmit()}
                            loading={mutations.saving}
                            disabled={!name.trim()}
                        >
                            {t("app.save")}
                        </Button>
                    </>
                }
            >
                <label
                    htmlFor="lead-source-type"
                    style={{
                        display: "block",
                        marginBottom: 6,
                        fontSize: 12,
                        fontWeight: 600,
                        color: T.TEXT_MUTED,
                    }}
                >
                    {t("modules.lead.leadSource")}
                </label>
                <input
                    id="lead-source-type"
                    className="dr-input"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    onKeyDown={(event) => {
                        if (event.key === "Enter") void handleSubmit();
                    }}
                    autoFocus
                />
            </Modal>

            <ConfirmDialog
                open={deleteTarget !== null}
                title={t("app.delete")}
                message={td("Delete this lead source?", { source: "en" })}
                confirmLabel={t("messages.confirmDelete")}
                cancelLabel={t("app.cancel")}
                danger
                confirmLoading={mutations.deletingId !== null}
                onConfirm={() => void handleDelete()}
                onCancel={() => setDeleteTarget(null)}
            />
        </section>
    );
}
