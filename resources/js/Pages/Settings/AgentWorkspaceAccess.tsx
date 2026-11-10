import { useRef, useState, type ReactNode } from "react";
import axios from "axios";
import { Deferred } from "@inertiajs/react";
import DashboardLayout from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import "@/Components/Redesign/redesign.css";
import Avatar from "@/Components/Redesign/primitives/Avatar";
import Badge from "@/Components/Redesign/primitives/Badge";
import Button from "@/Components/Redesign/primitives/Button";
import EmptyState from "@/Components/Redesign/primitives/EmptyState";
import Icon from "@/Components/Redesign/primitives/Icon";
import PeoplePicker, { type PersonOption } from "@/Components/Redesign/primitives/PeoplePicker";
import Segmented from "@/Components/Redesign/primitives/Segmented";
import { initialsFromName } from "@/Components/Redesign/adapters/initials";
import { REDESIGN_FONT_STACK, REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import useTranslation from "@/Hooks/useTranslation";

type Access = "allow" | "block";

interface Entry {
    user_id: number;
    name: string;
    email: string | null;
    image: string | null;
    active: boolean;
    access: Access;
    lead_agent: boolean;
    added_by_name: string | null;
    updated_at: string | null;
}

interface PageProps {
    pageTitle: string;
    entries: Entry[];
    /** Enabled, non-partner lead agents: who has the workspace with no entry. */
    defaultMemberCount: number;
    /** Deferred: active users of the company, for the picker. */
    people?: PersonOption[];
}

/**
 * Settings → Agent workspace access. Lead agents have /agent by default; this
 * page lists the exceptions (Allow for someone who isn't a lead agent, Block
 * for a lead agent). Every change shows at once and is rolled back if the
 * server refuses it; the server's list then replaces the local one.
 */
export default function AgentWorkspaceAccess({ pageTitle, entries: initialEntries, defaultMemberCount, people }: PageProps) {
    const { t } = useTranslation();
    const [entries, setEntries] = useState<Entry[]>(initialEntries);
    const [pickerOpen, setPickerOpen] = useState(false);
    const [addAs, setAddAs] = useState<Access>("allow");
    const [pendingId, setPendingId] = useState<number | null>(null);
    const [error, setError] = useState(false);

    // Changes go to the server one at a time, in click order, so every
    // response already includes the earlier changes and can replace the list.
    const queue = useRef<Promise<void>>(Promise.resolve());
    // The list as the server last confirmed it; failures roll back to this.
    const confirmed = useRef<Entry[]>(initialEntries);

    const save = (
        userId: number,
        optimistic: (current: Entry[]) => Entry[],
        request: () => Promise<{ data: { entries?: Entry[] } }>,
    ) => {
        setError(false);
        setEntries(optimistic);
        queue.current = queue.current.then(async () => {
            setPendingId(userId);
            try {
                const { data } = await request();
                if (data.entries) {
                    confirmed.current = data.entries;
                    setEntries(data.entries);
                }
            } catch {
                // Every change touches one person, so a failure puts only that
                // person's row back, as the server last confirmed it, and
                // keeps other clicks still waiting in the queue.
                const previous = confirmed.current.find((entry) => entry.user_id === userId);
                setEntries((current) => {
                    const others = current.filter((entry) => entry.user_id !== userId);
                    if (!previous) return others;
                    const index = current.findIndex((entry) => entry.user_id === userId);
                    if (index === -1) return [...others, previous];
                    return current.map((entry) => (entry.user_id === userId ? previous : entry));
                });
                setError(true);
            } finally {
                setPendingId(null);
            }
        });
        return queue.current;
    };

    const setAccess = (person: { id: number; name: string; designation?: string; image?: string | null }, access: Access) =>
        save(
            person.id,
            (current) => {
                const existing = current.find((entry) => entry.user_id === person.id);
                if (existing) {
                    return current.map((entry) => (entry.user_id === person.id ? { ...entry, access } : entry));
                }
                return [
                    ...current,
                    {
                        user_id: person.id,
                        name: person.name,
                        email: person.designation ?? null,
                        image: person.image ?? null,
                        active: true,
                        access,
                        lead_agent: false,
                        added_by_name: null,
                        updated_at: null,
                    },
                ];
            },
            () => axios.post(route("agent-workspace-access.store"), { user_id: person.id, access }),
        );

    const remove = (entry: Entry) =>
        save(
            entry.user_id,
            (current) => current.filter((item) => item.user_id !== entry.user_id),
            () => axios.delete(route("agent-workspace-access.destroy", entry.user_id)),
        );

    const accessOptions = [
        { value: "allow" as Access, label: t("pages.agent_workspace.access.allow") },
        { value: "block" as Access, label: t("pages.agent_workspace.access.block") },
    ];

    let picker: ReactNode = null;
    if (pickerOpen) {
        picker = (
            <div style={{ borderBottom: `1px solid ${T.BORDER_SOFT}`, padding: "12px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13, color: T.TEXT_MUTED }}>{t("pages.agent_workspace.access.add_as")}</span>
                    <Segmented
                        value={addAs}
                        options={accessOptions}
                        onChange={setAddAs}
                        variant="raised"
                        ariaLabel={t("pages.agent_workspace.access.add_as")}
                    />
                </div>
                <Deferred
                    data="people"
                    fallback={<div className="dr-skeleton" style={{ height: 160, borderRadius: 8 }} aria-busy="true" />}
                >
                    <PeoplePicker
                        people={people ?? []}
                        exclude={entries.map((entry) => entry.user_id)}
                        onPick={(person) => void setAccess(person, addAs)}
                        pendingId={pendingId}
                        autoFocus
                        placeholder={t("pages.agent_workspace.access.search_placeholder")}
                        emptyLabel={t("pages.agent_workspace.access.no_matches")}
                    />
                </Deferred>
            </div>
        );
    }

    return (
        <PageLayout
            title={pageTitle}
            breadcrumbs={[
                { name: t("app.menu.settings"), url: route("settings-overview.index") },
                { name: pageTitle },
            ]}
        >
            <div
                style={{
                    maxWidth: 820,
                    margin: "0 auto",
                    padding: "20px 0 40px",
                    fontFamily: REDESIGN_FONT_STACK,
                    display: "flex",
                    flexDirection: "column",
                    gap: 14,
                }}
            >
                <section
                    aria-labelledby="awa-heading"
                    style={{ background: T.SURFACE, border: `1px solid ${T.BORDER}`, borderRadius: 10, overflow: "hidden" }}
                >
                    <header
                        style={{
                            display: "flex",
                            flexWrap: "wrap",
                            alignItems: "flex-start",
                            justifyContent: "space-between",
                            gap: 12,
                            padding: "16px 18px",
                            borderBottom: `1px solid ${T.BORDER_SOFT}`,
                        }}
                    >
                        <div style={{ minWidth: 0, flex: "1 1 320px" }}>
                            <h2 id="awa-heading" style={{ margin: 0, fontSize: 15, fontWeight: 700, color: T.TEXT }}>
                                {t("pages.agent_workspace.access.list_title")}{" "}
                                <span style={{ color: T.TEXT_MUTED, fontWeight: 500 }}>· {entries.length}</span>
                            </h2>
                            <p style={{ margin: "4px 0 0", fontSize: 13, color: T.TEXT_MUTED }}>
                                {t("pages.agent_workspace.access.intro")}
                            </p>
                            <p style={{ margin: "6px 0 0", fontSize: 13, color: T.TEXT, fontWeight: 600 }}>
                                {t("pages.agent_workspace.access.default_count", { count: defaultMemberCount })}
                            </p>
                        </div>
                        <Button
                            variant={pickerOpen ? "ghost" : "primary"}
                            icon={<Icon name={pickerOpen ? "x" : "plus"} size={13} />}
                            onClick={() => setPickerOpen((open) => !open)}
                            aria-expanded={pickerOpen}
                        >
                            {pickerOpen ? t("pages.agent_workspace.access.done") : t("pages.agent_workspace.access.add_people")}
                        </Button>
                    </header>

                    {picker}

                    {error && (
                        <div role="alert" style={{ padding: "10px 18px", fontSize: 13, color: T.RED, borderBottom: `1px solid ${T.BORDER_SOFT}` }}>
                            {t("pages.agent_workspace.access.failed")}
                        </div>
                    )}

                    {entries.length === 0 ? (
                        <div style={{ padding: 18 }}>
                            <EmptyState
                                icon="users"
                                title={t("pages.agent_workspace.access.empty_title")}
                                description={t("pages.agent_workspace.access.empty_description")}
                            />
                        </div>
                    ) : (
                        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                            {entries.map((entry) => (
                                <li
                                    key={entry.user_id}
                                    style={{
                                        display: "flex",
                                        flexWrap: "wrap",
                                        alignItems: "center",
                                        gap: 12,
                                        padding: "12px 18px",
                                        borderBottom: `1px solid ${T.BORDER_SOFT}`,
                                    }}
                                >
                                    <Avatar initials={initialsFromName(entry.name)} src={entry.image} size={32} />
                                    <div style={{ minWidth: 0, flex: "1 1 200px" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600, color: T.TEXT, flexWrap: "wrap" }}>
                                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.name}</span>
                                            <Badge variant={entry.lead_agent ? "navy" : "gray"}>
                                                {entry.lead_agent
                                                    ? t("pages.agent_workspace.access.lead_agent")
                                                    : t("pages.agent_workspace.access.not_lead_agent")}
                                            </Badge>
                                            {!entry.active && <Badge variant="gray">{t("pages.agent_workspace.access.inactive")}</Badge>}
                                        </div>
                                        <div style={{ fontSize: 12.5, color: T.TEXT_MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                            {[entry.email, entry.added_by_name ? t("pages.agent_workspace.access.set_by", { name: entry.added_by_name }) : null]
                                                .filter(Boolean)
                                                .join(" · ")}
                                        </div>
                                    </div>
                                    <Segmented
                                        value={entry.access}
                                        options={accessOptions}
                                        onChange={(access) =>
                                            void setAccess(
                                                { id: entry.user_id, name: entry.name, designation: entry.email ?? undefined, image: entry.image },
                                                access,
                                            )
                                        }
                                        variant="raised"
                                        ariaLabel={entry.name}
                                    />
                                    <Button
                                        size="sm"
                                        loading={pendingId === entry.user_id}
                                        onClick={() => void remove(entry)}
                                        aria-label={t("pages.agent_workspace.access.remove_aria", { name: entry.name })}
                                    >
                                        {t("pages.agent_workspace.access.remove")}
                                    </Button>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </div>
        </PageLayout>
    );
}

AgentWorkspaceAccess.layout = (page: ReactNode) => <DashboardLayout>{page}</DashboardLayout>;
