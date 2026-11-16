import { useMemo, useState } from "react";
import axios from "axios";
import { App } from "antd";
import useTranslation from "@/Hooks/useTranslation";
import { errorMessage } from "./errorMessage";

const UPDATE_URL = "/account/settings/reminder-preferences";
const RESET_URL = "/account/settings/reminder-preferences/meeting/reset";

export const MAX_REMINDERS = 20;

export type ReminderUnit = "minute" | "hour" | "day";

export interface Reminder {
    time: number;
    type: ReminderUnit;
}

export interface ReminderPreferencesData {
    reminders: Reminder[];
    isActive: boolean;
    defaults: Reminder[];
}

const FALLBACK: Reminder[] = [
    { time: 1, type: "hour" },
    { time: 30, type: "minute" },
    { time: 15, type: "minute" },
    { time: 5, type: "minute" },
];

function normalize(value: Reminder[] | undefined): Reminder[] {
    if (!Array.isArray(value) || value.length === 0) return FALLBACK.map((item) => ({ ...item }));
    return value.map((item) => ({
        time: Number.isFinite(item.time) ? item.time : 0,
        type: item.type === "hour" || item.type === "day" ? item.type : "minute",
    }));
}

/**
 * Meeting reminders: the saved list and a draft the screen edits, so Cancel
 * can put the saved one back. Saves and resets go to the classic Reminder
 * preferences endpoints; the draft becomes the saved list from the response.
 */
export default function useReminderPreferences(seed: ReminderPreferencesData) {
    const { t } = useTranslation();
    const { message } = App.useApp();
    const defaults = useMemo(() => normalize(seed.defaults), [seed.defaults]);
    const [saved, setSaved] = useState(() => ({ reminders: normalize(seed.reminders), isActive: seed.isActive !== false }));
    const [draft, setDraft] = useState(saved);
    const [saving, setSaving] = useState(false);
    const [resetting, setResetting] = useState(false);

    const dirty = draft.isActive !== saved.isActive || JSON.stringify(draft.reminders) !== JSON.stringify(saved.reminders);
    const canAdd = draft.reminders.length < MAX_REMINDERS;
    const canRemove = draft.reminders.length > 1;

    const setReminders = (reminders: Reminder[]) => setDraft((current) => ({ ...current, reminders }));

    const add = () => {
        if (canAdd) setReminders([...draft.reminders, { time: 10, type: "minute" }]);
    };
    const remove = (index: number) => {
        if (canRemove) setReminders(draft.reminders.filter((_, i) => i !== index));
    };
    const change = (index: number, patch: Partial<Reminder>) =>
        setReminders(draft.reminders.map((item, i) => (i === index ? { ...item, ...patch } : item)));
    const setActive = (isActive: boolean) => setDraft((current) => ({ ...current, isActive }));
    const cancel = () => setDraft(saved);

    const save = async () => {
        setSaving(true);
        try {
            await axios.post(UPDATE_URL, { entity_type: "meeting", reminders: draft.reminders, is_active: draft.isActive });
            setSaved(draft);
            message.success(t("messages.recordSaved"));
        } catch (error) {
            message.error(errorMessage(error, t("messages.somethingWentWrong")));
        } finally {
            setSaving(false);
        }
    };

    const reset = async (): Promise<boolean> => {
        setResetting(true);
        try {
            const { data } = await axios.delete<{ defaults?: Reminder[] }>(RESET_URL);
            const next = { reminders: normalize(data?.defaults ?? defaults), isActive: true };
            setSaved(next);
            setDraft(next);
            message.success(t("pages.agent_workspace.prefs.reminders.reset_done"));
            return true;
        } catch (error) {
            message.error(errorMessage(error, t("messages.somethingWentWrong")));
            return false;
        } finally {
            setResetting(false);
        }
    };

    return { draft, dirty, saving, resetting, canAdd, canRemove, add, remove, change, setActive, cancel, save, reset };
}
