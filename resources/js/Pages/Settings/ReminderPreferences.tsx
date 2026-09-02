import { useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import axios from "axios";
import { App } from "antd";
import { usePage } from "@inertiajs/react";
import DashboardLayout, { type PageProps } from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import ProductTour, {
    ProductTourHandle,
} from "@/Components/ProductTour/ProductTour";
import Button from "@/Components/Redesign/primitives/Button";
import ConfirmDialog from "@/Components/Redesign/primitives/ConfirmDialog";
import Icon from "@/Components/Redesign/primitives/Icon";
import MenuSelect from "@/Components/Redesign/primitives/MenuSelect";
import Switch from "@/Components/Redesign/primitives/Switch";
import {
    REDESIGN_FONT_STACK,
    REDESIGN_RADIUS,
    REDESIGN_TOKENS as T,
    REDESIGN_TYPE,
} from "@/Components/Redesign/tokens";
import useTranslation from "@/Hooks/useTranslation";
import { useTd } from "@/Hooks/useDynamicTranslation";
import "@/Components/Redesign/redesign.css";
import {
    buildReminderPreferencesTourSteps,
    REMINDER_PREFERENCES_TOUR_ID,
    REMINDER_PREFERENCES_TOUR_LABELS,
} from "./config/reminderPreferencesTourSteps";

const UPDATE_URL = "/account/settings/reminder-preferences";
const RESET_URL = "/account/settings/reminder-preferences/meeting/reset";
const MAX_REMINDERS = 20;

type ReminderType = "minute" | "hour" | "day";

type Reminder = {
    time: number;
    type: ReminderType;
};

type ReminderPreferencesProps = {
    pageTitle: string;
    reminders?: Reminder[];
    isActive?: boolean;
    defaults?: Reminder[];
};

const FALLBACK_DEFAULTS: Reminder[] = [
    { time: 1, type: "hour" },
    { time: 30, type: "minute" },
    { time: 15, type: "minute" },
    { time: 5, type: "minute" },
];

function Section({
    title,
    description,
    extra,
    tourTarget,
    headerTourTarget,
    children,
}: {
    title: string;
    description?: string;
    extra?: ReactNode;
    tourTarget?: string;
    headerTourTarget?: string;
    children: React.ReactNode;
}) {
    return (
        <section
            {...(tourTarget ? { "data-tour": tourTarget } : {})}
            style={{
                background: T.SURFACE,
                border: `1px solid ${T.BORDER}`,
                borderRadius: REDESIGN_RADIUS.MD,
                padding: 20,
                fontFamily: REDESIGN_FONT_STACK,
            }}
        >
            <div
                {...(headerTourTarget
                    ? { "data-tour": headerTourTarget }
                    : {})}
                style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: 12,
                    marginBottom: description ? 4 : 14,
                }}
            >
                <div style={{ minWidth: 0 }}>
                    <div
                        style={{
                            fontSize: REDESIGN_TYPE.CAPTION,
                            fontWeight: 700,
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                            color: T.GRAY_DARKER,
                        }}
                    >
                        {title}
                    </div>
                    {description ? (
                        <p
                            style={{
                                margin: "4px 0 14px",
                                fontSize: REDESIGN_TYPE.BODY,
                                color: T.TEXT_MUTED,
                                lineHeight: 1.45,
                            }}
                        >
                            {description}
                        </p>
                    ) : null}
                </div>
                {extra}
            </div>
            {children}
        </section>
    );
}

function errorMessage(error: unknown, fallback: string): string {
    if (axios.isAxiosError(error)) {
        const data = error.response?.data as
            | { message?: string; errors?: Record<string, string[]> }
            | undefined;
        if (typeof data?.message === "string" && data.message !== "") {
            return data.message;
        }
        const firstError = data?.errors
            ? Object.values(data.errors)[0]?.[0]
            : undefined;
        if (typeof firstError === "string" && firstError !== "") {
            return firstError;
        }
    }
    if (error instanceof Error && error.message !== "") {
        return error.message;
    }
    return fallback;
}

