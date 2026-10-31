import React, { useRef, useState } from "react";
import axios from "axios";
import {
    DeleteOutlined,
    EditOutlined,
    PlusOutlined,
    StarFilled,
    StarOutlined,
    ThunderboltOutlined,
} from "@ant-design/icons";
import { App } from "antd";
import Badge from "@/Components/Redesign/primitives/Badge";
import Button from "@/Components/Redesign/primitives/Button";
import ConfirmDialog from "@/Components/Redesign/primitives/ConfirmDialog";
import EmptyState from "@/Components/Redesign/primitives/EmptyState";
import { Modal } from "@/Components/Redesign/primitives/Modal";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import { useApiQuery } from "@/lib/api/client/useApiQuery";
import { useApiMutate } from "@/lib/api/client/useApiMutate";
import useSoftphoneLineTest, { type LineTestState } from "@/Hooks/useSoftphoneLineTest";
import { ApiSuccessResponse } from "@/lib/api/types";
import type {
    SoftphoneDeviceDetails,
    SoftphoneDeviceSummary,
} from "@/Types/api/softphone";

import "@/Components/Redesign/redesign.css";

const NESTED_MODAL_Z_INDEX = 1400;

interface DeviceDevicesResponse {
    status: string;
    data: {
        devices: SoftphoneDeviceSummary[];
    };
}

interface DevicePayload {
    label: string;
    /** Required on create. Omitted on update to keep the stored value. */
    wss_url?: string;
    /** Required on create. Omitted on update to keep the stored value. */
    uri?: string;
    authorization_username?: string | null;
    authorization_password: string;
    display_name?: string | null;
    is_default?: boolean;
}

const ROW_GRID =
    "grid grid-cols-[minmax(0,1fr)_70px_minmax(0,1.1fr)_110px] items-center gap-x-3 px-3.5 py-3 border-b border-[#e2e5ea] last:border-b-0";

const fieldLabel: React.CSSProperties = {
    display: "block",
    marginBottom: 6,
    fontSize: 12,
    fontWeight: 600,
    color: T.TEXT_MUTED,
};

/**
 * CRUD for the browser softphone's device lines (one per sipgate Neo channel,
 * e.g. German + Swedish). Embedded inline in Settings like TaskCategoryManager.
 * Writes are admin-only (enforced server-side).
 */
