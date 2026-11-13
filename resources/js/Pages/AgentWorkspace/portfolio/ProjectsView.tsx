import { lazy, Suspense, useState } from "react";
import { Deferred } from "@inertiajs/react";
import EmptyState from "@/Components/Redesign/primitives/EmptyState";
import useTranslation from "@/Hooks/useTranslation";
import { formatFrom, humanize, intlLocale } from "./format";
import type { ExposeTarget } from "./PortfolioExposeModal";
import type { PortfolioProject } from "./types";

const PortfolioExposeModal = lazy(() => import("./PortfolioExposeModal"));

function ProjectsSkeleton() {
    return (
        <div className="agent-pf__projects" aria-busy="true">
            {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="agent-pf__panel">
                    <div className="dr-skeleton" style={{ height: 16, width: "40%", borderRadius: 6 }} />
                    <div className="dr-skeleton" style={{ height: 12, width: "70%", borderRadius: 6, marginTop: 10 }} />
                    <div className="dr-skeleton" style={{ height: 40, borderRadius: 10, marginTop: 14 }} />
                </div>
            ))}
        </div>
    );
}

/** A unit type's stock reads grey at none left and amber when few are left (a fifth or fewer). */
function stockTone(available: number, total: number): "out" | "low" | "ok" {
    if (available <= 0) return "out";
    return total > 0 && available / total <= 0.2 ? "low" : "ok";
}

/**
 * Projects (L7-20): developer projects with how many units of each type are
 * left (a unit type's quantity minus what has sold). The exposé opens the
 * Projects page's own dialog. Asking a developer about a whole project does
 * not exist in the CRM (availability requests are per listing), so that
 * button is held and marked New.
 */
export default function ProjectsView({ projects }: { projects?: PortfolioProject[] }) {
    const { t, locale } = useTranslation();
    const [expose, setExpose] = useState<ExposeTarget | null>(null);

    return (
        <Deferred data="projects" fallback={<ProjectsSkeleton />}>
            {projects && projects.length > 0 ? (
                <div className="agent-pf__projects">
                    {projects.map((project) => {
                        const meta = [
                            project.location,
                            project.developer,
                            project.starting_price !== null ? t("pages.agent_workspace.portfolio.projects.from", { price: formatFrom(project.starting_price, project.currency) }) : null,
                            project.completion_date ? t("pages.agent_workspace.portfolio.projects.handover", { date: new Date(project.completion_date).toLocaleDateString(intlLocale(locale), { month: "short", year: "numeric" }) }) : null,
                        ].filter(Boolean);

                        return (
                            <article key={project.id} className="agent-pf__panel agent-pf__project">
                                <header className="agent-pf__project-head">
                                    <h2>{project.name}</h2>
                                    {project.construction_status ? <span className="agent-pf__status">{humanize(project.construction_status)}</span> : null}
                                </header>
                                <p className="agent-pf__line">{meta.join(" · ")}</p>
                                <ul className="agent-pf__units">
                                    {project.unit_types.map((unit) => (
                                        <li key={unit.id} className={`agent-pf__unit agent-pf__unit--${stockTone(unit.available, unit.total)}`}>
                                            <b>{unit.label}</b>
                                            <span>{t("pages.agent_workspace.portfolio.projects.available", { available: unit.available, total: unit.total })}</span>
                                        </li>
                                    ))}
                                </ul>
                                <footer className="agent-pf__project-foot">
                                    <button
                                        type="button"
                                        className="dr-btn dr-btn-sm dr-btn-ghost"
                                        onClick={() => setExpose({ kind: "developer_project", id: project.id, title: project.name, subtitle: project.developer ?? undefined })}
                                    >
                                        {t("pages.agent_workspace.portfolio.projects.expose")}
                                    </button>
                                    <span className="agent-pf__held">
                                        <button type="button" className="dr-btn dr-btn-sm dr-btn-ghost" disabled title={t("pages.agent_workspace.portfolio.projects.ask_held")}>
                                            {t("pages.agent_workspace.portfolio.projects.ask")}
                                        </button>
                                        <span className="agent-pf__new">{t("pages.agent_workspace.portfolio.new")}</span>
                                    </span>
                                </footer>
                            </article>
                        );
                    })}
                </div>
            ) : (
                <section className="agent-pf__panel">
                    <EmptyState icon="building" title={t("pages.agent_workspace.portfolio.projects.empty_title")} description={t("pages.agent_workspace.portfolio.projects.empty_description")} />
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