function normalizeReminders(value: Reminder[] | undefined): Reminder[] {
    if (!Array.isArray(value) || value.length === 0) {
        return FALLBACK_DEFAULTS.map((item) => ({ ...item }));
    }
    return value.map((item) => ({
        time: Number.isFinite(item.time) ? item.time : 0,
        type: item.type === "hour" || item.type === "day" ? item.type : "minute",
    }));
}

const inputStyle: CSSProperties = {
    width: 88,
    boxSizing: "border-box",
    fontFamily: "inherit",
    fontSize: REDESIGN_TYPE.BODY,
    color: T.TEXT,
    border: `1px solid ${T.BORDER}`,
    borderRadius: 8,
    padding: "8px 10px",
    outline: "none",
    background: T.WHITE,
};

export default function ReminderPreferences({
    pageTitle,
    reminders: initialReminders,
    isActive: initialActive = true,
    defaults,
}: ReminderPreferencesProps) {
    const { t } = useTranslation();
    const { td } = useTd();
    const { message } = App.useApp();
    const { props: pageProps } = usePage<PageProps>();
    const showProductTour =
        pageProps.featureFlags?.["crm.list-product-tours"] === true;
    const tourRef = useRef<ProductTourHandle>(null);
    const reminderPreferencesTourSteps = useMemo(
        () => buildReminderPreferencesTourSteps(),
        [],
    );
    const defaultReminders = useMemo(
        () => normalizeReminders(defaults ?? FALLBACK_DEFAULTS),
        [defaults],
    );
    const [reminders, setReminders] = useState(() =>
        normalizeReminders(initialReminders),
    );
    const [isActive, setIsActive] = useState(initialActive !== false);
    const [hasChanges, setHasChanges] = useState(false);
    const [saving, setSaving] = useState(false);
    const [resetting, setResetting] = useState(false);
    const [resetOpen, setResetOpen] = useState(false);

    const unitOptions = useMemo(
        () => [
            { value: "minute", label: td("Minutes", { source: "en" }) },
            { value: "hour", label: td("Hours", { source: "en" }) },
            { value: "day", label: td("Days", { source: "en" }) },
        ],
        [td],
    );

    const markChanged = (next: Reminder[]) => {
        setReminders(next);
        setHasChanges(true);
    };

    const handleAdd = () => {
        if (reminders.length >= MAX_REMINDERS) {
            message.warning(
                td("You can add up to 20 reminders.", { source: "en" }),
            );
            return;
        }
        markChanged([...reminders, { time: 10, type: "minute" }]);
    };

    const handleRemove = (index: number) => {
        if (reminders.length <= 1) {
            message.warning(
                td("At least one reminder is required.", { source: "en" }),
            );
            return;
        }
        markChanged(reminders.filter((_, i) => i !== index));
    };

    const handleChange = (
        index: number,
        field: keyof Reminder,
        value: number | ReminderType,
    ) => {
        markChanged(
            reminders.map((item, i) =>
                i === index ? { ...item, [field]: value } : item,
            ),
        );
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await axios.post(UPDATE_URL, {
                entity_type: "meeting",
                reminders,
                is_active: isActive,
            });
            setHasChanges(false);
            message.success(t("messages.recordSaved"));
        } catch (error) {
            message.error(errorMessage(error, t("messages.somethingWentWrong")));
        } finally {
            setSaving(false);
        }
    };

    const handleReset = async () => {
        setResetting(true);
        try {
            const response = await axios.delete(RESET_URL);
            const next = normalizeReminders(
                (response.data as { defaults?: Reminder[] })?.defaults ??
                    defaultReminders,
            );
            setReminders(next);
            setIsActive(true);
            setHasChanges(false);
            setResetOpen(false);
            message.success(
                td("Preferences reset to defaults.", { source: "en" }),
            );
        } catch (error) {
            message.error(errorMessage(error, t("messages.somethingWentWrong")));
        } finally {
            setResetting(false);
        }
    };

    const breadcrumbs = [
        { name: t("app.menu.settings"), url: "/account/settings/profile" },
        { name: t("app.settings.reminder_preferences") },
    ];
    const busy = saving || resetting;

    return (
        <DashboardLayout>
            <PageLayout
                title={pageTitle}
                breadcrumbs={breadcrumbs}
                config={{ showTitle: true }}
            >
                {showProductTour && (
                    <ProductTour
                        ref={tourRef}
                        tourId={REMINDER_PREFERENCES_TOUR_ID}
                        steps={reminderPreferencesTourSteps}
                        labels={REMINDER_PREFERENCES_TOUR_LABELS}
                    />
                )}
                <div
                    className="mx-auto flex max-w-3xl flex-col"
                    style={{ gap: 16, fontFamily: REDESIGN_FONT_STACK }}
                >
                    {showProductTour && (
                        <div className="flex justify-end">
                            <button
                                type="button"
                                className="dr-btn dr-btn-ghost"
                                onClick={() => tourRef.current?.restart()}
                            >
                                {t(
                                    "pages.settings.reminder_preferences_tour.replay_menu_item",
                                )}
                            </button>
                        </div>
                    )}
                    <Section
                        title={td("Meeting reminders", { source: "en" })}
                        description={td(
                            "When to notify you before meetings. A meeting can still override these with its own reminders.",
                            { source: "en" },
                        )}
                        headerTourTarget="reminders-enable"
                        extra={
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                    flexShrink: 0,
                                }}
                            >
                                <span
                                    style={{
                                        fontSize: REDESIGN_TYPE.CAPTION,
                                        color: T.TEXT_MUTED,
                                    }}
                                >
                                    {td("Enable reminders", { source: "en" })}
                                </span>
                                <Switch
                                    checked={isActive}
                                    disabled={busy}
                                    onChange={() => {
                                        setIsActive(!isActive);
                                        setHasChanges(true);
                                    }}
                                    aria-label={td("Enable reminders", {
                                        source: "en",
                                    })}
                                />
                            </div>
                        }
                    >
                        {!isActive ? (
                            <div
                                style={{
                                    marginBottom: 14,
                                    padding: "10px 12px",
                                    borderRadius: 8,
                                    background: T.AMBER_SOFT,
                                    border: `1px solid ${T.AMBER_MID}`,
                                    fontSize: REDESIGN_TYPE.CAPTION,
                                    color: T.AMBER,
                                    lineHeight: 1.45,
                                }}
                            >
                                {td(
                                    "Reminders are off. Turn them on to get notified before meetings.",
                                    { source: "en" },
                                )}
                            </div>
                        ) : null}

                        <div data-tour="reminders-rows">
                            <div
                                style={{
                                    border: `1px solid ${T.BORDER}`,
                                    borderRadius: 8,
                                    overflow: "hidden",
                                    marginBottom: 12,
                                }}
                            >
                            {reminders.map((reminder, index) => (
                                <div
                                    key={index}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 10,
                                        padding: "10px 12px",
                                        borderTop:
                                            index === 0
                                                ? "none"
                                                : `1px solid ${T.BORDER_SOFT}`,
                                        background: T.WHITE,
                                        opacity: isActive ? 1 : 0.55,
                                    }}
                                >
                                    <input
                                        type="number"
                                        min={0}
                                        max={10080}
                                        value={reminder.time}
                                        disabled={!isActive || busy}
                                        onChange={(e) => {
                                            const next = Number(e.target.value);
                                            handleChange(
                                                index,
                                                "time",
                                                Number.isFinite(next)
                                                    ? Math.max(
                                                          0,
                                                          Math.min(10080, next),
                                                      )
                                                    : 0,
                                            );
                                        }}
                                        aria-label={td("Remind before", {
                                            source: "en",
                                        })}
                                        style={inputStyle}
                                    />
                                    <MenuSelect
                                        value={reminder.type}
                                        options={unitOptions}
                                        onChange={(value) =>
                                            handleChange(
                                                index,
                                                "type",
                                                value as ReminderType,
                                            )
                                        }
                                        disabled={!isActive || busy}
                                        width={128}
                                        size="sm"
                                    />
                                    <span
                                        style={{
                                            flex: 1,
                                            fontSize: REDESIGN_TYPE.CAPTION,
                                            color: T.TEXT_MUTED,
                                        }}
                                    >
                                        {td("before meeting", { source: "en" })}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => handleRemove(index)}
                                        disabled={
                                            reminders.length <= 1 ||
                                            !isActive ||
                                            busy
                                        }
                                        aria-label={td("Remove reminder", {
                                            source: "en",
                                        })}
                                        style={{
                                            appearance: "none",
                                            border: 0,
                                            background: "transparent",
                                            padding: 4,
                                            cursor:
                                                reminders.length <= 1 ||
                                                !isActive ||
                                                busy
                                                    ? "default"
                                                    : "pointer",
                                            color: T.TEXT_MUTED,
                                        }}
                                    >
                                        <Icon name="trash" size={14} />
                                    </button>
                                </div>
                            ))}
                            </div>

                            <Button
                                variant="ghost"
                                size="sm"
                                icon={<Icon name="plus" size={14} />}
                                disabled={
                                    reminders.length >= MAX_REMINDERS ||
                                    !isActive ||
                                    busy
                                }
                                onClick={handleAdd}
                                style={{ width: "100%" }}
                            >
                                {td("Add reminder", { source: "en" })}
                            </Button>
                        </div>

                        <div
                            data-tour="reminders-save-reset"
                            style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: 12,
                                marginTop: 16,
                                paddingTop: 16,
                                borderTop: `1px solid ${T.BORDER_SOFT}`,
                            }}
                        >
                            <Button
                                variant="ghost"
                                size="sm"
                                icon={<Icon name="refresh" size={14} />}
                                loading={resetting}
                                disabled={busy}
                                onClick={() => setResetOpen(true)}
                            >
                                {td("Reset to defaults", { source: "en" })}
                            </Button>
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 12,
                                }}
                            >
                                {hasChanges ? (
                                    <span
                                        style={{
                                            fontSize: REDESIGN_TYPE.CAPTION,
                                            color: T.AMBER,
                                        }}
                                    >
                                        {td("You have unsaved changes", {
                                            source: "en",
                                        })}
                                    </span>
                                ) : null}
                                <Button
                                    variant="primary"
                                    size="sm"
                                    loading={saving}
                                    disabled={!hasChanges || busy}
                                    onClick={() => void handleSave()}
                                >
                                    {td("Save changes", { source: "en" })}
                                </Button>
                            </div>
                        </div>
                    </Section>

                    <Section
                        title={td("Defaults", { source: "en" })}
                        tourTarget="reminders-defaults"
                    >
                        <p
                            style={{
                                margin: 0,
                                fontSize: REDESIGN_TYPE.BODY,
                                color: T.TEXT_MUTED,
                                lineHeight: 1.45,
                            }}
                        >
                            {td(
                                "If you have not set custom reminders, you are notified 1 hour, 30 minutes, 15 minutes, and 5 minutes before the meeting.",
                                { source: "en" },
                            )}
                        </p>
                    </Section>
                </div>
            </PageLayout>

            <ConfirmDialog
                open={resetOpen}
                title={td("Reset to defaults", { source: "en" })}
                message={td(
                    "This restores the default meeting reminder times. Continue?",
                    { source: "en" },
                )}
                confirmLabel={td("Yes, reset", { source: "en" })}
                cancelLabel={td("Cancel", { source: "en" })}
                confirmLoading={resetting}
                onConfirm={() => void handleReset()}
                onCancel={() => {
                    if (!resetting) setResetOpen(false);
                }}
            />
        </DashboardLayout>
    );
}
