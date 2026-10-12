import { useEffect, useMemo, useState } from "react";
import { Button, Modal, ModalField } from "@/Components/Redesign";
import useTranslation from "@/Hooks/useTranslation";
import useEmailConnections, {
    type ConnectMailboxInput,
    type EmailConnectionDetail,
} from "@/Email/hooks/useEmailConnections";

export interface ConnectMailboxModalProps {
    open: boolean;
    onClose: () => void;
    /** Fired after a connect/resume leaves at least one active mailbox. */
    onConnected?: () => void;
}

type ConnectFormState = {
    provider: string;
    identity_email: string;
    from_email: string;
    reply_to_email: string;
    sandbox: string;
    inbox_id: string;
    smtp_username: string;
    smtp_password: string;
};

const emptyForm = (provider = ""): ConnectFormState => ({
    provider,
    identity_email: "",
    from_email: "",
    reply_to_email: "",
    sandbox: "",
    inbox_id: "",
    smtp_username: "",
    smtp_password: "",
});

function statusTone(status: string): string {
    switch (status) {
        case "active":
            return "text-dr-green";
        case "stopped":
            return "text-dr-text-muted";
        case "needs_reconnect":
        case "error":
            return "text-dr-red";
        default:
            return "text-dr-text-muted";
    }
}

/**
 * Mailbox connection settings: Mailtrap connect (dev/staging), status,
 * stop / resume / reconnect, and waiting-to-send guidance.
 */
