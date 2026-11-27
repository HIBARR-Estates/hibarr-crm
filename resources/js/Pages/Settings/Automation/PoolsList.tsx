import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { message, Select } from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import Button from "@/Components/Redesign/primitives/Button";
import EmptyState from "@/Components/Redesign/primitives/EmptyState";
import ConfirmDialog from "@/Components/Redesign/primitives/ConfirmDialog";
import Switch from "@/Components/Redesign/primitives/Switch";
import { Modal, ModalField } from "@/Components/Redesign/primitives/Modal";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import useTranslation from "@/Hooks/useTranslation";
import { AssignmentPool } from "./types";
import { useAutomationWorkspace } from "./context/AutomationWorkspaceContext";

const ROW_GRID = "grid items-center gap-x-3 px-3.5 py-3 border-b last:border-b-0";
const COLUMNS = "minmax(0,1.2fr) minmax(0,2fr) 90px 90px";

interface MemberDraft {
    user_id: number;
    active: boolean;
}

function userName(u: { id: number; name?: string; first_name?: string; last_name?: string }): string {
    return u.name || [u.first_name, u.last_name].filter(Boolean).join(" ") || `#${u.id}`;
}

/**
 * Assignment pools: groups of users the "Assign lead owner" action hands leads to in turn. Loaded on
 * mount (nothing else on the page needs them), and each save patches the local list from the response
 * rather than reloading. A member marked away stays in the pool but is skipped.
 */
