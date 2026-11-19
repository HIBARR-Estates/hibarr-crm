import React, { useEffect, useState } from "react";
import { Deferred, usePage } from "@inertiajs/react";
import { App } from "antd";
import DashboardLayout from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import Button from "@/Components/Redesign/primitives/Button";
import ChipToggle from "@/Components/Redesign/primitives/ChipToggle";
import ConfirmDialog from "@/Components/Redesign/primitives/ConfirmDialog";
import EmptyState from "@/Components/Redesign/primitives/EmptyState";
import Icon from "@/Components/Redesign/primitives/Icon";
import { Modal, ModalField } from "@/Components/Redesign/primitives/Modal";
import Switch from "@/Components/Redesign/primitives/Switch";
import ToggleField from "@/Components/Redesign/primitives/ToggleField";
import {
    REDESIGN_FONT_STACK,
    REDESIGN_TOKENS as T,
    REDESIGN_TYPE,
} from "@/Components/Redesign/tokens";
import "@/Components/Redesign/redesign.css";
import useTranslation from "@/Hooks/useTranslation";
import useCalendlyLinkMutations, {
    calendlyErrorMessage,
    type CalendlyLinkInput,
    type CalendlyLinkSetting,
} from "./hooks/useCalendlyLinkMutations";

interface ConfigData {
    links: CalendlyLinkSetting[];
    roles: Array<{ id: number; name: string }>;
}

