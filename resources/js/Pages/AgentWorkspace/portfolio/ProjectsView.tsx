import { lazy, Suspense, useState } from "react";
import { Deferred } from "@inertiajs/react";
import { AgentPager } from "@/Components/Redesign/agent";
import Button from "@/Components/Redesign/primitives/Button";
import EmptyState from "@/Components/Redesign/primitives/EmptyState";
import Icon from "@/Components/Redesign/primitives/Icon";
import useTranslation from "@/Hooks/useTranslation";
import { formatFrom, intlLocale } from "./format";
import { visitList } from "./portfolioVisit";
import type { ExposeTarget } from "./PortfolioExposeModal";
import type { PortfolioProject, ProjectFilters, ProjectsPayload } from "./types";

const PortfolioExposeModal = lazy(() => import("./PortfolioExposeModal"));

/** Unit types a card names; the rest collapse into "+N more", the project page has them all. */
const UNIT_CHIPS = 3;

function ProjectsSkeleton() {
    return (
        <div className="agent-pf__projects" aria-busy="true">
            {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="agent-pf__panel agent-pf__project">
                    <div className="dr-skeleton" style={{ height: 140, borderRadius: 12 }} />
                    <div className="dr-skeleton" style={{ height: 16, width: "60%", borderRadius: 6 }} />
                    <div className="dr-skeleton" style={{ height: 12, width: "80%", borderRadius: 6 }} />
                </div>
            ))}
        </div>
    );
}

function initialsOf(name: string): string {
    return name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((word) => word.charAt(0).toUpperCase())
        .join("");
}

/** Who builds it: the developer's logo (their initials when there is none) and name. */
function DeveloperLine({ name, logo }: { name: string; logo: string | null }) {
    return (
        <span className="agent-pf__developer">
            <span className="agent-pf__logo" aria-hidden="true">
                {logo ? <img src={logo} alt="" loading="lazy" decoding="async" /> : initialsOf(name)}
            </span>
            <span className="agent-pf__developer-name">{name}</span>
        </span>
    );
}

interface ProjectsViewProps {
    filters: ProjectFilters;
    projects?: ProjectsPayload;
}

/**
 * Projects (L7-20): developer projects, twelve to a page. A card stays a
 * summary: photo, status, developer with logo, where, price and handover, and
 * a few unit types with how many are left. Everything else is on the
 * project's own page. The exposé opens the Projects page's own dialog. Asking
 * a developer about a whole project does not exist in the CRM (availability
 * requests are per listing), so that button is held and marked New.
 */
export default function ProjectsView({ filters, projects }: ProjectsViewProps) {
    const { t, locale } = useTranslation();
    const [expose, setExpose] = useState<ExposeTarget | null>(null);

    const anyFilter = Object.values(filters).some(Boolean);

    const card = (project: PortfolioProject) => {
        const meta = [
            project.starting_price !== null ? t("pages.agent_workspace.portfolio.projects.from", { price: formatFrom(project.starting_price, project.currency) }) : null,
            project.completion_date
                ? t("pages.agent_workspace.portfolio.projects.handover", { date: new Date(project.completion_date).toLocaleDateString(intlLocale(locale), { month: "short", year: "numeric", timeZone: "UTC" }) })
                : null,
        ].filter(Boolean);
        const shown = project.unit_types.slice(0, UNIT_CHIPS);
        const hidden = project.unit_types.length - shown.length;

        return (
            <article key={project.id} className="agent-pf__panel agent-pf__project">
                <span className="agent-pf__thumb" aria-hidden="true">
                    {project.thumbnail ? <img src={project.thumbnail} alt="" loading="lazy" decoding="async" /> : <Icon name="building" size={32} />}
                    {project.construction_status ? (
                        <span className={`agent-pf__status agent-pf__status--${project.construction_status === "complete" ? "ready" : "building"}`}>
                            {t(`pages.agent_workspace.portfolio.projects.status.${project.construction_status}`)}
                        </span>
                    ) : null}
                </span>

                <div className="agent-pf__project-body">
                    <h2 title={project.name}>{project.name}</h2>
                    {project.developer ? <DeveloperLine name={project.developer} logo={project.developer_logo} /> : null}
                    {project.location ? (
                        <p className="agent-pf__where">
                            <Icon name="map-pin" size={12} />
                            <span>{project.location}</span>
                        </p>
                    ) : null}
                    {meta.length > 0 ? <p className="agent-pf__line">{meta.join(" · ")}</p> : null}

                    {shown.length > 0 ? (
                        <ul className="agent-pf__units" aria-label={t("pages.agent_workspace.portfolio.projects.units")}>
                            {shown.map((unit) => (
                                <li key={unit.id} className={`agent-pf__unit${unit.available <= 0 ? " is-out" : ""}`} title={t("pages.agent_workspace.portfolio.projects.available", { available: unit.available, total: unit.total })}>
                                    <b>{unit.label}</b>
                                    <span>{unit.available}</span>
                                </li>
                            ))}
                            {hidden > 0 ? <li className="agent-pf__unit agent-pf__unit--more">{t("pages.agent_workspace.portfolio.projects.more_units", { count: hidden })}</li> : null}
                        </ul>
                    ) : null}
                </div>

                <footer className="agent-pf__project-foot">
                    <a className="dr-btn dr-btn-sm dr-btn-ghost" href={route("developer-projects.show", project.id)}>
                        {t("pages.agent_workspace.portfolio.projects.open")}
                    </a>
                    <Button size="sm" className="agent-btn-soft" icon={<Icon name="file-text" size={13} />} onClick={() => setExpose({ kind: "developer_project", id: project.id, title: project.name, subtitle: project.developer ?? undefined })}>
                        {t("pages.agent_workspace.portfolio.projects.expose")}
                    </Button>
                    <span className="agent-pf__held">
                        <Button size="sm" variant="ghost" disabled title={t("pages.agent_workspace.portfolio.projects.ask_held")}>
                            {t("pages.agent_workspace.portfolio.projects.ask")}
                        </Button>
                        <span className="agent-pf__new">{t("pages.agent_workspace.portfolio.new")}</span>
                    </span>
                </footer>
            </article>
        );
    };

    return (
        <Deferred data="projects" fallback={<ProjectsSkeleton />}>
            {projects && projects.items.length > 0 ? (
                <>
                    <div className="agent-pf__projects">{projects.items.map(card)}</div>
                    <AgentPager
                        page={projects.page}
                        lastPage={projects.last_page}
                        from={projects.from}
                        to={projects.to}
                        total={projects.total}
                        onPage={(page) => visitList("agent.portfolio.projects", filters, page)}
                        label={t("pages.agent_workspace.portfolio.projects.pages")}
                    />
                </>
            ) : (
                <section className="agent-pf__panel">
                    <EmptyState
                        icon="building"
                        title={t("pages.agent_workspace.portfolio.projects.empty_title")}
                        description={t(anyFilter ? "pages.agent_workspace.portfolio.projects.empty_filtered" : "pages.agent_workspace.portfolio.projects.empty_description")}
                    />
                </section>
            )}
            {expose ? (
                <Suspense fallback={null}>
                    <PortfolioExposeModal target={expose} onClose={() => setExpose(null)} />
                </Suspense>
            ) : null}
        </Deferred>
    );
}
