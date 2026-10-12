import { Dispatch, SetStateAction, useRef, useState } from "react";
import Badge from "@/Components/Redesign/primitives/Badge";
import Button from "@/Components/Redesign/primitives/Button";
import ConfirmDialog from "@/Components/Redesign/primitives/ConfirmDialog";
import EmptyState from "@/Components/Redesign/primitives/EmptyState";
import Icon from "@/Components/Redesign/primitives/Icon";
import { Modal, ModalField } from "@/Components/Redesign/primitives/Modal";
import {
    REDESIGN_TOKENS as T,
    REDESIGN_TYPE,
} from "@/Components/Redesign/tokens";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import useLeadStatusMutations from "./hooks/useLeadStatusMutations";
import type { LeadStatusDraft, LeadStatusRow } from "./types";

const DEFAULT_COLOR = "#6c757d";
const HEX_COLOR = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;

const ROW_GRID =
    "grid grid-cols-[28px_minmax(0,1fr)_auto_auto] items-center gap-x-3 px-3.5 py-2.5 border-b last:border-b-0";

const emptyDraft = (sortOrder: number): LeadStatusDraft => ({
    key: "",
    label: "",
    description: "",
    label_color: DEFAULT_COLOR,
    sort_order: sortOrder,
});

function slugifyKey(value: string): string {
    return value
        .trim()
        .toLowerCase()
        .replace(/['"]/g, "")
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^[^a-z]+/, "")
        .replace(/^_+|_+$/g, "")
        .slice(0, 50);
}

function toDraft(row: LeadStatusRow): LeadStatusDraft {
    return {
        key: row.key,
        label: row.label,
        description: row.description ?? "",
        label_color: row.label_color || DEFAULT_COLOR,
        sort_order: row.sort_order,
    };
}

function nextSortOrder(rows: LeadStatusRow[]): number {
    return rows.reduce((max, row) => Math.max(max, row.sort_order), 0) + 1;
}

export default function LeadStatusesSection({
    statuses,
    setStatuses,
}: {
    statuses: LeadStatusRow[];
    setStatuses: Dispatch<SetStateAction<LeadStatusRow[]>>;
}) {
    const { t } = useTranslation();
    const { td } = useTd();
    const mutations = useLeadStatusMutations(setStatuses);

    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<LeadStatusRow | null>(null);
    const [draft, setDraft] = useState<LeadStatusDraft>(emptyDraft(1));
    const [keyTouched, setKeyTouched] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<LeadStatusRow | null>(
        null,
    );
    const [dragId, setDragId] = useState<number | null>(null);
    const statusesRef = useRef(statuses);
    statusesRef.current = statuses;

    const closeModal = () => {
        setModalOpen(false);
        setEditing(null);
        setKeyTouched(false);
        setDraft(emptyDraft(nextSortOrder(statusesRef.current)));
    };

    const openCreate = () => {
        setEditing(null);
        setKeyTouched(false);
        setDraft(emptyDraft(nextSortOrder(statuses)));
        setModalOpen(true);
    };

    const openEdit = (row: LeadStatusRow) => {
        setEditing(row);
        setKeyTouched(true);
        setDraft(toDraft(row));
        setModalOpen(true);
    };

    const patchDraft = (patch: Partial<LeadStatusDraft>) => {
        setDraft((prev) => {
            const next = { ...prev, ...patch };
            if (
                !editing &&
                !keyTouched &&
                patch.label !== undefined
            ) {
                next.key = slugifyKey(patch.label);
            }
            return next;
        });
    };

    const canSave =
        draft.label.trim().length > 0 &&
        (editing !== null || draft.key.trim().length > 0) &&
        HEX_COLOR.test(draft.label_color);

    const handleSubmit = async () => {
        if (!canSave) return;
        const payload: LeadStatusDraft = {
            ...draft,
            key: draft.key.trim(),
            label: draft.label.trim(),
            description: draft.description.trim(),
        };
        const ok = editing
            ? await mutations.updateStatus(editing.id, payload)
            : await mutations.createStatus(payload);
        if (ok) closeModal();
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        const ok = await mutations.deleteStatus(deleteTarget.id);
        if (ok) setDeleteTarget(null);
    };

    const moveStatus = (fromId: number, toId: number) => {
        if (fromId === toId) return;
        setStatuses((prev) => {
            const from = prev.findIndex((row) => row.id === fromId);
            const to = prev.findIndex((row) => row.id === toId);
            if (from < 0 || to < 0) return prev;
            const next = [...prev];
            const [moved] = next.splice(from, 1);
            next.splice(to, 0, moved);
            statusesRef.current = next;
            return next;
        });
    };

    return (
        <div>
            <div
                style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap",
                    marginBottom: 16,
                }}
            >
                <p
                    style={{
                        margin: 0,
                        fontSize: REDESIGN_TYPE.BODY,
                        color: T.TEXT_MUTED,
                        lineHeight: 1.45,
                        flex: "1 1 220px",
                    }}
                >
                    {td(
                        "Statuses that track where a lead is in qualification. Built-in statuses can be renamed but not deleted. Drag to set the order they show in lists.",
                        { source: "en" },
                    )}
                </p>
                {statuses.length > 0 && (
                    <Button
                        variant="primary"
                        size="sm"
                        icon={<Icon name="plus" size={14} />}
                        onClick={openCreate}
                    >
                        {td("Add lead status", { source: "en" })}
                    </Button>
                )}
            </div>

            {statuses.length === 0 ? (
                <EmptyState
                    icon="list"
                    title={td("No lead statuses yet", { source: "en" })}
                    description={td(
                        "Add the statuses a lead moves through, such as New, Contacted, or Qualified.",
                        { source: "en" },
                    )}
                    action={{
                        label: td("Add lead status", { source: "en" }),
                        onClick: openCreate,
                    }}
                />
            ) : (
                <div
                    className="overflow-hidden rounded-[10px] border"
                    style={{ borderColor: T.BORDER }}
                >
                    {statuses.map((row, index) => {
                        const canDelete = !row.is_system && row.leads_count === 0;
                        const canReorder = !mutations.reordering;

                        const moveAndPersist = (toIndex: number) => {
                            if (toIndex < 0 || toIndex >= statuses.length) {
                                return;
                            }
                            mutations.beginReorder(statusesRef.current);
                            moveStatus(row.id, statuses[toIndex].id);
                            void mutations.persistReorder(statusesRef.current);
                        };

                        return (
                            <div
                                key={row.id}
                                className={ROW_GRID}
                                style={{
                                    borderColor: T.BORDER_SOFT,
                                    background:
                                        dragId === row.id
                                            ? T.SURFACE_2
                                            : T.SURFACE,
                                    opacity: dragId === row.id ? 0.6 : 1,
                                }}
                                draggable={canReorder}
                                onDragStart={() => {
                                    if (!canReorder) return;
                                    mutations.beginReorder(statusesRef.current);
                                    setDragId(row.id);
                                }}
                                onDragOver={(event) => {
                                    if (!canReorder || dragId === null) return;
                                    event.preventDefault();
                                    moveStatus(dragId, row.id);
                                }}
                                onDragEnd={() => {
                                    if (!canReorder) return;
                                    setDragId(null);
                                    void mutations.persistReorder(
                                        statusesRef.current,
                                    );
                                }}
                            >
                                <span
                                    aria-hidden="true"
                                    style={{
                                        color: T.TEXT_HINT,
                                        cursor: canReorder ? "grab" : "default",
                                        display: "flex",
                                        justifyContent: "center",
                                    }}
                                >
                                    <Icon name="grip-vertical" size={14} />
                                </span>
                                <div className="min-w-0">
                                    <div className="flex min-w-0 items-center gap-2">
                                        <span
                                            aria-hidden="true"
                                            style={{
                                                width: 10,
                                                height: 10,
                                                borderRadius: 999,
                                                background:
                                                    row.label_color ||
                                                    DEFAULT_COLOR,
                                                flexShrink: 0,
                                            }}
                                        />
                                        <span
                                            className="min-w-0 truncate text-sm font-medium"
                                            style={{ color: T.TEXT }}
                                            title={row.label}
                                        >
                                            {row.label}
                                        </span>
                                        {row.is_default && (
                                            <Badge variant="gray">
                                                {t("app.default")}
                                            </Badge>
                                        )}
                                    </div>
                                    {row.description && (
                                        <div
                                            className="mt-0.5 truncate text-xs"
                                            style={{ color: T.TEXT_MUTED }}
                                            title={row.description}
                                        >
                                            {row.description}
                                        </div>
                                    )}
                                </div>
                                <span
                                    className="text-xs tabular-nums"
                                    style={{ color: T.TEXT_MUTED }}
                                >
                                    {row.leads_count > 0
                                        ? td(
                                              `${row.leads_count} ${row.leads_count === 1 ? "lead" : "leads"}`,
                                              { source: "en" },
                                          )
                                        : null}
                                </span>
                                <span className="flex items-center justify-end gap-1">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        icon={<Icon name="chevron-up" size={14} />}
                                        aria-label={td("Move up", {
                                            source: "en",
                                        })}
                                        disabled={!canReorder || index === 0}
                                        onClick={() => moveAndPersist(index - 1)}
                                    />
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        icon={
                                            <Icon name="chevron-down" size={14} />
                                        }
                                        aria-label={td("Move down", {
                                            source: "en",
                                        })}
                                        disabled={
                                            !canReorder ||
                                            index === statuses.length - 1
                                        }
                                        onClick={() => moveAndPersist(index + 1)}
                                    />
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        icon={<Icon name="edit" size={14} />}
                                        aria-label={t("app.edit")}
                                        onClick={() => openEdit(row)}
                                    />
                                    {canDelete && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            icon={
                                                <Icon name="trash" size={14} />
                                            }
                                            aria-label={t("app.delete")}
                                            loading={
                                                mutations.deletingId === row.id
                                            }
                                            onClick={() => setDeleteTarget(row)}
                                            style={{ color: T.RED }}
                                        />
                                    )}
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}

            <Modal
                open={modalOpen}
                title={
                    editing
                        ? td("Edit lead status", { source: "en" })
                        : td("Add lead status", { source: "en" })
                }
                onClose={closeModal}
                dirty={
                    draft.label.trim().length > 0 ||
                    draft.key.trim().length > 0 ||
                    draft.description.trim().length > 0
                }
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
                            disabled={!canSave}
                        >
                            {t("app.save")}
                        </Button>
                    </>
                }
            >
                <ModalField
                    label={td("Name", { source: "en" })}
                >
                    <input
                        id="lead-status-label"
                        className="dr-input"
                        value={draft.label}
                        onChange={(event) =>
                            patchDraft({ label: event.target.value })
                        }
                        autoFocus
                    />
                </ModalField>
                <ModalField label={td("Key", { source: "en" })}>
                    <input
                        id="lead-status-key"
                        className="dr-input"
                        value={draft.key}
                        readOnly={editing !== null}
                        onChange={(event) => {
                            setKeyTouched(true);
                            patchDraft({ key: event.target.value });
                        }}
                    />
                    <p
                        style={{
                            margin: "6px 0 0",
                            fontSize: 12,
                            color: T.TEXT_MUTED,
                            lineHeight: 1.4,
                        }}
                    >
                        {editing
                            ? td(
                                  "The key is fixed and used by workflows.",
                                  { source: "en" },
                              )
                            : td(
                                  "Lowercase letters, numbers, and underscores. This cannot be changed later.",
                                  { source: "en" },
                              )}
                    </p>
                </ModalField>
                <ModalField label={t("app.description")}>
                    <textarea
                        id="lead-status-description"
                        className="dr-input"
                        rows={3}
                        value={draft.description}
                        onChange={(event) =>
                            patchDraft({ description: event.target.value })
                        }
                    />
                </ModalField>
                <ModalField label={td("Color", { source: "en" })}>
                    <div className="flex items-center gap-2">
                        <input
                            type="color"
                            value={
                                HEX_COLOR.test(draft.label_color) &&
                                draft.label_color.length !== 4
                                    ? draft.label_color
                                    : DEFAULT_COLOR
                            }
                            onChange={(event) =>
                                patchDraft({
                                    label_color: event.target.value,
                                })
                            }
                            style={{
                                width: 40,
                                height: 36,
                                padding: 2,
                                border: `1px solid ${T.BORDER}`,
                                borderRadius: 8,
                                background: T.WHITE,
                                cursor: "pointer",
                            }}
                            aria-label={td("Color", { source: "en" })}
                        />
                        <input
                            className="dr-input"
                            value={draft.label_color}
                            onChange={(event) =>
                                patchDraft({
                                    label_color: event.target.value,
                                })
                            }
                            style={{ maxWidth: 140 }}
                        />
                    </div>
                </ModalField>
            </Modal>

            <ConfirmDialog
                open={deleteTarget !== null}
                title={t("app.delete")}
                message={td("Delete this lead status?", { source: "en" })}
                confirmLabel={t("messages.confirmDelete")}
                cancelLabel={t("app.cancel")}
                danger
                confirmLoading={mutations.deletingId !== null}
                onConfirm={() => void handleDelete()}
                onCancel={() => setDeleteTarget(null)}
            />
        </div>
    );
}
