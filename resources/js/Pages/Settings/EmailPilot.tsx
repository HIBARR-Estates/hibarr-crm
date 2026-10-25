import { FormEvent, useMemo, useState } from "react";
import { Head, Link, router } from "@inertiajs/react";
import axios from "axios";
import DashboardLayout from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import { Button } from "@/Components/Redesign";
import useTranslation from "@/Hooks/useTranslation";
import "@/Components/Redesign/redesign.css";

type PilotEntry = {
    id: number;
    scope: "user" | "company";
    user_id: number | null;
    user_name: string | null;
    user_email: string | null;
    added_by_id: number | null;
    added_by_name: string | null;
    created_at: string | null;
};

type Candidate = {
    id: number;
    name: string;
    email: string | null;
};

type EmailPilotProps = {
    pageTitle: string;
    entries: PilotEntry[];
    mailboxSettingsUrl: string;
};

export default function EmailPilot({
    pageTitle,
    entries: initialEntries,
    mailboxSettingsUrl,
}: EmailPilotProps) {
    const { t } = useTranslation();
    const [entries, setEntries] = useState(initialEntries);
    const [query, setQuery] = useState("");
    const [candidates, setCandidates] = useState<Candidate[]>([]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const companyWide = useMemo(
        () => entries.find((entry) => entry.scope === "company") ?? null,
        [entries],
    );
    const users = useMemo(
        () => entries.filter((entry) => entry.scope === "user"),
        [entries],
    );

    const search = async (term: string) => {
        setQuery(term);
        setError(null);
        if (term.trim().length < 2) {
            setCandidates([]);
            return;
        }
        try {
            const { data } = await axios.get<{ items: Candidate[] }>(
                "/email/pilot-allowlist/candidates",
                { params: { q: term.trim() } },
            );
            setCandidates(data.items ?? []);
        } catch {
            setError("search_failed");
        }
    };

    const refresh = (next: PilotEntry[]) => {
        setEntries(next);
        setCandidates([]);
        setQuery("");
    };

    const addCompany = async () => {
        setBusy(true);
        setError(null);
        try {
            const { data } = await axios.post<{ entries: PilotEntry[] }>(
                "/email/pilot-allowlist",
                { scope: "company" },
            );
            refresh(data.entries);
        } catch {
            setError("add_failed");
        } finally {
            setBusy(false);
        }
    };

    const addUser = async (userId: number) => {
        setBusy(true);
        setError(null);
        try {
            const { data } = await axios.post<{ entries: PilotEntry[] }>(
                "/email/pilot-allowlist",
                { scope: "user", user_id: userId },
            );
            refresh(data.entries);
        } catch {
            setError("add_failed");
        } finally {
            setBusy(false);
        }
    };

    const remove = async (entryId: number) => {
        setBusy(true);
        setError(null);
        try {
            const { data } = await axios.delete<{ entries: PilotEntry[] }>(
                `/email/pilot-allowlist/${entryId}`,
            );
            refresh(data.entries);
        } catch {
            setError("remove_failed");
        } finally {
            setBusy(false);
        }
    };

    const onSearchSubmit = (event: FormEvent) => {
        event.preventDefault();
        void search(query);
    };

    return (
        <DashboardLayout>
            <Head title={pageTitle} />
            <PageLayout
                title={pageTitle}
                breadcrumbs={[
                    { name: t("app.menu.settings_menu.email_pilot") },
                ]}
                config={{ showTitle: true }}
            >
                <div className="mx-auto flex max-w-3xl flex-col gap-6">
                    <p className="m-0 text-sm text-dr-text-muted">
                        {t("pages.email.pilot.help")}
                    </p>

                    <div className="rounded border border-dr-border p-4">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                            <h2 className="m-0 text-base font-semibold">
                                {t("pages.email.pilot.company_title")}
                            </h2>
                            {companyWide ? (
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    disabled={busy}
                                    onClick={() => void remove(companyWide.id)}
                                >
                                    {t("pages.email.pilot.remove")}
                                </Button>
                            ) : (
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="primary"
                                    disabled={busy}
                                    onClick={() => void addCompany()}
                                >
                                    {t("pages.email.pilot.add_company")}
                                </Button>
                            )}
                        </div>
                        <p className="m-0 text-sm text-dr-text-muted">
                            {companyWide
                                ? t("pages.email.pilot.company_enabled")
                                : t("pages.email.pilot.company_disabled")}
                        </p>
                    </div>

                    <div className="rounded border border-dr-border p-4">
                        <h2 className="mb-3 mt-0 text-base font-semibold">
                            {t("pages.email.pilot.users_title")}
                        </h2>
                        <form
                            className="mb-3 flex flex-wrap gap-2"
                            onSubmit={onSearchSubmit}
                        >
                            <input
                                className="dr-input min-w-[220px] flex-1"
                                value={query}
                                onChange={(event) =>
                                    void search(event.target.value)
                                }
                                placeholder={t(
                                    "pages.email.pilot.search_placeholder",
                                )}
                                aria-label={t(
                                    "pages.email.pilot.search_placeholder",
                                )}
                            />
                            <Button type="submit" size="sm" variant="ghost">
                                {t("pages.email.pilot.search")}
                            </Button>
                        </form>
                        {candidates.length > 0 ? (
                            <ul className="mb-4 mt-0 list-none space-y-1 p-0">
                                {candidates.map((candidate) => (
                                    <li
                                        key={candidate.id}
                                        className="flex items-center justify-between gap-2 rounded border border-dr-border px-3 py-2 text-sm"
                                    >
                                        <span>
                                            {candidate.name}
                                            {candidate.email
                                                ? ` · ${candidate.email}`
                                                : ""}
                                        </span>
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="primary"
                                            disabled={busy}
                                            onClick={() =>
                                                void addUser(candidate.id)
                                            }
                                        >
                                            {t("pages.email.pilot.add_user")}
                                        </Button>
                                    </li>
                                ))}
                            </ul>
                        ) : null}
                        {users.length === 0 ? (
                            <p className="m-0 text-sm text-dr-text-muted">
                                {t("pages.email.pilot.users_empty")}
                            </p>
                        ) : (
                            <ul className="m-0 list-none space-y-1 p-0">
                                {users.map((entry) => (
                                    <li
                                        key={entry.id}
                                        className="flex items-center justify-between gap-2 rounded border border-dr-border px-3 py-2 text-sm"
                                    >
                                        <div>
                                            <div className="font-medium">
                                                {entry.user_name}
                                            </div>
                                            <div className="text-xs text-dr-text-muted">
                                                {entry.user_email}
                                                {entry.added_by_name
                                                    ? ` · ${t("pages.email.pilot.added_by")} ${entry.added_by_name}`
                                                    : ""}
                                            </div>
                                        </div>
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="ghost"
                                            disabled={busy}
                                            onClick={() =>
                                                void remove(entry.id)
                                            }
                                        >
                                            {t("pages.email.pilot.remove")}
                                        </Button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {error ? (
                        <p className="m-0 text-sm text-red-600" role="alert">
                            {t(`pages.email.pilot.errors.${error}`)}
                        </p>
                    ) : null}

                    <Link
                        href={mailboxSettingsUrl}
                        className="text-sm"
                        onClick={(event) => {
                            event.preventDefault();
                            router.visit(mailboxSettingsUrl);
                        }}
                    >
                        {t("pages.email.pilot.open_mailbox")}
                    </Link>
                </div>
            </PageLayout>
        </DashboardLayout>
    );
}
