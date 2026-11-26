import { useMemo, useState } from "react";
import Button from "@/Components/Redesign/primitives/Button";
import ConfirmDialog from "@/Components/Redesign/primitives/ConfirmDialog";
import Drawer from "@/Components/Redesign/primitives/Drawer";
import Icon from "@/Components/Redesign/primitives/Icon";
import Segmented from "@/Components/Redesign/primitives/Segmented";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import type { LeadContactFile } from "@/Types/api/file";
import type { LeadFinancials } from "../../hooks/useLeadFinancials";
import { draftChangeCounts, formatDate, groupsForEditing } from "../../adapters/financialFormat";
import { RoleBadge, useSourceLabel } from "./FinancialBits";
import FinancialLineEditor from "./FinancialLineEditor";
import type { FinDraft, FinSource, FinWorkspace } from "./types";

const EDITABLE_SOURCES: FinSource[] = ["call", "consultation", "client_form", "manual"];

interface FinancialCollectDrawerProps {
    open: boolean;
    financials: LeadFinancials;
    draft: FinDraft;
    workspace: FinWorkspace;
    files: LeadContactFile[];
    onClose: () => void;
    onReview: () => void;
}

/**
 * The guided collection drawer: every active kind with its lines, pre-filled
 * from the last final assessment (marked "copied" until touched), saved to the
 * draft as you go. Nothing reaches filters, automations or the API until the
 * draft is finalised.
 */
