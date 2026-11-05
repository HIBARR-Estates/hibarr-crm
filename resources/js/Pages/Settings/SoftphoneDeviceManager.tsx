import React, { useMemo, useRef, useState, useEffect } from "react";
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
import { Tooltip } from "antd";
import Badge from "@/Components/Redesign/primitives/Badge";
import Button from "@/Components/Redesign/primitives/Button";
import ConfirmDialog from "@/Components/Redesign/primitives/ConfirmDialog";
import EmptyState from "@/Components/Redesign/primitives/EmptyState";
import Switch from "@/Components/Redesign/primitives/Switch";
import { Modal } from "@/Components/Redesign/primitives/Modal";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import { useApiQuery } from "@/lib/api/client/useApiQuery";
import { useApiMutate } from "@/lib/api/client/useApiMutate";
import { refreshSoftphoneDevices } from "@/Hooks/useSoftphone";
import useSoftphoneLineTest, { type LineTestState } from "@/Hooks/useSoftphoneLineTest";
import useTranslation from "@/Hooks/useTranslation";
import { ApiSuccessResponse } from "@/lib/api/types";
import type {
    SoftphoneConfig,
    SoftphoneDeviceDetails,
    SoftphoneDeviceSummary,
} from "@/Types/api/softphone";

import "@/Components/Redesign/redesign.css";

const NESTED_MODAL_Z_INDEX = 1400;

interface DeviceDevicesResponse {
    status: string;
    data: {
        devices: SoftphoneDeviceSummary[];
        /** Platforms this CRM can create lines for (local fallback list). */
        providers?: string[];
    };
}

interface DevicePayload {
    label: string;
    /** SIP platform the line belongs to (e.g. sipgate). Required on create. */
    provider: string;
    authorization_username?: string | null;
    authorization_password: string;
    display_name?: string | null;
    is_default?: boolean;
}

interface ProviderOption {
    value: string;
    label: string;
}

interface ProvidersResponse {
    status: "success" | "fail";
    message?: string | null;
    data?: {
        providers: string[];
    };
}

/** SIP connection defaults for one provider platform. */
interface PlatformDefaults {
    wss: string;
    sipUriFormat: string;
}

interface PlatformResponse {
    status: "success" | "fail";
    message?: string | null;
    data?: PlatformDefaults;
}

