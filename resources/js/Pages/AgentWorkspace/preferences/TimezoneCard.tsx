import { useMemo } from "react";
import SearchableSelect from "@/Components/Redesign/primitives/SearchableSelect";
import Switch from "@/Components/Redesign/primitives/Switch";
import useTranslation from "@/Hooks/useTranslation";
import { buildTimezoneGroups } from "@/lib/timezoneOptions";
import { getBrowserTimezone } from "@/lib/userTimezone";
import { PrefCard, PrefRow } from "./PrefCard";
import useTimezonePreference from "./useTimezonePreference";

interface TimezoneCardProps {
    timezone: string | null;
    locked: boolean;
}

/**
 * Timezone: the zone CRM times use, and whether it follows this browser. Both
 * save as they change (the classic Preferences page's own endpoint).
 */
export default function TimezoneCard({ timezone: initialTimezone, locked: initialLocked }: TimezoneCardProps) {
    const { t } = useTranslation();
    const groups = useMemo(() => buildTimezoneGroups(), []);
    const browserZone = useMemo(() => getBrowserTimezone(), []);
    const { timezone, locked, saving, save } = useTimezonePreference(initialTimezone, initialLocked);
    const busy = saving !== null;

    return (
        <PrefCard title={t("pages.agent_workspace.prefs.timezone.title")}>
            <PrefRow
                title={t("pages.agent_workspace.prefs.timezone.uses")}
                text={t("pages.agent_workspace.prefs.timezone.uses_text", { zone: browserZone.replace(/_/g, " ") })}
            >
                <SearchableSelect<string>
                    value={timezone}
                    options={groups}
                    popupMatchSelectWidth
                    className="agent-pr__select"
                    disabled={busy}
                    loading={saving === "picker"}
                    aria-label={t("pages.agent_workspace.prefs.timezone.uses")}
                    onChange={(value) => {
                        if (value) void save(value, true, "picker");
                    }}
                />
            </PrefRow>
            <PrefRow
                title={t("pages.agent_workspace.prefs.timezone.sync")}
                text={t("pages.agent_workspace.prefs.timezone.sync_text")}
            >
                <Switch
                    checked={!locked}
                    loading={saving === "browser"}
                    disabled={busy && saving !== "browser"}
                    onChange={() => void (locked ? save(browserZone, false, "browser") : save(timezone, true, "browser"))}
                    aria-label={t("pages.agent_workspace.prefs.timezone.sync")}
                />
            </PrefRow>
        </PrefCard>
    );
}