export default function FinancialCollectDrawer({
    open,
    financials,
    draft,
    workspace,
    files,
    onClose,
    onReview,
}: FinancialCollectDrawerProps) {
    const { t } = useTranslation();
    const { td } = useTd();
    const sourceLabel = useSourceLabel();
    const [menuKind, setMenuKind] = useState<string | null>(null);
    const [confirmDiscard, setConfirmDiscard] = useState(false);

    const { options, settings } = workspace;
    const groups = useMemo(() => groupsForEditing(draft.lines, options.kinds), [draft.lines, options.kinds]);
    const counts = useMemo(() => draftChangeCounts(draft.lines), [draft.lines]);
    const copiedFrom = workspace.current?.as_of_date ?? null;
    const sources = EDITABLE_SOURCES.includes(draft.source) ? EDITABLE_SOURCES : [...EDITABLE_SOURCES, draft.source];
    const saving = financials.pending !== null;

    const addLine = async (typeKey: string) => {
        setMenuKind(null);
        await financials.addLine(typeKey, { amount: 0 });
    };

    return (
        <>
            <Drawer
                open={open}
                title={workspace.current ? t("pages.leads.financials.drawer.title_update") : t("pages.leads.financials.drawer.title_new")}
                subtitle={
                    copiedFrom
                        ? t("pages.leads.financials.drawer.subtitle_copied", { date: formatDate(copiedFrom) })
                        : t("pages.leads.financials.drawer.subtitle_blank")
                }
                onClose={onClose}
                width={720}
                footer={
                    <>
                        <span style={{ flex: "1 1 160px", fontSize: 13, color: T.TEXT_MUTED }} role="status">
                            {saving
                                ? t("pages.leads.financials.drawer.saving")
                                : t("pages.leads.financials.drawer.saved", {
                                      edited: counts.edited,
                                      added: counts.new,
                                      unchanged: counts.carried,
                                  })}
                        </span>
                        <Button variant="ghost" onClick={() => setConfirmDiscard(true)} style={{ color: T.RED }}>
                            {t("pages.leads.financials.drawer.discard")}
                        </Button>
                        <Button variant="ghost" onClick={onClose}>
                            {t("pages.leads.financials.drawer.close")}
                        </Button>
                        <Button variant="primary" onClick={onReview} disabled={draft.lines.length === 0 || saving}>
                            {t("pages.leads.financials.drawer.review")}
                        </Button>
                    </>
                }
            >
                <div className="flex flex-col" style={{ gap: 18 }}>
                    <div
                        style={{
                            padding: "10px 14px",
                            borderRadius: 10,
                            background: T.BLUE_WASH,
                            border: `1px solid ${T.BLUE_MID}`,
                            fontSize: 13,
                            color: T.GRAY_DARKER,
                        }}
                    >
                        {t("pages.leads.financials.drawer.intro")}
                    </div>

                    {financials.failure?.message && (
                        <div role="alert" style={{ padding: "10px 14px", borderRadius: 10, background: T.RED_SOFT, border: `1px solid ${T.RED_MID}`, color: T.RED, fontSize: 13 }}>
                            {financials.failure.message}
                        </div>
                    )}

                    <div className="flex flex-wrap items-end" style={{ gap: 14 }}>
                        <div style={{ flex: "1 1 280px", minWidth: 0 }}>
                            <span style={{ display: "block", marginBottom: 6, fontSize: 12, fontWeight: 600, color: T.TEXT_MUTED }}>
                                {t("pages.leads.financials.drawer.source")}
                            </span>
                            <Segmented<FinSource>
                                value={draft.source}
                                ariaLabel={t("pages.leads.financials.drawer.source")}
                                fullWidth
                                options={sources.map((value) => ({ value, label: sourceLabel(value) }))}
                                onChange={(value) => void financials.updateDraft({ source: value })}
                            />
                        </div>
                        <div style={{ flex: "0 1 170px" }}>
                            <label htmlFor="fin-as-of" style={{ display: "block", marginBottom: 6, fontSize: 12, fontWeight: 600, color: T.TEXT_MUTED }}>
                                {t("pages.leads.financials.drawer.as_of")}
                            </label>
                            <input
                                id="fin-as-of"
                                type="date"
                                className="dr-input"
                                value={draft.as_of_date}
                                onChange={(event) => event.target.value && void financials.updateDraft({ as_of_date: event.target.value })}
                            />
                        </div>
                        <div style={{ flex: "0 1 110px" }}>
                            <span style={{ display: "block", marginBottom: 6, fontSize: 12, fontWeight: 600, color: T.TEXT_MUTED }}>
                                {t("pages.leads.financials.drawer.reported_in")}
                            </span>
                            <div className="dr-input" style={{ display: "flex", alignItems: "center", background: T.SURFACE_2 }}>
                                {draft.currency}
                            </div>
                        </div>
                    </div>

                    {groups.map((group) => {
                        const kind = options.kinds.find((entry) => entry.key === group.kindKey);
                        const menuOpen = menuKind === group.kindKey;
                        return (
                            <section key={group.kindKey} style={{ border: `1px solid ${T.BORDER}`, borderRadius: 12 }}>
                                <header
                                    className="flex flex-wrap items-center"
                                    style={{ gap: "6px 10px", padding: "10px 14px", background: T.SURFACE_SUBTLE, borderBottom: `1px solid ${T.BORDER_SOFT}`, borderRadius: "12px 12px 0 0" }}
                                >
                                    <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{td(group.kindLabel, { source: "en" })}</h3>
                                    <RoleBadge role={group.role} />
                                    {kind && kind.types.length > 0 && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="ml-auto"
                                            icon={<Icon name="plus" size={14} />}
                                            aria-haspopup="menu"
                                            aria-expanded={menuOpen}
                                            onClick={() => setMenuKind(menuOpen ? null : group.kindKey)}
                                        >
                                            {t("pages.leads.financials.drawer.add_line")}
                                        </Button>
                                    )}
                                </header>

                                {menuOpen && kind && (
                                    <div
                                        role="menu"
                                        aria-label={t("pages.leads.financials.drawer.types_in", { kind: td(kind.label, { source: "en" }) })}
                                        style={{ margin: "10px 14px 0", padding: 6, border: `1px solid ${T.BLUE_MID}`, borderRadius: 10, background: T.WHITE, boxShadow: "0 8px 24px rgba(22,41,77,0.12)" }}
                                    >
                                        {kind.types.map((type) => (
                                            <button
                                                key={type.key}
                                                type="button"
                                                role="menuitem"
                                                onClick={() => void addLine(type.key)}
                                                style={{ display: "block", width: "100%", minHeight: 38, padding: "0 10px", border: 0, borderRadius: 6, background: "transparent", cursor: "pointer", textAlign: "left", fontSize: 14, color: T.TEXT }}
                                            >
                                                {td(type.label, { source: "en" })}
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {group.lines.length === 0 ? (
                                    <p style={{ margin: 0, padding: "12px 14px", fontSize: 13, color: T.TEXT_MUTED }}>
                                        {t("pages.leads.financials.drawer.no_lines")}
                                    </p>
                                ) : (
                                    group.lines.map((line) => (
                                        <FinancialLineEditor
                                            key={line.id}
                                            line={line}
                                            baseCurrency={draft.currency}
                                            copiedFrom={copiedFrom}
                                            fiatCurrencies={options.fiat_currencies}
                                            cryptoCurrencies={options.crypto_currencies}
                                            files={files}
                                            onChange={(lineId, input) => void financials.updateLine(lineId, input)}
                                            onRemove={(lineId) => void financials.removeLine(lineId)}
                                        />
                                    ))
                                )}
                            </section>
                        );
                    })}

                    {!settings.crypto_provider_ready && draft.lines.some((line) => options.crypto_currencies.includes(line.currency)) && (
                        <p style={{ margin: 0, fontSize: 12, color: T.AMBER }}>{t("pages.leads.financials.drawer.no_provider")}</p>
                    )}
                </div>
            </Drawer>

            <ConfirmDialog
                open={confirmDiscard}
                title={t("pages.leads.financials.drawer.discard")}
                message={t("pages.leads.financials.drawer.discard_message")}
                confirmLabel={t("pages.leads.financials.drawer.discard")}
                danger
                confirmLoading={financials.pending === "discard"}
                zIndex={1400}
                onCancel={() => setConfirmDiscard(false)}
                onConfirm={async () => {
                    const ok = await financials.discardDraft();
                    setConfirmDiscard(false);
                    if (ok) onClose();
                }}
            />
        </>
    );
}