const ROW_GRID =
    "grid grid-cols-[minmax(0,1fr)_70px_90px_minmax(0,1.1fr)_110px] items-center gap-x-3 px-3.5 py-3 border-b border-[#e2e5ea] last:border-b-0";

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
    const { t } = useTranslation();
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<SoftphoneDeviceSummary | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<SoftphoneDeviceSummary | null>(null);
    const [deletingId, setDeletingId] = useState<number | null>(null);

    const [label, setLabel] = useState("");
    const [provider, setProvider] = useState<string | undefined>(undefined);
    // Providers returned by the OL-backed integrations API. Null until that
    // request succeeds; the device list's local list is the fallback.
    const [integrationProviders, setIntegrationProviders] = useState<string[] | null>(null);
    const [providerLoading, setProviderLoading] = useState(false);
    // Connection defaults for the selected provider platform. The platform
    // owns the WSS endpoint + SIP URI; the form only submits the platform and
    // credentials, and these defaults are used to build the draft test config.
    const [platformDefaults, setPlatformDefaults] = useState<PlatformDefaults | null>(null);
    const [platformLoading, setPlatformLoading] = useState(false);
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

    // Provider options: OL's list when the integrations API answers, the
    // locally supported list otherwise (the settings form's own endpoint is
    // gated by crm.softphone, not callbridge.integrations), always including
    // the selected/stored platform so an edit can show it.
    const providerOptions = useMemo<ProviderOption[]>(() => {
        const names =
            integrationProviders && integrationProviders.length > 0
                ? integrationProviders
                : (data?.data?.providers ?? []);
        const unique = new Set(names);

        if (provider) {
            unique.add(provider);
        }

        return Array.from(unique).map((name) => ({ value: name, label: name }));
    }, [integrationProviders, data, provider]);

    // Fetch the supported SIP providers from the CallBridge integrations API.
    // Authentication is the normal browser session (the route is in the
    // `api.token.or.session` group), so no key belongs in client code.
    useEffect(() => {
        let cancelled = false;

        const loadProviders = async () => {
            setProviderLoading(true);
            try {
                const response = await axios.get<ProvidersResponse>(
                    route("api.call-bridge.integrations.providers.v1"),
                    { headers: { Accept: "application/json" } },
                );
                if (cancelled) return;

                const providers =
                    response.data?.status === "success"
                        ? (response.data.data?.providers ?? [])
                        : [];

                setIntegrationProviders(providers);
            } catch {
                // Endpoint unavailable / flag off: fall back to the locally
                // supported providers from the device list rather than
                // leaving the required field empty.
                if (!cancelled) setIntegrationProviders(null);
            } finally {
                if (!cancelled) setProviderLoading(false);
            }
        };

        loadProviders();

        return () => {
            cancelled = true;
        };
    }, []);

    // Selecting a platform pulls its connection defaults (`wss` +
    // `sipUriFormat`) from the integrations API. The endpoint and SIP URI are
    // never part of the form: the server resolves them from the platform, and
    // here they let the admin test the draft before saving.
    useEffect(() => {
        if (!provider) {
            setPlatformDefaults(null);
            setPlatformLoading(false);
            return;
        }

        let cancelled = false;
        setPlatformLoading(true);

        axios
            .get<PlatformResponse>(
                route("api.call-bridge.integrations.platform.v1", provider),
                { headers: { Accept: "application/json" } },
            )
            .then((response) => {
                if (cancelled) return;

                const defaults =
                    response.data?.status === "success"
                        ? (response.data.data ?? null)
                        : null;

                setPlatformDefaults(defaults);
            })
            .catch(() => {
                if (!cancelled) setPlatformDefaults(null);
            })
            .finally(() => {
                if (!cancelled) setPlatformLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [provider]);

    const resetForm = () => {
        setEditing(null);
        setLabel("");
        setProvider(undefined);
        setPlatformDefaults(null);
        setPlatformLoading(false);
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
            void refreshSoftphoneDevices();
            closeModal();
            // Health check on the new line's resolved connection so a bad
            // username or password shows up now rather than on the first call.
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
            void refreshSoftphoneDevices();
            closeModal();
        },
    );

    // Disabling a line stops it calling and ringing: the server stops handing
    // out its credentials, and the dock drops it from its line list.
    const [togglingId, setTogglingId] = useState<number | null>(null);
    const handleToggleActive = async (device: SoftphoneDeviceSummary) => {
        const next = device.is_active === false;
        setTogglingId(device.id);
        try {
            await axios.patch(
                route("telephony.softphone.devices.active", device.id),
                { active: next },
                { headers: { Accept: "application/json" } },
            );
            await refetch();
            void refreshSoftphoneDevices();
            message.success(
                next
                    ? t("pages.calls.line_enabled", { line: device.label })
                    : t("pages.calls.line_disabled", { line: device.label }),
            );
        } catch {
            message.error(t("pages.calls.line_toggle_failed"));
        } finally {
            setTogglingId(null);
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        setDeletingId(deleteTarget.id);
        try {
            await axios.delete(
                route("telephony.softphone.devices.destroy", deleteTarget.id),
                { headers: { Accept: "application/json" } },
            );
            await refetch();
            void refreshSoftphoneDevices();
            setDeleteTarget(null);
        } catch {
            message.error("Could not remove the device.");
        } finally {
            setDeletingId(null);
        }
    };

    // The draft's connection comes from the selected platform, never from
    // form fields — the same thing the server resolves on save. Null while the
    // defaults are missing or the platform still needs a username to build
    // its SIP URI, so a half-configured line cannot be "tested".
    const draftConfig = useMemo<SoftphoneConfig | null>(() => {
        if (!platformDefaults) return null;

        const trimmedUsername = username.trim();
        if (platformDefaults.sipUriFormat.includes("{username}") && !trimmedUsername) {
            return null;
        }

        return {
            wss_url: platformDefaults.wss,
            uri: platformDefaults.sipUriFormat.replace("{username}", trimmedUsername),
            authorization_username: trimmedUsername || null,
            authorization_password: password,
            display_name: displayName.trim() || null,
        };
    }, [platformDefaults, username, password, displayName]);

    const draftTestKey = editing ? String(editing.id) : "draft";
    const draftTest = lineTest.states[draftTestKey];
    const canTestDraft =
        !detailsLoading && !!draftConfig && (!!password.trim() || !!editing);

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
                setProvider(details.provider ?? undefined);
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
        // A provider is required: it is what decides the WebSocket endpoint
        // and SIP URI the line registers with. The form never sends those two;
        // the server resolves them from the provider.
        if (!label.trim() || !provider) return;
        if (editing ? detailsLoading : !password.trim()) return;

        // The edit form is prefilled with the stored values, so it sends them
        // all back — which also lets an admin clear the optional fields. A
        // blank password means "keep the stored one" server-side.
        const payload: DevicePayload = {
            label: label.trim(),
            provider,
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
    // A platform whose SIP URI format carries a `{username}` placeholder
    // (sipgate) cannot register without one. On create the username is
    // mandatory; on edit the stored line already has a URI, so clearing the
    // field keeps it. The label then shows as required with a hint.
    const usernameNeeded =
        !!platformDefaults?.sipUriFormat.includes("{username}") &&
        !username.trim() &&
        !editing;
    const canSubmit =
        !detailsLoading &&
        !!label.trim() &&
        !!provider &&
        (editing ? true : !!password.trim());

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
                    <span>{t("pages.calls.line_active")}</span>
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
                                <span className="flex items-center">
                                    <Switch
                                        checked={device.is_active !== false}
                                        loading={togglingId === device.id}
                                        onChange={() => void handleToggleActive(device)}
                                        aria-label={
                                            device.is_active !== false
                                                ? t("pages.calls.line_disable", { line: device.label })
                                                : t("pages.calls.line_enable", { line: device.label })
                                        }
                                    />
                                </span>
                                <span className="min-w-0">
                                    {device.is_active === false ? (
                                        <span className="text-xs" style={{ color: T.TEXT_MUTED }}>
                                            {t("pages.calls.line_disabled_hint")}
                                        </span>
                                    ) : (
                                        <ConnectionBadge state={lineTest.states[String(device.id)]} />
                                    )}
                                </span>
                                <span className="flex items-center justify-end gap-1">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        icon={<ThunderboltOutlined />}
                                        aria-label="Test connection"
                                        title="Test connection"
                                        loading={lineTest.states[String(device.id)]?.status === "testing"}
                                        // A disabled line hands out no credentials, so there is nothing to test.
                                        disabled={device.is_active === false}
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
                            onClick={() => {
                                if (draftConfig) {
                                    void lineTest.testDraft(draftConfig, editing?.id ?? null);
                                }
                            }}
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
                            disabled={!canSubmit || platformLoading}
                        >
                            Save
                        </Button>
                    </>
                }
            >
                <FieldLabel
                    first
                    htmlFor="sp-provider"
                    text={t("pages.call_bridge.softphone_device.provider")}
                    tooltip={t("pages.call_bridge.softphone_device.provider_tooltip")}
                    required
                />
                <select
                    id="sp-provider"
                    className="dr-input"
                    value={provider ?? ""}
                    onChange={(e) => setProvider(e.target.value || undefined)}
                    disabled={detailsLoading || providerLoading}
                >
                    <option value="">
                        {providerLoading
                            ? t("pages.call_bridge.softphone_device.provider_loading")
                            : t("pages.call_bridge.softphone_device.provider_placeholder")}
                    </option>
                    {providerOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>

                <FieldLabel
                    htmlFor="sp-label"
                    text={t("pages.call_bridge.softphone_device.label")}
                    tooltip={t("pages.call_bridge.softphone_device.label_tooltip")}
                    required
                />
                <input
                    id="sp-label"
                    disabled={detailsLoading}
                    className="dr-input"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    autoFocus
                />

                <FieldLabel
                    htmlFor="sp-user"
                    text={t("pages.call_bridge.softphone_device.username")}
                    tooltip={t("pages.call_bridge.softphone_device.username_tooltip")}
                    required={usernameNeeded}
                />
                <input
                    id="sp-user"
                    disabled={detailsLoading}
                    className="dr-input"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    aria-describedby={usernameNeeded ? "sp-user-hint" : undefined}
                />
                {usernameNeeded && (
                    <p
                        id="sp-user-hint"
                        className="text-xs"
                        style={{ marginTop: 4, color: T.TEXT_MUTED }}
                    >
                        {t("pages.call_bridge.softphone_device.username_required")}
                    </p>
                )}

                <FieldLabel
                    htmlFor="sp-pass"
                    text={
                        editing
                            ? t("pages.call_bridge.softphone_device.password_keep")
                            : t("pages.call_bridge.softphone_device.password")
                    }
                    tooltip={t("pages.call_bridge.softphone_device.password_tooltip")}
                    required={!editing}
                />
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

                <FieldLabel
                    htmlFor="sp-display"
                    text={t("pages.call_bridge.softphone_device.display_name")}
                    tooltip={t("pages.call_bridge.softphone_device.display_name_tooltip")}
                />
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
                    {t("pages.call_bridge.softphone_device.default_line")}
                    <Tooltip title={t("pages.call_bridge.softphone_device.default_line_tooltip")}>
                        <i
                            className="antd-icon antd-icon_question_circle"
                            style={{ fontSize: 12, color: T.TEXT_HINT }}
                            aria-hidden="true"
                        />
                    </Tooltip>
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


/**
 * Form label with a help tooltip, an optional required marker ("*") and,
 * through `first`, no top margin for the modal's first field.
 */
function FieldLabel({
    htmlFor,
    text,
    tooltip,
    required = false,
    first = false,
}: {
    htmlFor: string;
    text: string;
    tooltip: string;
    required?: boolean;
    first?: boolean;
}) {
    return (
        <label htmlFor={htmlFor} style={first ? fieldLabel : { ...fieldLabel, marginTop: 16 }}>
            {text}
            {required && (
                <span style={{ color: T.RED, marginLeft: 3 }} aria-hidden="true">
                    *
                </span>
            )}
            <Tooltip title={tooltip}>
                <i
                    className="antd-icon antd-icon_question_circle"
                    style={{ fontSize: 12, marginLeft: 2, color: T.TEXT_HINT }}
                    aria-hidden="true"
                />
            </Tooltip>
        </label>
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