export default function SoftphoneDeviceManager() {
    const { message } = App.useApp();
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<SoftphoneDeviceSummary | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<SoftphoneDeviceSummary | null>(null);
    const [deletingId, setDeletingId] = useState<number | null>(null);

    const [label, setLabel] = useState("");
    const [wssUrl, setWssUrl] = useState("");
    const [uri, setUri] = useState("");
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [displayName, setDisplayName] = useState("");
    const [isDefault, setIsDefault] = useState(false);
    const [hasPassword, setHasPassword] = useState(false);
    // True while the edit form is waiting for the line's stored settings.
    const [detailsLoading, setDetailsLoading] = useState(false);
    // Only a test run since the modal opened is shown in it; older results stay
    // in the table but would be stale next to a form that may have changed.
    const [openedAt, setOpenedAt] = useState(0);
    // Guards against a slow response for line A landing in line B's form.
    const detailsRequest = useRef(0);

    const lineTest = useSoftphoneLineTest();

    const { data, isLoading, refetch } = useApiQuery<DeviceDevicesResponse>({
        path: route("telephony.softphone.devices.index"),
    });

    const devices = data?.data?.devices ?? [];

    const resetForm = () => {
        setEditing(null);
        setLabel("");
        setWssUrl("");
        setUri("");
        setUsername("");
        setPassword("");
        setDisplayName("");
        setIsDefault(false);
        setHasPassword(false);
        setDetailsLoading(false);
        detailsRequest.current += 1;
        lineTest.clear("draft");
    };

    const closeModal = () => {
        setModalOpen(false);
        resetForm();
    };

    const createMutation = useApiMutate<DevicePayload, string, ApiSuccessResponse<string>>(
        route("telephony.softphone.devices.store"),
        "POST",
        (response) => {
            refetch();
            closeModal();
            // Health check on the new line so a typo in the WSS URL, SIP URI
            // or password shows up now rather than on the first call.
            const newId = (response as unknown as { data?: { id?: number } }).data?.id;
            if (newId) {
                void lineTest.testSaved(newId).then((result) => {
                    if (result.ok) {
                        message.success("Line connected — it registered successfully.");
                    } else {
                        message.warning(`Line saved, but the connection test failed: ${result.message}`);
                    }
                });
            }
        },
    );

    const updateMutation = useApiMutate<DevicePayload, string, ApiSuccessResponse<string>>(
        editing ? route("telephony.softphone.devices.update", editing.id) : "",
        "PUT",
        () => {
            refetch();
            closeModal();
        },
    );

    const handleDelete = async () => {
        if (!deleteTarget) return;
        setDeletingId(deleteTarget.id);
        try {
            await axios.delete(
                route("telephony.softphone.devices.destroy", deleteTarget.id),
                { headers: { Accept: "application/json" } },
            );
            await refetch();
            setDeleteTarget(null);
        } catch {
            message.error("Could not remove the device.");
        } finally {
            setDeletingId(null);
        }
    };

    const draftConfig = () => ({
        wss_url: wssUrl.trim(),
        uri: uri.trim(),
        authorization_username: username.trim() || null,
        authorization_password: password,
        display_name: displayName.trim() || null,
    });

    const draftTestKey = editing ? String(editing.id) : "draft";
    const draftTest = lineTest.states[draftTestKey];
    const canTestDraft =
        !detailsLoading &&
        !!wssUrl.trim() &&
        !!uri.trim() &&
        (!!password.trim() || !!editing);

    const openCreate = () => {
        resetForm();
        setOpenedAt(Date.now());
        setModalOpen(true);
    };

    const openEdit = (device: SoftphoneDeviceSummary) => {
        resetForm();
        setOpenedAt(Date.now());
        setEditing(device);
        // The list only carries label + default, so those show immediately and
        // the connection settings are fetched. The password is never returned:
        // blank means "keep the stored one".
        setLabel(device.label);
        setIsDefault(device.is_default);
        setDetailsLoading(true);
        setModalOpen(true);

        const requestId = detailsRequest.current;
        axios
            .get<{ data: SoftphoneDeviceDetails }>(
                route("telephony.softphone.devices.show", device.id),
                { headers: { Accept: "application/json" } },
            )
            .then((response) => {
                if (detailsRequest.current !== requestId) return;
                const details = response.data.data;
                setLabel(details.label);
                setWssUrl(details.wss_url ?? "");
                setUri(details.uri ?? "");
                setUsername(details.authorization_username ?? "");
                setDisplayName(details.display_name ?? "");
                setIsDefault(details.is_default);
                setHasPassword(details.has_password);
                setDetailsLoading(false);
            })
            .catch(() => {
                if (detailsRequest.current !== requestId) return;
                message.error("Could not load this phone line.");
                closeModal();
            });
    };

    const handleSubmit = () => {
        if (!label.trim() || !wssUrl.trim() || !uri.trim()) return;
        if (editing ? detailsLoading : !password.trim()) return;

        // The edit form is prefilled with the stored values, so it sends them
        // all back — which also lets an admin clear the optional fields. A
        // blank password means "keep the stored one" server-side.
        const payload: DevicePayload = {
            label: label.trim(),
            wss_url: wssUrl.trim(),
            uri: uri.trim(),
            authorization_password: password,
            is_default: isDefault,
        };

        if (editing) {
            payload.authorization_username = username.trim() || null;
            payload.display_name = displayName.trim() || null;
        } else {
            if (username.trim()) payload.authorization_username = username.trim();
            if (displayName.trim()) payload.display_name = displayName.trim();
        }

        if (editing) {
            updateMutation.mutate(payload);
        } else {
            createMutation.mutate(payload);
        }
    };

    const saving = createMutation.isPending || updateMutation.isPending;
    const canSubmit = editing
        ? !detailsLoading && !!label.trim() && !!wssUrl.trim() && !!uri.trim()
        : !!label.trim() &&
          !!wssUrl.trim() &&
          !!uri.trim() &&
          !!password.trim();

    return (
        <div className="flex flex-col gap-4">
            <div className="flex shrink-0 justify-end">
                <Button
                    variant="primary"
                    size="sm"
                    icon={<PlusOutlined />}
                    onClick={openCreate}
                >
                    Add phone line
                </Button>
            </div>

            <div
                className="overflow-hidden rounded-[10px] border"
                style={{ borderColor: T.BORDER }}
            >
                <div
                    className={`${ROW_GRID} shrink-0`}
                    style={{
                        background: T.SURFACE_2,
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: "0.05em",
                        textTransform: "uppercase",
                        color: T.TEXT_MUTED,
                    }}
                >
                    <span>Label</span>
                    <span>Default</span>
                    <span>Connection</span>
                    <span className="text-right" aria-hidden="true" />
                </div>

                {isLoading ? (
                    <div className="px-3.5 py-6 text-center text-sm" style={{ color: T.TEXT_MUTED }}>
                        Loading…
                    </div>
                ) : devices.length === 0 ? (
                    <div className="p-4">
                        <EmptyState
                            title="No phone lines yet"
                            description="Add a sipgate Neo channel to use as an outbound caller ID."
                        />
                    </div>
                ) : (
                    <div className="flex flex-col">
                        {devices.map((device) => (
                            <div key={device.id} className={ROW_GRID}>
                                <span
                                    className="min-w-0 truncate text-sm font-medium"
                                    style={{ color: T.TEXT }}
                                    title={device.label}
                                >
                                    {device.label}
                                </span>
                                <span className="text-sm" style={{ color: T.TEXT_MUTED }}>
                                    {device.is_default ? (
                                        <StarFilled style={{ color: T.AMBER_TEXT ?? T.ORANGE }} />
                                    ) : (
                                        <StarOutlined style={{ color: T.TEXT_HINT }} />
                                    )}
                                </span>
                                <span className="min-w-0">
                                    <ConnectionBadge state={lineTest.states[String(device.id)]} />
                                </span>
                                <span className="flex items-center justify-end gap-1">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        icon={<ThunderboltOutlined />}
                                        aria-label="Test connection"
                                        title="Test connection"
                                        loading={lineTest.states[String(device.id)]?.status === "testing"}
                                        onClick={() => void lineTest.testSaved(device.id)}
                                    />
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        icon={<EditOutlined />}
                                        aria-label="Edit"
                                        onClick={() => openEdit(device)}
                                    />
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        icon={<DeleteOutlined />}
                                        aria-label="Delete"
                                        loading={deletingId === device.id}
                                        onClick={() => setDeleteTarget(device)}
                                        style={{ color: T.RED }}
                                    />
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <Modal
                open={modalOpen}
                zIndex={NESTED_MODAL_Z_INDEX}
                title={editing ? "Edit phone line" : "Add phone line"}
                onClose={closeModal}
                footer={
                    <>
                        <Button
                            variant="ghost"
                            className="cb-dialog-btn"
                            icon={<ThunderboltOutlined />}
                            loading={draftTest?.status === "testing"}
                            disabled={!canTestDraft || saving}
                            onClick={() => void lineTest.testDraft(draftConfig(), editing?.id ?? null)}
                            style={{ marginRight: "auto" }}
                        >
                            Test connection
                        </Button>
                        <Button
                            variant="ghost"
                            className="cb-dialog-btn"
                            onClick={closeModal}
                            disabled={saving}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="primary"
                            className="cb-dialog-btn"
                            onClick={handleSubmit}
                            loading={saving}
                            disabled={!canSubmit}
                        >
                            Save
                        </Button>
                    </>
                }
            >
                <label htmlFor="sp-label" style={fieldLabel}>
                    Label (e.g. German, Swedish)
                </label>
                <input
                    id="sp-label"
                    disabled={detailsLoading}
                    className="dr-input"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    autoFocus
                />

                <label htmlFor="sp-wss" style={{ ...fieldLabel, marginTop: 16 }}>
                    WSS URL
                </label>
                <input
                    id="sp-wss"
                    disabled={detailsLoading}
                    className="dr-input"
                    value={wssUrl}
                    onChange={(e) => setWssUrl(e.target.value)}
                    placeholder="wss://…"
                />

                <label htmlFor="sp-uri" style={{ ...fieldLabel, marginTop: 16 }}>
                    SIP URI
                </label>
                <input
                    id="sp-uri"
                    disabled={detailsLoading}
                    className="dr-input"
                    value={uri}
                    onChange={(e) => setUri(e.target.value)}
                    placeholder="sip:12345@sipgate.de"
                />

                <label htmlFor="sp-user" style={{ ...fieldLabel, marginTop: 16 }}>
                    Username (optional)
                </label>
                <input
                    id="sp-user"
                    disabled={detailsLoading}
                    className="dr-input"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                />

                <label htmlFor="sp-pass" style={{ ...fieldLabel, marginTop: 16 }}>
                    Password{editing ? " (leave blank to keep)" : ""}
                </label>
                <input
                    id="sp-pass"
                    disabled={detailsLoading}
                    type="password"
                    className="dr-input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    placeholder={editing && hasPassword ? "•••••••• (saved)" : undefined}
                />

                <label htmlFor="sp-display" style={{ ...fieldLabel, marginTop: 16 }}>
                    Display name (optional)
                </label>
                <input
                    id="sp-display"
                    disabled={detailsLoading}
                    className="dr-input"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                />

                {draftTest?.status === "done" && draftTest.testedAt >= openedAt && (
                    <div
                        role="status"
                        style={{
                            marginTop: 16,
                            padding: "8px 12px",
                            borderRadius: 8,
                            fontSize: 13,
                            background: draftTest.result.ok ? T.GREEN_LIGHT : T.RED_SOFT,
                            color: draftTest.result.ok ? T.GREEN : T.RED,
                            border: `1px solid ${draftTest.result.ok ? T.GREEN_MID : T.RED_MID}`,
                        }}
                    >
                        {draftTest.result.message}
                        {draftTest.result.ok && draftTest.result.latencyMs != null
                            ? ` (${draftTest.result.latencyMs} ms)`
                            : ""}
                    </div>
                )}

                <label
                    style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16, fontSize: 13, color: T.TEXT }}
                >
                    <input
                        type="checkbox"
                        checked={isDefault}
                        disabled={detailsLoading}
                        onChange={(e) => setIsDefault(e.target.checked)}
                    />
                    Default line
                </label>
            </Modal>

            <ConfirmDialog
                open={deleteTarget !== null}
                zIndex={NESTED_MODAL_Z_INDEX}
                title="Remove phone line"
                message={`Remove "${deleteTarget?.label ?? ""}"? Calls will no longer use this line.`}
                confirmLabel="Remove"
                cancelLabel="Cancel"
                danger
                confirmLoading={deletingId !== null}
                onConfirm={() => void handleDelete()}
                onCancel={() => setDeleteTarget(null)}
            />
        </div>
    );
}


/** Last health-check outcome for a line, or "Not tested" before the first run. */
function ConnectionBadge({ state }: { state?: LineTestState }) {
    if (!state) {
        return (
            <span className="text-xs" style={{ color: T.TEXT_HINT }}>
                Not tested
            </span>
        );
    }
    if (state.status === "testing") {
        return (
            <span className="text-xs" style={{ color: T.TEXT_MUTED }}>
                Testing…
            </span>
        );
    }
    const { result } = state;
    return (
        <span title={result.message} className="flex min-w-0 flex-col items-start gap-0.5">
            <Badge variant={result.ok ? "green" : "red"}>
                {result.ok ? "Connected" : "Failed"}
            </Badge>
            {!result.ok && (
                <span className="w-full truncate text-xs" style={{ color: T.TEXT_MUTED }}>
                    {result.message}
                </span>
            )}
        </span>
    );
}