export default function ConnectMailboxModal({
    open,
    onClose,
    onConnected,
}: ConnectMailboxModalProps) {
    const { t } = useTranslation();
    const {
        connections,
        providers,
        loading,
        busyId,
        errorCode,
        clearError,
        connect,
        stop,
        resume,
        reconnect,
        disconnect,
    } = useEmailConnections({ open });

    const defaultProvider = providers[0]?.id ?? "";
    const [form, setForm] = useState<ConnectFormState>(emptyForm());
    const [reconnectId, setReconnectId] = useState<string | null>(null);
    const [reconnectSecrets, setReconnectSecrets] = useState({
        sandbox: "",
        inbox_id: "",
        smtp_username: "",
        smtp_password: "",
    });

    useEffect(() => {
        if (!open) return;
        clearError();
        setReconnectId(null);
        setForm(emptyForm(defaultProvider));
    }, [open, defaultProvider, clearError]);

    const selectedProvider = useMemo(
        () => providers.find((row) => row.id === form.provider) ?? providers[0],
        [providers, form.provider],
    );

    const isMailtrap = selectedProvider?.id === "mailtrap";
    const isOAuth = selectedProvider?.oauth === true;
    const busy = busyId != null;

    const startZoho = () => {
        const path = selectedProvider?.authorize_path;
        if (!path) return;
        const back = `${window.location.pathname}${window.location.search}`;
        window.location.assign(
            `${path}?return=${encodeURIComponent(back)}`,
        );
    };

    const errorMessage = errorCode
        ? t(`pages.email.connect.errors.${errorCode}`, {
              defaultValue: t("pages.email.connect.errors.generic"),
          })
        : null;

    const updateForm = (patch: Partial<ConnectFormState>) => {
        setForm((prev) => ({ ...prev, ...patch }));
    };

    const handleConnect = async () => {
        if (!selectedProvider) return;

        const payload: ConnectMailboxInput = {
            provider: selectedProvider.id,
            identity_email: form.identity_email.trim(),
        };
        if (form.from_email.trim()) {
            payload.from_email = form.from_email.trim();
        }
        if (form.reply_to_email.trim()) {
            payload.reply_to_email = form.reply_to_email.trim();
        }
        if (isMailtrap) {
            if (form.sandbox) payload.sandbox = form.sandbox;
            if (form.inbox_id.trim()) payload.inbox_id = form.inbox_id.trim();
            payload.smtp_username = form.smtp_username.trim();
            payload.smtp_password = form.smtp_password;
        }

        const created = await connect(payload);
        if (!created) return;

        setForm(emptyForm(selectedProvider.id));
        if (created.status === "active") {
            onConnected?.();
        }
    };

    const handleReconnect = async (connection: EmailConnectionDetail) => {
        const updated = await reconnect(connection.id, {
            sandbox: reconnectSecrets.sandbox || undefined,
            inbox_id: reconnectSecrets.inbox_id.trim() || undefined,
            smtp_username: reconnectSecrets.smtp_username.trim() || undefined,
            smtp_password: reconnectSecrets.smtp_password || undefined,
        });
        if (!updated) return;
        setReconnectId(null);
        setReconnectSecrets({
            sandbox: "",
            inbox_id: "",
            smtp_username: "",
            smtp_password: "",
        });
        if (updated.status === "active") {
            onConnected?.();
        }
    };

    const handleStop = async (connection: EmailConnectionDetail) => {
        await stop(connection.id);
    };

    const handleResume = async (connection: EmailConnectionDetail) => {
        const updated = await resume(connection.id);
        if (updated?.status === "active") {
            onConnected?.();
        }
    };

    const handleDisconnect = async (connection: EmailConnectionDetail) => {
        await disconnect(connection.id);
    };

    const statusLabel = (status: string) =>
        t(`pages.email.connect.status.${status}`, {
            defaultValue: status,
        });

    return (
        <Modal
            open={open}
            title={t("pages.email.connect.title")}
            onClose={onClose}
            closeAriaLabel={t("pages.email.connect.close")}
            closeOnBackdrop={!busy}
            maxWidth={640}
            footer={
                <Button
                    type="button"
                    variant="ghost"
                    onClick={onClose}
                    disabled={busy}
                >
                    {t("pages.email.connect.close")}
                </Button>
            }
        >
            <div className="flex flex-col gap-4">
                <p className="m-0 text-sm leading-relaxed text-dr-text-muted">
                    {t("pages.email.connect.body")}
                </p>
                <p className="m-0 text-sm leading-relaxed text-dr-text-muted">
                    {t("pages.email.connect.waiting_to_send_hint")}
                </p>

                {errorMessage ? (
                    <p className="m-0 text-sm text-dr-red" role="alert">
                        {errorMessage}
                    </p>
                ) : null}

                {loading ? (
                    <p className="m-0 text-sm text-dr-text-muted">
                        {t("pages.email.connect.loading")}
                    </p>
                ) : null}

                {!loading && connections.length > 0 ? (
                    <section aria-label={t("pages.email.connect.your_mailboxes")}>
                        <h3 className="mb-2 mt-0 text-sm font-semibold text-dr-text">
                            {t("pages.email.connect.your_mailboxes")}
                        </h3>
                        <ul className="m-0 list-none space-y-3 p-0">
                            {connections.map((connection) => {
                                const rowBusy = busyId === connection.id;
                                const reconnecting =
                                    reconnectId === connection.id;

                                return (
                                    <li
                                        key={connection.id}
                                        className="rounded border border-dr-border px-3 py-3"
                                        data-connection-id={connection.id}
                                        data-connection-status={
                                            connection.status
                                        }
                                    >
                                        <div className="flex flex-wrap items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <div className="truncate text-sm font-medium text-dr-text">
                                                    {connection.identity_email}
                                                </div>
                                                <div className="text-xs text-dr-text-muted">
                                                    {connection.from_email}
                                                    {connection.provider
                                                        ? ` · ${connection.provider}`
                                                        : ""}
                                                </div>
                                                <div
                                                    className={`mt-1 text-xs font-medium ${statusTone(connection.status)}`}
                                                >
                                                    {statusLabel(
                                                        connection.status,
                                                    )}
                                                    {connection.last_error_code
                                                        ? ` · ${connection.last_error_code}`
                                                        : ""}
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {connection.status ===
                                                "active" ? (
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        disabled={rowBusy}
                                                        loading={rowBusy}
                                                        onClick={() =>
                                                            void handleStop(
                                                                connection,
                                                            )
                                                        }
                                                        data-action="stop"
                                                    >
                                                        {t(
                                                            "pages.email.connect.stop",
                                                        )}
                                                    </Button>
                                                ) : null}
                                                {connection.status ===
                                                "stopped" ? (
                                                    <Button
                                                        type="button"
                                                        variant="primary"
                                                        size="sm"
                                                        disabled={rowBusy}
                                                        loading={rowBusy}
                                                        onClick={() =>
                                                            void handleResume(
                                                                connection,
                                                            )
                                                        }
                                                        data-action="resume"
                                                    >
                                                        {t(
                                                            "pages.email.connect.resume",
                                                        )}
                                                    </Button>
                                                ) : null}
                                                {connection.status ===
                                                    "needs_reconnect" ||
                                                connection.status ===
                                                    "error" ? (
                                                    <Button
                                                        type="button"
                                                        variant="primary"
                                                        size="sm"
                                                        disabled={rowBusy}
                                                        onClick={() => {
                                                            if (
                                                                connection.provider ===
                                                                "zoho"
                                                            ) {
                                                                const zoho =
                                                                    providers.find(
                                                                        (row) =>
                                                                            row.oauth,
                                                                    );
                                                                if (
                                                                    zoho?.authorize_path
                                                                ) {
                                                                    const back = `${window.location.pathname}${window.location.search}`;
                                                                    window.location.assign(
                                                                        `${zoho.authorize_path}?return=${encodeURIComponent(back)}`,
                                                                    );
                                                                }
                                                                return;
                                                            }
                                                            setReconnectId(
                                                                connection.id,
                                                            );
                                                        }}
                                                        data-action="reconnect"
                                                    >
                                                        {t(
                                                            "pages.email.connect.reconnect",
                                                        )}
                                                    </Button>
                                                ) : null}
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    disabled={rowBusy}
                                                    onClick={() =>
                                                        void handleDisconnect(
                                                            connection,
                                                        )
                                                    }
                                                    data-action="disconnect"
                                                >
                                                    {t(
                                                        "pages.email.connect.disconnect",
                                                    )}
                                                </Button>
                                            </div>
                                        </div>

                                        {connection.status === "stopped" ? (
                                            <p className="mb-0 mt-2 text-xs text-dr-text-muted">
                                                {t(
                                                    "pages.email.connect.stopped_hint",
                                                )}
                                            </p>
                                        ) : null}

                                        {reconnecting ? (
                                            <div className="mt-3 space-y-2 border-t border-dr-border pt-3">
                                                {connection.provider ===
                                                "mailtrap" ? (
                                                    <>
                                                        <ModalField
                                                            label={t(
                                                                "pages.email.connect.smtp_username",
                                                            )}
                                                        >
                                                            <input
                                                                className="dr-input w-full"
                                                                value={
                                                                    reconnectSecrets.smtp_username
                                                                }
                                                                onChange={(
                                                                    event,
                                                                ) =>
                                                                    setReconnectSecrets(
                                                                        (
                                                                            prev,
                                                                        ) => ({
                                                                            ...prev,
                                                                            smtp_username:
                                                                                event
                                                                                    .target
                                                                                    .value,
                                                                        }),
                                                                    )
                                                                }
                                                                autoComplete="off"
                                                            />
                                                        </ModalField>
                                                        <ModalField
                                                            label={t(
                                                                "pages.email.connect.smtp_password",
                                                            )}
                                                        >
                                                            <input
                                                                className="dr-input w-full"
                                                                type="password"
                                                                value={
                                                                    reconnectSecrets.smtp_password
                                                                }
                                                                onChange={(
                                                                    event,
                                                                ) =>
                                                                    setReconnectSecrets(
                                                                        (
                                                                            prev,
                                                                        ) => ({
                                                                            ...prev,
                                                                            smtp_password:
                                                                                event
                                                                                    .target
                                                                                    .value,
                                                                        }),
                                                                    )
                                                                }
                                                                autoComplete="new-password"
                                                            />
                                                        </ModalField>
                                                        <ModalField
                                                            label={t(
                                                                "pages.email.connect.inbox_id",
                                                            )}
                                                        >
                                                            <input
                                                                className="dr-input w-full"
                                                                value={
                                                                    reconnectSecrets.inbox_id
                                                                }
                                                                onChange={(
                                                                    event,
                                                                ) =>
                                                                    setReconnectSecrets(
                                                                        (
                                                                            prev,
                                                                        ) => ({
                                                                            ...prev,
                                                                            inbox_id:
                                                                                event
                                                                                    .target
                                                                                    .value,
                                                                        }),
                                                                    )
                                                                }
                                                                autoComplete="off"
                                                            />
                                                        </ModalField>
                                                    </>
                                                ) : (
                                                    <p className="m-0 text-xs text-dr-text-muted">
                                                        {t(
                                                            "pages.email.connect.reconnect_no_secrets",
                                                        )}
                                                    </p>
                                                )}
                                                <div className="flex gap-2">
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        disabled={rowBusy}
                                                        onClick={() =>
                                                            setReconnectId(null)
                                                        }
                                                    >
                                                        {t(
                                                            "pages.email.connect.cancel",
                                                        )}
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        variant="primary"
                                                        size="sm"
                                                        disabled={rowBusy}
                                                        loading={rowBusy}
                                                        onClick={() =>
                                                            void handleReconnect(
                                                                connection,
                                                            )
                                                        }
                                                    >
                                                        {t(
                                                            "pages.email.connect.save_reconnect",
                                                        )}
                                                    </Button>
                                                </div>
                                            </div>
                                        ) : null}
                                    </li>
                                );
                            })}
                        </ul>
                    </section>
                ) : null}

                {!loading && providers.length === 0 ? (
                    <p className="m-0 text-sm text-dr-text-muted">
                        {t("pages.email.connect.no_providers")}
                    </p>
                ) : null}

                {!loading && providers.length > 0 ? (
                    <section aria-label={t("pages.email.connect.connect_new")}>
                        <h3 className="mb-2 mt-0 text-sm font-semibold text-dr-text">
                            {t("pages.email.connect.connect_new")}
                        </h3>

                        {providers.length > 1 ? (
                            <ModalField
                                label={t("pages.email.connect.provider")}
                            >
                                <select
                                    className="dr-input w-full"
                                    value={form.provider || defaultProvider}
                                    disabled={busy}
                                    onChange={(event) =>
                                        updateForm({
                                            provider: event.target.value,
                                        })
                                    }
                                >
                                    {providers.map((provider) => (
                                        <option
                                            key={provider.id}
                                            value={provider.id}
                                        >
                                            {provider.label}
                                        </option>
                                    ))}
                                </select>
                            </ModalField>
                        ) : null}

                        {isOAuth ? (
                            <div className="flex flex-col gap-3">
                                <p className="m-0 text-sm leading-relaxed text-dr-text-muted">
                                    {t("pages.email.connect.zoho_hint")}
                                </p>
                                <div>
                                    <Button
                                        type="button"
                                        variant="primary"
                                        disabled={busy}
                                        onClick={startZoho}
                                        data-action="connect-zoho"
                                    >
                                        {t("pages.email.connect.zoho_submit")}
                                    </Button>
                                </div>
                            </div>
                        ) : null}

                        {!isOAuth ? (
                        <>
                        <ModalField
                            label={t("pages.email.connect.identity_email")}
                        >
                            <input
                                className="dr-input w-full"
                                type="email"
                                value={form.identity_email}
                                disabled={busy}
                                onChange={(event) =>
                                    updateForm({
                                        identity_email: event.target.value,
                                    })
                                }
                                autoComplete="email"
                            />
                        </ModalField>

                        <ModalField label={t("pages.email.connect.from_email")}>
                            <input
                                className="dr-input w-full"
                                type="email"
                                value={form.from_email}
                                disabled={busy}
                                placeholder={t(
                                    "pages.email.connect.from_email_placeholder",
                                )}
                                onChange={(event) =>
                                    updateForm({
                                        from_email: event.target.value,
                                    })
                                }
                                autoComplete="off"
                            />
                        </ModalField>

                        <ModalField
                            label={t("pages.email.connect.reply_to_email")}
                        >
                            <input
                                className="dr-input w-full"
                                type="email"
                                value={form.reply_to_email}
                                disabled={busy}
                                placeholder={t(
                                    "pages.email.connect.optional",
                                )}
                                onChange={(event) =>
                                    updateForm({
                                        reply_to_email: event.target.value,
                                    })
                                }
                                autoComplete="off"
                            />
                        </ModalField>

                        {isMailtrap ? (
                            <>
                                {(selectedProvider?.sandboxes?.length ?? 0) >
                                0 ? (
                                    <ModalField
                                        label={t(
                                            "pages.email.connect.sandbox",
                                        )}
                                    >
                                        <select
                                            className="dr-input w-full"
                                            value={form.sandbox}
                                            disabled={busy}
                                            onChange={(event) =>
                                                updateForm({
                                                    sandbox: event.target.value,
                                                })
                                            }
                                        >
                                            <option value="">
                                                {t(
                                                    "pages.email.connect.sandbox_custom",
                                                )}
                                            </option>
                                            {selectedProvider?.sandboxes?.map(
                                                (name) => (
                                                    <option
                                                        key={name}
                                                        value={name}
                                                    >
                                                        {name}
                                                    </option>
                                                ),
                                            )}
                                        </select>
                                    </ModalField>
                                ) : null}
                                {!form.sandbox ? (
                                    <ModalField
                                        label={t(
                                            "pages.email.connect.inbox_id",
                                        )}
                                    >
                                        <input
                                            className="dr-input w-full"
                                            value={form.inbox_id}
                                            disabled={busy}
                                            onChange={(event) =>
                                                updateForm({
                                                    inbox_id:
                                                        event.target.value,
                                                })
                                            }
                                            autoComplete="off"
                                        />
                                    </ModalField>
                                ) : null}
                                <ModalField
                                    label={t(
                                        "pages.email.connect.smtp_username",
                                    )}
                                >
                                    <input
                                        className="dr-input w-full"
                                        value={form.smtp_username}
                                        disabled={busy}
                                        onChange={(event) =>
                                            updateForm({
                                                smtp_username:
                                                    event.target.value,
                                            })
                                        }
                                        autoComplete="off"
                                    />
                                </ModalField>
                                <ModalField
                                    label={t(
                                        "pages.email.connect.smtp_password",
                                    )}
                                >
                                    <input
                                        className="dr-input w-full"
                                        type="password"
                                        value={form.smtp_password}
                                        disabled={busy}
                                        onChange={(event) =>
                                            updateForm({
                                                smtp_password:
                                                    event.target.value,
                                            })
                                        }
                                        autoComplete="new-password"
                                    />
                                </ModalField>
                            </>
                        ) : null}
                        </>
                        ) : null}

                        {!isOAuth ? (
                        <div className="mt-2">
                            <Button
                                type="button"
                                variant="primary"
                                disabled={
                                    busy ||
                                    !form.identity_email.trim() ||
                                    (isMailtrap &&
                                        (!form.smtp_username.trim() ||
                                            !form.smtp_password ||
                                            (!form.sandbox &&
                                                !form.inbox_id.trim())))
                                }
                                loading={busyId === "create"}
                                onClick={() => void handleConnect()}
                                data-action="connect"
                            >
                                {t("pages.email.connect.submit")}
                            </Button>
                        </div>
                        ) : null}
                    </section>
                ) : null}
            </div>
        </Modal>
    );
}
