import React, { useState } from "react";
import axios from "axios";
import { DeleteOutlined, EditOutlined, PlusOutlined, StarFilled, StarOutlined } from "@ant-design/icons";
import { App } from "antd";
import Button from "@/Components/Redesign/primitives/Button";
import ConfirmDialog from "@/Components/Redesign/primitives/ConfirmDialog";
import EmptyState from "@/Components/Redesign/primitives/EmptyState";
import { Modal } from "@/Components/Redesign/primitives/Modal";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import { useApiQuery } from "@/lib/api/client/useApiQuery";
import { useApiMutate } from "@/lib/api/client/useApiMutate";
import { ApiSuccessResponse } from "@/lib/api/types";
import type { SoftphoneDeviceSummary } from "@/Types/api/softphone";

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
    wss_url: string;
    uri: string;
    authorization_username: string | null;
    authorization_password: string;
    display_name: string | null;
    is_default?: boolean;
}

const ROW_GRID =
    "grid grid-cols-[minmax(0,1fr)_90px_90px] items-center gap-x-3 px-3.5 py-3 border-b border-[#e2e5ea] last:border-b-0";

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
    };

    const closeModal = () => {
        setModalOpen(false);
        resetForm();
    };

    const createMutation = useApiMutate<DevicePayload, string, ApiSuccessResponse<string>>(
        route("telephony.softphone.devices.store"),
        "POST",
        () => {
            refetch();
            closeModal();
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

    const openCreate = () => {
        resetForm();
        setModalOpen(true);
    };

    const openEdit = (device: SoftphoneDeviceSummary) => {
        setEditing(device);
        setLabel(device.label);
        // Secrets aren't returned by the list endpoint — leave blank on edit
        // (blank password means "keep stored").
        setWssUrl("");
        setUri("");
        setUsername("");
        setPassword("");
        setDisplayName("");
        setIsDefault(device.is_default);
        setModalOpen(true);
    };

    const handleSubmit = () => {
        if (!label.trim() || !wssUrl.trim() || !uri.trim()) return;
        if (!editing && !password.trim()) return;

        const payload: DevicePayload = {
            label: label.trim(),
            wss_url: wssUrl.trim(),
            uri: uri.trim(),
            authorization_username: username.trim() || null,
            authorization_password: password,
            display_name: displayName.trim() || null,
            is_default: isDefault,
        };

        if (editing) {
            updateMutation.mutate(payload);
        } else {
            createMutation.mutate(payload);
        }
    };

    const saving = createMutation.isPending || updateMutation.isPending;
    const canSubmit =
        label.trim() && wssUrl.trim() && uri.trim() && (editing || password.trim());

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
                                <span className="flex items-center justify-end gap-1">
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
                        <Button variant="ghost" onClick={closeModal} disabled={saving}>
                            Cancel
                        </Button>
                        <Button
                            variant="primary"
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
                    className="dr-input"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                />

                <label htmlFor="sp-pass" style={{ ...fieldLabel, marginTop: 16 }}>
                    Password{editing ? " (leave blank to keep)" : ""}
                </label>
                <input
                    id="sp-pass"
                    type="password"
                    className="dr-input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                />

                <label htmlFor="sp-display" style={{ ...fieldLabel, marginTop: 16 }}>
                    Display name (optional)
                </label>
                <input
                    id="sp-display"
                    className="dr-input"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                />

                <label
                    style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16, fontSize: 13, color: T.TEXT }}
                >
                    <input
                        type="checkbox"
                        checked={isDefault}
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
