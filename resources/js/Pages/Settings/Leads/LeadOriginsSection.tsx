import { Dispatch, SetStateAction, useState } from "react";
import Badge from "@/Components/Redesign/primitives/Badge";
import Button from "@/Components/Redesign/primitives/Button";
import ConfirmDialog from "@/Components/Redesign/primitives/ConfirmDialog";
import EmptyState from "@/Components/Redesign/primitives/EmptyState";
import Icon from "@/Components/Redesign/primitives/Icon";
import { Modal } from "@/Components/Redesign/primitives/Modal";
import { REDESIGN_TOKENS as T, REDESIGN_TYPE } from "@/Components/Redesign/tokens";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import useLeadOriginMutations from "./hooks/useLeadOriginMutations";
import type { LeadOriginRow } from "./types";

const ROW_GRID =
    "grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 px-3.5 py-2.5 border-b last:border-b-0";

/**
 * The options of the lead "Origin" field. The marketing lead flow stamps one
 * of them (chosen on the Marketing lead flow tab); the leads filter and lead
 * automations read them too.
 */
export default function LeadOriginsSection({
    origins,
    setOrigins,
    marketingOriginId,
}: {
    origins: LeadOriginRow[];
    setOrigins: Dispatch<SetStateAction<LeadOriginRow[]>>;
    marketingOriginId: number;
}) {
    const { t } = useTranslation();
    const { td } = useTd();
    const mutations = useLeadOriginMutations(setOrigins);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<LeadOriginRow | null>(null);
    const [name, setName] = useState("");
    const [deleteTarget, setDeleteTarget] = useState<LeadOriginRow | null>(null);

    const openCreate = () => {
        setEditing(null);
        setName("");
        setModalOpen(true);
    };
    const openEdit = (origin: LeadOriginRow) => {
        setEditing(origin);
        setName(origin.name);
        setModalOpen(true);
    };
    const closeModal = () => {
        setModalOpen(false);
        setEditing(null);
        setName("");
    };
    const handleSubmit = async () => {
        if (!name.trim()) return;
        const ok = editing ? await mutations.updateOrigin(editing.id, name) : await mutations.createOrigin(name);
        if (ok) closeModal();
    };

    return (
        <div>
            <div className="flex flex-wrap items-start justify-between gap-3" style={{ marginBottom: 16 }}>
                <p style={{ margin: 0, flex: "1 1 260px", fontSize: REDESIGN_TYPE.BODY, color: T.TEXT_MUTED, lineHeight: 1.45 }}>
                    {t("pages.lead_settings.origins.intro")}
                </p>
                {origins.length > 0 && (
                    <Button variant="primary" size="sm" icon={<Icon name="plus" size={14} />} onClick={openCreate}>
                        {t("pages.lead_settings.origins.add")}
                    </Button>
                )}
            </div>

            {origins.length === 0 ? (
                <EmptyState
                    icon="tag"
                    title={t("pages.lead_settings.origins.empty_title")}
                    description={t("pages.lead_settings.origins.empty_description")}
                    action={{ label: t("pages.lead_settings.origins.add"), onClick: openCreate }}
                />
            ) : (
                <div className="overflow-hidden rounded-[10px] border" style={{ borderColor: T.BORDER }}>
                    {origins.map((origin, index) => {
                        const isMarketing = origin.id === marketingOriginId;
                        return (
                            <div key={origin.id} className={ROW_GRID} style={{ borderColor: T.BORDER_SOFT, background: T.SURFACE }}>
                                <span className="flex min-w-0 items-center gap-2">
                                    <span className="truncate text-sm font-medium" style={{ color: T.TEXT }} title={origin.name}>
                                        {td(origin.name, { source: "en" })}
                                    </span>
                                    {isMarketing && <Badge variant="blue">{t("pages.lead_settings.origins.used_by_flow")}</Badge>}
                                </span>
                                <span className="text-xs" style={{ color: T.TEXT_MUTED, whiteSpace: "nowrap" }}>
                                    {t("pages.lead_settings.origins.lead_count", { count: origin.leads_count })}
                                </span>
                                <span className="flex items-center justify-end gap-1">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        icon={<Icon name="chevron-up" size={14} />}
                                        aria-label={t("pages.lead_settings.origins.move_up")}
                                        disabled={mutations.reordering || index === 0}
                                        onClick={() => void mutations.moveOrigin(origins, index, index - 1)}
                                    />
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        icon={<Icon name="chevron-down" size={14} />}
                                        aria-label={t("pages.lead_settings.origins.move_down")}
                                        disabled={mutations.reordering || index === origins.length - 1}
                                        onClick={() => void mutations.moveOrigin(origins, index, index + 1)}
                                    />
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        icon={<Icon name="edit" size={14} />}
                                        aria-label={t("app.edit")}
                                        onClick={() => openEdit(origin)}
                                    />
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        icon={<Icon name="trash" size={14} />}
                                        aria-label={t("app.delete")}
                                        title={isMarketing ? t("pages.lead_settings.origins.in_use_by_marketing_flow") : undefined}
                                        disabled={isMarketing}
                                        loading={mutations.deletingId === origin.id}
                                        onClick={() => setDeleteTarget(origin)}
                                        style={{ color: isMarketing ? undefined : T.RED }}
                                    />
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}

            <Modal
                open={modalOpen}
                title={editing ? t("pages.lead_settings.origins.edit_title") : t("pages.lead_settings.origins.add")}
                onClose={closeModal}
                dirty={name.trim().length > 0}
                footer={
                    <>
                        <Button variant="ghost" onClick={closeModal} disabled={mutations.saving}>
                            {t("app.cancel")}
                        </Button>
                        <Button variant="primary" onClick={() => void handleSubmit()} loading={mutations.saving} disabled={!name.trim()}>
                            {t("app.save")}
                        </Button>
                    </>
                }
            >
                <label
                    htmlFor="lead-origin-name"
                    style={{ display: "block", marginBottom: 6, fontSize: 12, fontWeight: 600, color: T.TEXT_MUTED }}
                >
                    {t("pages.lead_settings.origins.name_label")}
                </label>
                <input
                    id="lead-origin-name"
                    className="dr-input"
                    value={name}
                    maxLength={100}
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
                message={t("pages.lead_settings.origins.delete_message", {
                    name: deleteTarget?.name ?? "",
                    count: deleteTarget?.leads_count ?? 0,
                })}
                confirmLabel={t("messages.confirmDelete")}
                cancelLabel={t("app.cancel")}
                danger
                confirmLoading={mutations.deletingId !== null}
                onConfirm={async () => {
                    if (deleteTarget && (await mutations.deleteOrigin(deleteTarget.id))) setDeleteTarget(null);
                }}
                onCancel={() => setDeleteTarget(null)}
            />
        </div>
    );
}