export default function PoolsList() {
    const { t } = useTranslation();
    const { catalog } = useAutomationWorkspace();
    const [pools, setPools] = useState<AssignmentPool[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<AssignmentPool | null>(null);
    const [name, setName] = useState("");
    const [active, setActive] = useState(true);
    const [members, setMembers] = useState<MemberDraft[]>([]);
    const [deleteTarget, setDeleteTarget] = useState<AssignmentPool | null>(null);
    const [deleting, setDeleting] = useState(false);

    const users = useMemo(() => catalog?.users ?? [], [catalog]);
    const nameById = useMemo(() => new Map(users.map((u) => [u.id, userName(u)])), [users]);

    const load = useCallback(async () => {
        try {
            const res = await axios.get(route("lead-assignment-pools.index"), { headers: { Accept: "application/json" } });
            setPools((res.data?.data ?? []) as AssignmentPool[]);
        } catch {
            message.error(t("messages.somethingWentWrong"));
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => {
        void load();
    }, [load]);

    function openModal(pool: AssignmentPool | null) {
        setEditing(pool);
        setName(pool?.name ?? "");
        setActive(pool?.active ?? true);
        setMembers((pool?.members ?? []).map((m) => ({ user_id: m.user_id, active: m.active })));
        setModalOpen(true);
    }

    function closeModal() {
        setModalOpen(false);
        setEditing(null);
    }

    async function handleSubmit() {
        setSaving(true);
        try {
            const payload = { name: name.trim(), active: active ? 1 : 0, members };
            const res = editing
                ? await axios.put(route("lead-assignment-pools.update", editing.id), payload, { headers: { Accept: "application/json" } })
                : await axios.post(route("lead-assignment-pools.store"), payload, { headers: { Accept: "application/json" } });
            const saved = res.data?.data as AssignmentPool | undefined;
            if (res.data?.status === "success" && saved) {
                setPools((prev) => (editing ? prev.map((p) => (p.id === saved.id ? saved : p)) : [...prev, saved]));
                message.success(res.data.message || t("messages.recordSaved"));
                closeModal();
            } else {
                message.error(res.data?.message || t("messages.somethingWentWrong"));
            }
        } catch (error: any) {
            message.error(error?.response?.data?.message || t("messages.somethingWentWrong"));
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete() {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            await axios.delete(route("lead-assignment-pools.destroy", deleteTarget.id), { headers: { Accept: "application/json" } });
            setPools((prev) => prev.filter((p) => p.id !== deleteTarget.id));
            setDeleteTarget(null);
        } catch (error: any) {
            message.error(error?.response?.data?.message || t("messages.somethingWentWrong"));
        } finally {
            setDeleting(false);
        }
    }

    /** Picking users keeps the availability already set for those who stay. */
    function selectUsers(ids: number[]) {
        setMembers((prev) => ids.map((id) => prev.find((m) => m.user_id === id) ?? { user_id: id, active: true }));
    }

    function setAvailable(userId: number, available: boolean) {
        setMembers((prev) => prev.map((m) => (m.user_id === userId ? { ...m, active: available } : m)));
    }

    return (
        <div>
            <div className="flex items-end justify-between gap-4 mb-4 flex-wrap">
                <div>
                    <h1 className="m-0 font-bold" style={{ fontSize: 19, color: T.NAVY }}>
                        {t("app.automation.assignmentPools")}
                    </h1>
                    <p className="mt-1 mb-0" style={{ fontSize: 13, color: T.TEXT_MUTED }}>
                        {t("app.automation.assignmentPoolsSubtitle")}
                    </p>
                </div>
                <Button variant="primary" icon={<PlusOutlined />} onClick={() => openModal(null)}>
                    {t("app.automation.newPool")}
                </Button>
            </div>

            {!loading && pools.length === 0 && (
                <EmptyState title={t("app.automation.noPoolsTitle")} description={t("app.automation.noPoolsDescription")} />
            )}

            {(loading || pools.length > 0) && (
                <div className="flex flex-col overflow-hidden rounded-[10px] border bg-white" style={{ borderColor: T.BORDER }}>
                    <div
                        className={ROW_GRID}
                        style={{
                            gridTemplateColumns: COLUMNS,
                            background: T.SURFACE_2,
                            borderColor: T.BORDER,
                            fontSize: 11,
                            fontWeight: 700,
                            letterSpacing: "0.05em",
                            textTransform: "uppercase",
                            color: T.TEXT_MUTED,
                        }}
                    >
                        <span>{t("app.automation.poolName")}</span>
                        <span>{t("app.automation.poolMembers")}</span>
                        <span>{t("app.automation.status")}</span>
                        <span className="text-right">{t("app.action")}</span>
                    </div>
                    {loading ? (
                        <div className="px-3.5 py-6 text-center text-sm" style={{ color: T.TEXT_MUTED }}>
                            {t("app.loading")}
                        </div>
                    ) : (
                        pools.map((pool) => (
                            <div key={pool.id} className={ROW_GRID} style={{ gridTemplateColumns: COLUMNS, borderColor: T.BORDER }}>
                                <span className="truncate text-sm font-semibold" style={{ color: T.TEXT }} title={pool.name}>
                                    {pool.name}
                                </span>
                                <div className="flex flex-wrap gap-1.5">
                                    {pool.members.length === 0 ? (
                                        <span style={{ fontSize: 12, color: T.TEXT_HINT }}>{t("app.automation.poolNoMembers")}</span>
                                    ) : (
                                        pool.members.map((m) => (
                                            <span
                                                key={m.user_id}
                                                style={{
                                                    padding: "3px 8px",
                                                    borderRadius: 6,
                                                    background: T.SURFACE_2,
                                                    border: `1px solid ${T.BORDER_SOFT}`,
                                                    fontSize: 12,
                                                    color: m.active ? T.TEXT : T.TEXT_HINT,
                                                }}
                                            >
                                                {m.name}
                                                {!m.active && ` · ${t("app.automation.poolMemberAway")}`}
                                            </span>
                                        ))
                                    )}
                                </div>
                                <span style={{ fontSize: 12, color: pool.active ? T.BLUE_DARK : T.TEXT_HINT }}>
                                    {pool.active ? t("app.automation.poolActive") : t("app.automation.poolPaused")}
                                </span>
                                <span className="flex items-center justify-end gap-1">
                                    <Button variant="ghost" size="sm" icon={<EditOutlined />} aria-label={t("app.edit")} onClick={() => openModal(pool)} />
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        icon={<DeleteOutlined />}
                                        aria-label={t("app.delete")}
                                        onClick={() => setDeleteTarget(pool)}
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
                title={editing ? t("app.automation.editPool") : t("app.automation.newPool")}
                onClose={closeModal}
                dirty={name.trim() !== "" || members.length > 0}
                footer={
                    <>
                        <Button variant="ghost" onClick={closeModal} disabled={saving}>
                            {t("app.cancel")}
                        </Button>
                        <Button variant="primary" onClick={() => void handleSubmit()} loading={saving} disabled={!name.trim()}>
                            {t("app.save")}
                        </Button>
                    </>
                }
            >
                <ModalField label={t("app.automation.poolName")}>
                    <input value={name} onChange={(e) => setName(e.target.value)} className="dr-input w-full" autoFocus />
                </ModalField>
                <ModalField label={t("app.automation.poolMembers")}>
                    <Select
                        mode="multiple"
                        value={members.map((m) => m.user_id)}
                        onChange={selectUsers}
                        options={users.map((u) => ({ value: u.id, label: userName(u) }))}
                        showSearch
                        optionFilterProp="label"
                        placeholder={t("app.automation.poolMembersPlaceholder")}
                        className="w-full"
                    />
                </ModalField>
                {members.length > 0 && (
                    <div className="mb-3 flex flex-col gap-1.5">
                        {members.map((m) => (
                            <label key={m.user_id} className="flex items-center gap-2" style={{ fontSize: 13, color: T.TEXT }}>
                                <input type="checkbox" checked={m.active} onChange={(e) => setAvailable(m.user_id, e.target.checked)} />
                                <span className="flex-1">{nameById.get(m.user_id) ?? `#${m.user_id}`}</span>
                                <span style={{ fontSize: 12, color: T.TEXT_HINT }}>{t("app.automation.poolMemberAvailable")}</span>
                            </label>
                        ))}
                    </div>
                )}
                <div className="flex items-center justify-between py-1.5">
                    <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: T.TEXT }}>{t("app.automation.poolActive")}</div>
                        <div style={{ fontSize: 12, color: T.TEXT_HINT }}>{t("app.automation.poolActiveHint")}</div>
                    </div>
                    <Switch checked={active} onChange={() => setActive((v) => !v)} aria-label={t("app.automation.poolActive")} />
                </div>
            </Modal>

            <ConfirmDialog
                open={deleteTarget !== null}
                title={t("app.delete")}
                message={t("app.automation.assignmentPools") + ": " + (deleteTarget?.name ?? "")}
                confirmLabel={t("app.delete")}
                cancelLabel={t("app.cancel")}
                danger
                confirmLoading={deleting}
                onConfirm={() => void handleDelete()}
                onCancel={() => setDeleteTarget(null)}
            />
        </div>
    );
}