/** Same rule the server applies: a secure link on calendly.com. */
const CALENDLY_URL = /^https:\/\/([a-z0-9-]+\.)*calendly\.com(\/|\?|#|$)/i;

const ROW_GRID =
    "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 px-3.5 py-3 border-b last:border-b-0";

/** `https://calendly.com/team/intro?x=1` → `calendly.com/team/intro` */
const shortUrl = (url: string) =>
    url.replace(/^https?:\/\//i, "").replace(/[?#].*$/, "");

export default function CalendlyMeetingLinks({
    pageTitle,
}: {
    pageTitle: string;
}) {
    const { t } = useTranslation();
    const { message } = App.useApp();
    const config = (usePage().props as { config?: ConfigData }).config;
    const mutations = useCalendlyLinkMutations();

    // The page's own copy of what the server sent: edits patch it directly
    // rather than reloading the page.
    const [links, setLinks] = useState<CalendlyLinkSetting[]>([]);
    const [editing, setEditing] = useState<CalendlyLinkSetting | "new" | null>(
        null,
    );
    const [deleteTarget, setDeleteTarget] =
        useState<CalendlyLinkSetting | null>(null);

    useEffect(() => {
        if (config) setLinks(config.links);
    }, [config]);

    const roles = config?.roles ?? [];
    const roleName = (id: number) =>
        roles.find((role) => role.id === id)?.name ?? `#${id}`;

    const fail = (error: unknown) =>
        message.error(
            calendlyErrorMessage(
                error,
                t("pages.meetings.calendly_settings.save_failed"),
            ),
        );

    const handleSave = async (input: CalendlyLinkInput) => {
        try {
            if (editing && editing !== "new") {
                const saved = await mutations.updateLink(editing.id, input);
                setLinks((current) =>
                    current.map((link) => (link.id === saved.id ? saved : link)),
                );
            } else {
                const saved = await mutations.createLink(input);
                setLinks((current) => [...current, saved]);
            }
            message.success(t("pages.meetings.calendly_settings.saved"));
            setEditing(null);
        } catch (error) {
            fail(error);
        }
    };

    const handleToggle = async (link: CalendlyLinkSetting) => {
        try {
            const saved = await mutations.setActive(link, !link.is_active);
            setLinks((current) =>
                current.map((item) => (item.id === saved.id ? saved : item)),
            );
        } catch (error) {
            fail(error);
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        try {
            await mutations.deleteLink(deleteTarget.id);
            setLinks((current) =>
                current.filter((link) => link.id !== deleteTarget.id),
            );
            message.success(t("pages.meetings.calendly_settings.deleted"));
            setDeleteTarget(null);
        } catch (error) {
            fail(error);
        }
    };

    return (
        <PageLayout
            breadcrumbs={[
                {
                    name: t("app.menu.settings"),
                    url: route("settings-overview.index"),
                },
                { name: pageTitle },
            ]}
        >
            <div
                className="mx-auto flex w-full max-w-4xl flex-col"
                style={{
                    padding: "8px 0 32px",
                    fontFamily: REDESIGN_FONT_STACK,
                }}
            >
                <div style={{ marginBottom: 20 }}>
                    <div
                        style={{
                            fontSize: REDESIGN_TYPE.CAPTION,
                            fontWeight: 700,
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                            color: T.TEXT_HINT,
                            marginBottom: 6,
                        }}
                    >
                        {t("app.menu.settings")}
                    </div>
                    <h1
                        style={{
                            margin: 0,
                            fontSize: REDESIGN_TYPE.DISPLAY,
                            fontWeight: 700,
                            color: T.NAVY,
                            letterSpacing: "-0.01em",
                        }}
                    >
                        {t("pages.meetings.calendly_settings.title")}
                    </h1>
                    <p
                        style={{
                            margin: "6px 0 0",
                            fontSize: REDESIGN_TYPE.BODY,
                            color: T.TEXT_MUTED,
                            lineHeight: 1.45,
                            maxWidth: 600,
                        }}
                    >
                        {t("pages.meetings.calendly_settings.description")}
                    </p>
                </div>

                <div
                    style={{
                        background: T.WHITE,
                        border: `1px solid ${T.BORDER}`,
                        borderRadius: 10,
                        padding: "20px 22px 24px",
                    }}
                >
                    <Deferred data="config" fallback={<LinksSkeleton />}>
                        <LinksPanel
                            links={links}
                            roleName={roleName}
                            togglingId={mutations.togglingId}
                            deletingId={mutations.deletingId}
                            onAdd={() => setEditing("new")}
                            onEdit={setEditing}
                            onToggle={handleToggle}
                            onDelete={setDeleteTarget}
                        />
                    </Deferred>
                </div>
            </div>

            {editing !== null && (
                <LinkEditorModal
                    // Mounted fresh for every open, so one dialog's values can
                    // never carry over into the next.
                    key={editing === "new" ? "new" : editing.id}
                    link={editing === "new" ? null : editing}
                    roles={roles}
                    saving={mutations.saving}
                    onSave={handleSave}
                    onClose={() => setEditing(null)}
                />
            )}

            <ConfirmDialog
                open={deleteTarget !== null}
                title={t("app.delete")}
                message={t("pages.meetings.calendly_settings.delete_confirm")}
                confirmLabel={t("messages.confirmDelete")}
                cancelLabel={t("app.cancel")}
                danger
                confirmLoading={mutations.deletingId !== null}
                onConfirm={() => void handleDelete()}
                onCancel={() => setDeleteTarget(null)}
            />
        </PageLayout>
    );
}

function LinksSkeleton() {
    return (
        <div className="animate-pulse" aria-hidden="true">
            {[0, 1, 2].map((i) => (
                <div
                    key={i}
                    style={{
                        height: 52,
                        marginBottom: 8,
                        borderRadius: 8,
                        background: T.SURFACE_2,
                    }}
                />
            ))}
        </div>
    );
}

interface LinksPanelProps {
    links: CalendlyLinkSetting[];
    roleName: (id: number) => string;
    togglingId: number | null;
    deletingId: number | null;
    onAdd: () => void;
    onEdit: (link: CalendlyLinkSetting) => void;
    onToggle: (link: CalendlyLinkSetting) => void;
    onDelete: (link: CalendlyLinkSetting) => void;
}

function LinksPanel({
    links,
    roleName,
    togglingId,
    deletingId,
    onAdd,
    onEdit,
    onToggle,
    onDelete,
}: LinksPanelProps) {
    const { t } = useTranslation();

    if (links.length === 0) {
        return (
            <EmptyState
                icon="calendar"
                title={t("pages.meetings.calendly_settings.empty_title")}
                description={t("pages.meetings.calendly_settings.empty")}
                action={{
                    label: t("pages.meetings.calendly_settings.add_link"),
                    onClick: onAdd,
                }}
            />
        );
    }

    return (
        <div>
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap",
                    marginBottom: 16,
                }}
            >
                <p
                    style={{
                        margin: 0,
                        flex: "1 1 220px",
                        fontSize: REDESIGN_TYPE.BODY,
                        color: T.TEXT_MUTED,
                        lineHeight: 1.45,
                    }}
                >
                    {t("pages.meetings.calendly_settings.links_help")}
                </p>
                <Button
                    variant="primary"
                    size="sm"
                    icon={<Icon name="plus" size={14} />}
                    onClick={onAdd}
                >
                    {t("pages.meetings.calendly_settings.add_link")}
                </Button>
            </div>

            <div
                className="overflow-hidden rounded-[10px] border"
                style={{ borderColor: T.BORDER }}
            >
                {links.map((link) => (
                    <div
                        key={link.id}
                        className={ROW_GRID}
                        style={{
                            borderColor: T.BORDER_SOFT,
                            background: T.SURFACE,
                            opacity: link.is_active ? 1 : 0.7,
                        }}
                    >
                        <div className="min-w-0">
                            <div
                                className="truncate text-sm font-semibold"
                                style={{ color: T.TEXT }}
                                title={link.name}
                            >
                                {link.name}
                            </div>
                            {link.description && (
                                <div
                                    className="truncate"
                                    style={{
                                        fontSize: REDESIGN_TYPE.CAPTION,
                                        color: T.TEXT_MUTED,
                                    }}
                                >
                                    {link.description}
                                </div>
                            )}
                            <div
                                className="mt-1 flex flex-wrap items-center gap-1.5"
                                style={{ fontSize: REDESIGN_TYPE.CAPTION }}
                            >
                                <span
                                    className="truncate"
                                    style={{ color: T.TEXT_HINT, maxWidth: 280 }}
                                    title={link.url}
                                >
                                    {shortUrl(link.url)}
                                </span>
                                <span aria-hidden="true" style={{ color: T.BORDER }}>
                                    ·
                                </span>
                                {link.role_ids.length === 0 ? (
                                    <RoleChip>
                                        {t("pages.meetings.calendly_settings.everyone")}
                                    </RoleChip>
                                ) : (
                                    link.role_ids.map((id) => (
                                        <RoleChip key={id}>{roleName(id)}</RoleChip>
                                    ))
                                )}
                            </div>
                        </div>

                        <span className="flex items-center justify-end gap-1">
                            <Switch
                                checked={link.is_active}
                                loading={togglingId === link.id}
                                onChange={() => onToggle(link)}
                                aria-label={t(
                                    "pages.meetings.calendly_settings.active_label",
                                )}
                            />
                            <Button
                                variant="ghost"
                                size="sm"
                                icon={<Icon name="edit" size={14} />}
                                aria-label={t("app.edit")}
                                onClick={() => onEdit(link)}
                            />
                            <Button
                                variant="ghost"
                                size="sm"
                                icon={<Icon name="trash" size={14} />}
                                aria-label={t("app.delete")}
                                loading={deletingId === link.id}
                                onClick={() => onDelete(link)}
                                style={{ color: T.RED }}
                            />
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

function RoleChip({ children }: { children: React.ReactNode }) {
    return (
        <span
            style={{
                background: T.GRAY_MID,
                color: T.TEXT_MUTED,
                borderRadius: 999,
                padding: "1px 8px",
                fontWeight: 600,
            }}
        >
            {children}
        </span>
    );
}

interface LinkEditorModalProps {
    /** The link being edited, or null when adding a new one. */
    link: CalendlyLinkSetting | null;
    roles: Array<{ id: number; name: string }>;
    saving: boolean;
    onSave: (input: CalendlyLinkInput) => void | Promise<void>;
    onClose: () => void;
}

function LinkEditorModal({
    link,
    roles,
    saving,
    onSave,
    onClose,
}: LinkEditorModalProps) {
    const { t } = useTranslation();
    const [name, setName] = useState(link?.name ?? "");
    const [url, setUrl] = useState(link?.url ?? "");
    const [description, setDescription] = useState(link?.description ?? "");
    const [roleIds, setRoleIds] = useState<number[]>(link?.role_ids ?? []);
    const [isActive, setIsActive] = useState(link?.is_active ?? true);
    // Shown only once the person has tried to save, so the form opens calm.
    const [tried, setTried] = useState(false);

    const nameError = name.trim() === "";
    const urlTrimmed = url.trim();
    const urlError =
        urlTrimmed === ""
            ? t("pages.meetings.calendly_settings.url_required")
            : CALENDLY_URL.test(urlTrimmed)
              ? null
              : t("pages.meetings.calendly_settings.url_invalid");

    const toggleRole = (id: number) =>
        setRoleIds((current) =>
            current.includes(id)
                ? current.filter((roleId) => roleId !== id)
                : [...current, id],
        );

    const submit = () => {
        setTried(true);
        if (nameError || urlError) return;
        void onSave({
            name: name.trim(),
            description: description.trim() || null,
            url: urlTrimmed,
            role_ids: roleIds,
            is_active: isActive,
        });
    };

    const errorStyle = {
        margin: "6px 0 0",
        fontSize: REDESIGN_TYPE.CAPTION,
        color: T.RED,
    } as const;
    const helpStyle = {
        margin: "6px 0 0",
        fontSize: REDESIGN_TYPE.CAPTION,
        color: T.TEXT_MUTED,
        lineHeight: 1.4,
    } as const;

    return (
        <Modal
            open
            title={
                link === null
                    ? t("pages.meetings.calendly_settings.add_link")
                    : t("pages.meetings.calendly_settings.edit_link")
            }
            onClose={onClose}
            dirty={name.trim() !== "" || urlTrimmed !== ""}
            maxWidth={520}
            footer={
                <>
                    <Button variant="ghost" onClick={onClose} disabled={saving}>
                        {t("app.cancel")}
                    </Button>
                    <Button variant="primary" onClick={submit} loading={saving}>
                        {t("app.save")}
                    </Button>
                </>
            }
        >
            <ModalField label={t("pages.meetings.calendly_settings.name_label")}>
                <input
                    className="dr-input"
                    value={name}
                    maxLength={120}
                    autoFocus
                    onChange={(event) => setName(event.target.value)}
                    placeholder={t(
                        "pages.meetings.calendly_settings.name_placeholder",
                    )}
                />
                {tried && nameError ? (
                    <p role="alert" style={errorStyle}>
                        {t("pages.meetings.calendly_settings.name_required")}
                    </p>
                ) : (
                    <p style={helpStyle}>
                        {t("pages.meetings.calendly_settings.name_help")}
                    </p>
                )}
            </ModalField>

            <ModalField label={t("pages.meetings.calendly_settings.url_label")}>
                <input
                    className="dr-input"
                    value={url}
                    maxLength={500}
                    inputMode="url"
                    onChange={(event) => setUrl(event.target.value)}
                    placeholder="https://calendly.com/your-team/intro-call"
                />
                {tried && urlError ? (
                    <p role="alert" style={errorStyle}>
                        {urlError}
                    </p>
                ) : (
                    <p style={helpStyle}>
                        {t("pages.meetings.calendly_settings.url_help")}
                    </p>
                )}
            </ModalField>

            <ModalField
                label={t("pages.meetings.calendly_settings.description_label")}
            >
                <input
                    className="dr-input"
                    value={description}
                    maxLength={255}
                    onChange={(event) => setDescription(event.target.value)}
                />
                <p style={helpStyle}>
                    {t("pages.meetings.calendly_settings.description_help")}
                </p>
            </ModalField>

            <ModalField label={t("pages.meetings.calendly_settings.roles_label")}>
                <div className="flex flex-wrap gap-1.5">
                    <ChipToggle
                        shape="pill"
                        active={roleIds.length === 0}
                        onClick={() => setRoleIds([])}
                    >
                        {t("pages.meetings.calendly_settings.everyone")}
                    </ChipToggle>
                    {roles.map((role) => (
                        <ChipToggle
                            key={role.id}
                            shape="pill"
                            active={roleIds.includes(role.id)}
                            onClick={() => toggleRole(role.id)}
                        >
                            {role.name}
                        </ChipToggle>
                    ))}
                </div>
                <p style={helpStyle}>
                    {t("pages.meetings.calendly_settings.roles_help")}
                </p>
            </ModalField>

            <ToggleField
                checked={isActive}
                onChange={() => setIsActive((current) => !current)}
                title={t("pages.meetings.calendly_settings.active_label")}
                description={t("pages.meetings.calendly_settings.active_help")}
            />
        </Modal>
    );
}

CalendlyMeetingLinks.layout = (page: React.ReactNode) => (
    <DashboardLayout>{page}</DashboardLayout>
);
