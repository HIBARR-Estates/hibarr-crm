import { useState } from "react";
import { createPortal } from "react-dom";
import Button from "@/Components/Redesign/primitives/Button";
import ConfirmDialog from "@/Components/Redesign/primitives/ConfirmDialog";
import Icon from "@/Components/Redesign/primitives/Icon";
import MenuSelect from "@/Components/Redesign/primitives/MenuSelect";
import Switch from "@/Components/Redesign/primitives/Switch";
import useTranslation from "@/Hooks/useTranslation";
import { PrefCard, PrefRow } from "./PrefCard";
import useReminderPreferences, { MAX_REMINDERS, type ReminderPreferencesData, type ReminderUnit } from "./useReminderPreferences";

const UNITS: ReminderUnit[] = ["day", "hour", "minute"];

/** The server allows up to 7 days (10080 minutes); the limit in each unit. */
const MAX_BY_UNIT: Record<ReminderUnit, number> = { day: 7, hour: 168, minute: 10080 };

/**
 * Meeting reminders: when to be notified before a meeting. Edits stay in a
 * draft until the save bar's Save changes; Reset to defaults asks first and
 * saves straight away (the classic Reminder preferences page's endpoints). The
 * bar is drawn into `barSlot`, the full-width strip at the foot of the screen.
 */
export default function RemindersCard({ data, barSlot }: { data: ReminderPreferencesData; barSlot: HTMLElement | null }) {
    const { t } = useTranslation();
    const prefs = useReminderPreferences(data);
    const [resetOpen, setResetOpen] = useState(false);
    const { draft } = prefs;
    const busy = prefs.saving || prefs.resetting;
    const off = !draft.isActive;
    const unitOptions = UNITS.map((unit) => ({ value: unit, label: t(`pages.agent_workspace.prefs.reminders.units.${unit}`) }));

    return (
        <>
            <PrefCard
                title={t("pages.agent_workspace.prefs.reminders.title")}
                action={
                    <Button size="sm" disabled={busy} onClick={() => setResetOpen(true)}>
                        <Icon name="refresh" size={13} />
                        {t("pages.agent_workspace.prefs.reminders.reset")}
                    </Button>
                }
            >
                <PrefRow
                    title={t("pages.agent_workspace.prefs.reminders.enable")}
                    text={t("pages.agent_workspace.prefs.reminders.enable_text")}
                >
                    <Switch
                        checked={draft.isActive}
                        disabled={busy}
                        onChange={() => prefs.setActive(!draft.isActive)}
                        aria-label={t("pages.agent_workspace.prefs.reminders.enable")}
                    />
                </PrefRow>

                <h3 className="agent-pr__sub">{t("pages.agent_workspace.prefs.reminders.before")}</h3>
                {off ? <p className="agent-pr__off">{t("pages.agent_workspace.prefs.reminders.off")}</p> : null}
                <div className="agent-pr__reminders" style={{ opacity: off ? 0.55 : 1 }}>
                    {draft.reminders.map((reminder, index) => (
                        <div key={index} className="agent-pr__reminder">
                            <input
                                type="number"
                                min={0}
                                max={MAX_BY_UNIT[reminder.type]}
                                className="agent-pr__number"
                                value={reminder.time}
                                disabled={off || busy}
                                aria-label={t("pages.agent_workspace.prefs.reminders.before")}
                                onChange={(event) => {
                                    const next = Number(event.target.value);
                                    prefs.change(index, { time: Number.isFinite(next) ? Math.max(0, Math.min(MAX_BY_UNIT[reminder.type], next)) : 0 });
                                }}
                            />
                            <MenuSelect
                                value={reminder.type}
                                options={unitOptions}
                                onChange={(value) => {
                                    const type = value as ReminderUnit;
                                    prefs.change(index, { type, time: Math.min(reminder.time, MAX_BY_UNIT[type]) });
                                }}
                                disabled={off || busy}
                                width={128}
                                size="sm"
                            />
                            <span className="agent-pr__reminder-text">{t("pages.agent_workspace.prefs.reminders.before_meeting")}</span>
                            <Button
                                size="sm"
                                variant="danger"
                                disabled={!prefs.canRemove || off || busy}
                                onClick={() => prefs.remove(index)}
                                aria-label={t("pages.agent_workspace.prefs.reminders.remove")}
                            >
                                <Icon name="x" size={13} />
                                <span className="agent-pr__remove-label">{t("pages.agent_workspace.prefs.reminders.remove")}</span>
                            </Button>
                        </div>
                    ))}
                </div>

                <div className="agent-pr__add">
                    <Button className="agent-btn-soft" disabled={!prefs.canAdd || off || busy} onClick={prefs.add}>
                        <Icon name="plus" size={14} />
                        {t("pages.agent_workspace.prefs.reminders.add")}
                    </Button>
                    <span>{t("pages.agent_workspace.prefs.reminders.limits", { max: MAX_REMINDERS })}</span>
                </div>
            </PrefCard>

            {prefs.dirty && barSlot
                ? createPortal(
                <div className="agent-pr__bar" role="status">
                    <span className="agent-pr__bar-dot" aria-hidden="true" />
                    <b>{t("pages.agent_workspace.prefs.unsaved")}</b>
                    <Button disabled={busy} onClick={prefs.cancel}>
                        {t("pages.agent_workspace.prefs.cancel")}
                    </Button>
                    <Button variant="navy" loading={prefs.saving} disabled={busy} onClick={() => void prefs.save()}>
                        <Icon name="check" size={14} />
                        {t("pages.agent_workspace.prefs.save")}
                    </Button>
                </div>,
                      barSlot,
                  )
                : null}

            <ConfirmDialog
                open={resetOpen}
                title={t("pages.agent_workspace.prefs.reminders.reset_title")}
                message={t("pages.agent_workspace.prefs.reminders.reset_message")}
                confirmLabel={t("pages.agent_workspace.prefs.reminders.reset")}
                cancelLabel={t("pages.agent_workspace.prefs.cancel")}
                confirmLoading={prefs.resetting}
                onCancel={() => setResetOpen(false)}
                onConfirm={() => void prefs.reset().then((done) => done && setResetOpen(false))}
            />
        </>
    );
}
