import { useEffect, useMemo, useState } from "react";
import { usePage } from "@inertiajs/react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useMeetingHostFlag from "@/Hooks/useMeetingHostFlag";
import useUserTimezoneLookup from "@/Hooks/useUserTimezoneLookup";
import SearchableSelect from "@/Components/Redesign/primitives/SearchableSelect";
import Switch from "@/Components/Redesign/primitives/Switch";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import { buildTimezoneGroups } from "@/lib/timezoneOptions";
import { timezoneCity, timezoneUtcOffset } from "@/lib/timezoneLabel";
import { getBrowserTimezone } from "@/lib/userTimezone";

/** The signed-in user's saved timezone, falling back to the browser's. */
export function useMyTimezone(): string {
    const { props } = usePage();
    return (
        (props.auth?.user?.timezone as string | null | undefined) ||
        getBrowserTimezone()
    );
}

interface MeetingTimezoneFieldProps {
    /** Optional so an antd `Form.Item` can inject value/onChange. */
    value?: string;
    onChange?: (timezone: string) => void;
    /** Meeting host — offers a "use host's time" switch when it isn't you. */
    hostId: number | null;
    disabled?: boolean;
    /**
     * Rendered as the last row of the date/time block: its own small label
     * and a divider above. Off when a form wrapper already labels the field.
     */
    embedded?: boolean;
}

/**
 * Which timezone the meeting's date/time are entered in, as one compact row:
 * an inline picker, the zone's UTC offset, and — when someone else hosts — a
 * switch to use the host's zone instead. Seeds itself with the current user's
 * timezone; the host's zone is only fetched when the switch is turned on.
 */
export default function MeetingTimezoneField({
    value,
    onChange,
    hostId,
    disabled = false,
    embedded = false,
}: MeetingTimezoneFieldProps) {
    const { td } = useTd();
    const { props } = usePage();
    const hostFeatureEnabled = useMeetingHostFlag();
    const { lookup, loading } = useUserTimezoneLookup();
    const [hostTimezone, setHostTimezone] = useState<string | null>(null);
    const [hostLookupFailed, setHostLookupFailed] = useState(false);

    const currentUserId = props.auth?.user?.id as number | string | undefined;
    const myTimezone = useMyTimezone();
    const timezoneGroups = useMemo(() => buildTimezoneGroups(), []);
    const current = value || myTimezone;

    // No deps on purpose: a parent that resets its form on open runs its effect
    // after ours and wipes the seed in the same batch, so `value` never visibly
    // changes. Re-checking every render re-seeds whenever it's been cleared.
    useEffect(() => {
        if (!value) onChange?.(myTimezone);
    });

    // A different host means a different timezone — don't keep the old one.
    useEffect(() => {
        setHostTimezone(null);
        setHostLookupFailed(false);
    }, [hostId]);

    // Ids can arrive as strings from some payloads — compare numerically.
    const showHostOption =
        hostFeatureEnabled &&
        hostId != null &&
        Number(hostId) !== Number(currentUserId);
    const usingHostTimezone = hostTimezone != null && value === hostTimezone;

    const toggleHostTimezone = async () => {
        if (usingHostTimezone) {
            onChange?.(myTimezone);
            return;
        }
        if (hostId == null) return;
        const timezone = hostTimezone ?? (await lookup(hostId));
        if (!timezone) {
            setHostLookupFailed(true);
            return;
        }
        setHostLookupFailed(false);
        setHostTimezone(timezone);
        onChange?.(timezone);
    };

    return (
        <div
            style={
                embedded
                    ? {
                          borderTop: `1px solid ${T.BORDER_SOFT}`,
                          paddingTop: 14,
                      }
                    : undefined
            }
        >
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <div className="flex min-w-0 flex-1 flex-col">
                    {embedded && (
                        <span
                            className="font-semibold"
                            style={{ fontSize: 11.5, color: T.TEXT_MUTED }}
                        >
                            {td("Timezone", { source: "en" })}
                        </span>
                    )}
                    <SearchableSelect<string>
                        variant="borderless"
                        value={current}
                        onChange={(next) => next && onChange?.(next)}
                        options={timezoneGroups}
                        disabled={disabled}
                        popupMatchSelectWidth={false}
                        aria-label={td("Timezone", { source: "en" })}
                        // Borderless still pads its text; pull it back in line
                        // with the label above.
                        style={{
                            marginLeft: -11,
                            fontWeight: 600,
                            minWidth: 0,
                            maxWidth: "100%",
                        }}
                    />
                </div>
                <span
                    className="whitespace-nowrap"
                    style={{ fontSize: 12.5, color: T.TEXT_MUTED }}
                >
                    {timezoneUtcOffset(current)}
                </span>
                {showHostOption && (
                    <Switch
                        checked={usingHostTimezone}
                        onChange={toggleHostTimezone}
                        loading={loading}
                        disabled={disabled}
                        label={
                            hostTimezone
                                ? `${td("Use host's time", { source: "en" })} (${timezoneCity(hostTimezone)})`
                                : td("Use host's time", { source: "en" })
                        }
                    />
                )}
            </div>
            {hostLookupFailed && (
                <p
                    className="text-[12px]"
                    style={{ color: T.RED, margin: "6px 0 0" }}
                >
                    {td("Couldn't load the host's timezone.", { source: "en" })}
                </p>
            )}
        </div>
    );
}
