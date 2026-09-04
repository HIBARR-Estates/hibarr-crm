import useTranslation from "@/Hooks/useTranslation";
import { useTd } from "@/Hooks/useDynamicTranslation";
import EmptyState from "../primitives/EmptyState";

/**
 * The empty state for every Deal and Lead workspace tab, in one place.
 *
 * The two workspaces run near-identical tabs (tasks, meetings, itinerary,
 * files, notes) from separate components, so their empty states used to be
 * copies that drifted apart — different icons, different copy, some with a
 * filter row still showing, some with the action in the header instead of the
 * state. Both sides now render these, which is what makes an empty Deal tab
 * and an empty Lead tab the same experience by construction.
 *
 * Rules baked in here:
 *  - one distinct icon per tab, the same on both sides;
 *  - the primary action lives in the empty state, never in a header the tab
 *    hides anyway;
 *  - "nothing here" and "nothing matches this filter" are different states —
 *    the second offers a way back to everything, not an add.
 */

/** Which record the tab belongs to — only affects the wording. */
export type WorkspaceEntity = "deal" | "lead";

export function TasksEmptyState({
    entity,
    onAdd,
}: {
    entity: WorkspaceEntity;
    /** Omitted when the user cannot add tasks. */
    onAdd?: () => void;
}) {
    const { t } = useTranslation();
    const { td } = useTd();

    return (
        <EmptyState
            icon="check-square"
            title={td("No tasks yet", { source: "en" })}
            description={td(
                `Track the follow-ups this ${entity} needs so nothing slips.`,
                { source: "en" },
            )}
            action={
                onAdd
                    ? {
                          label: t("pages.deals.workspace.tasks.add_task"),
                          onClick: onAdd,
                      }
                    : undefined
            }
        />
    );
}

/** Tasks exist, the active filter just hides all of them. */
export function TasksFilterEmptyState({
    filterLabel,
    onShowAll,
}: {
    filterLabel: string;
    onShowAll: () => void;
}) {
    const { t } = useTranslation();
    const { td } = useTd();

    return (
        <EmptyState
            icon="check-square"
            title={`${t("pages.deals.workspace.tasks.no_items_prefix")} ${filterLabel} ${t("pages.deals.workspace.tasks.tasks_label")}`}
            description={td("Nothing matches this filter right now.", {
                source: "en",
            })}
            action={{
                label: td("Show all tasks", { source: "en" }),
                onClick: onShowAll,
                icon: null,
            }}
        />
    );
}

export function MeetingsEmptyState({
    onSchedule,
}: {
    onSchedule?: () => void;
}) {
    const { t } = useTranslation();
    const { td } = useTd();

    return (
        <EmptyState
            icon="calendar"
            title={t("pages.deals.workspace.meetings.empty")}
            description={td(
                "Schedule a call or viewing and it will show up here.",
                { source: "en" },
            )}
            action={
                onSchedule
                    ? {
                          label: t("pages.deals.workspace.meetings.schedule"),
                          onClick: onSchedule,
                      }
                    : undefined
            }
        />
    );
}

export function ItineraryEmptyState({ onAdd }: { onAdd?: () => void }) {
    const { t } = useTranslation();

    // Both sides already had lang keys for this one, so it needs no per-entity
    // wording — the copy is about the client's trip either way.
    return (
        <EmptyState
            icon="map-pin"
            title={t("pages.flight_itinerary.empty")}
            description={t("pages.flight_itinerary.empty_hint")}
            action={
                onAdd
                    ? {
                          label: t("pages.flight_itinerary.add_flight"),
                          onClick: onAdd,
                      }
                    : undefined
            }
        />
    );
}

/** Flights exist, the active filter just hides all of them. */
export function ItineraryFilterEmptyState({
    entity,
    onShowAll,
}: {
    entity: WorkspaceEntity;
    onShowAll: () => void;
}) {
    const { td } = useTd();

    return (
        <EmptyState
            icon="map-pin"
            title={td("No flights match this filter", { source: "en" })}
            description={td(
                `Clear the filter to see every flight on this ${entity}.`,
                { source: "en" },
            )}
            action={{
                label: td("Show all flights", { source: "en" }),
                onClick: onShowAll,
                icon: null,
            }}
        />
    );
}

export function FilesEmptyState({ title }: { title: string }) {
    const { td } = useTd();

    return (
        <EmptyState
            icon="paperclip"
            title={title}
            description={td(
                "Drop a file above to attach contracts, IDs and other paperwork.",
                { source: "en" },
            )}
        />
    );
}

export function NotesEmptyState({ onAdd }: { onAdd?: () => void }) {
    const { t } = useTranslation();
    const { td } = useTd();

    return (
        <EmptyState
            icon="message"
            title={t("pages.deals.workspace.notes.empty")}
            description={td(
                "Notes you add here stay with this record for the whole team.",
                { source: "en" },
            )}
            action={
                onAdd
                    ? {
                          label: t("pages.deals.workspace.notes.add_note"),
                          onClick: onAdd,
                      }
                    : undefined
            }
        />
    );
}
