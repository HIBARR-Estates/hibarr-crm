import { Icon } from "@/Components/Redesign";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { formatCompanyDate } from "@/lib/companyDateTime";
import type { Deal } from "@/Types/api/deals";
import {
    formatMoneyAmount,
    resolveCurrencyDisplay,
    useCompanyCurrency,
} from "../../../adapters/currencyAdapter";

interface DealCardProps {
    deal: Deal;
    onClick?: () => void;
    /**
     * Destination for the card. Given one, the card is a real anchor, so the
     * browser supplies "Open link in new tab" in the right-click menu, plus
     * ctrl/cmd- and middle-click. A plain left click is still intercepted and
     * handed to `onClick`, keeping the in-app (no full reload) navigation.
     */
    href?: string;
}

function StagePill({ name, color }: { name: string; color?: string | null }) {
    const accent = color?.trim() || "#1a6bb5";
    return (
        <span
            className="v2-quick-stat-stage"
            style={{
                color: accent,
                background: `${accent}18`,
                borderColor: `${accent}44`,
            }}
        >
            {name}
        </span>
    );
}

/** One label/value pair in the card's secondary detail grid. */
function DetailItem({
    label,
    value,
    tone,
}: {
    label: string;
    value: string;
    tone?: "muted" | "alert";
}) {
    return (
        <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-[#9ca3af]">
                {label}
            </div>
            <div
                className={`truncate text-[12px] leading-snug ${
                    tone === "alert"
                        ? "font-semibold text-[#c2410c]"
                        : tone === "muted"
                          ? "text-[#9ca3af]"
                          : "text-[#374151]"
                }`}
                title={value}
            >
                {value}
            </div>
        </div>
    );
}

export default function DealCard({ deal, onClick, href }: DealCardProps) {
    const { td } = useTd();
    const companyCurrency = useCompanyCurrency();

    const pipelineName = deal.pipeline?.name?.trim() || null;
    const stageName = deal.lead_stage?.name?.trim() || null;
    const stageColor = deal.lead_stage?.label_color ?? null;
    const categoryName = deal.category?.category_name?.trim() || null;
    const agentName =
        deal.lead_agent?.user?.name?.trim() ||
        deal.agent?.user?.name?.trim() ||
        null;

    const value = deal.value ?? deal.calculated_value ?? deal.manual_value;
    const valueLabel =
        value == null
            ? "—"
            : formatMoneyAmount(
                  Number(value),
                  resolveCurrencyDisplay(deal.currency, companyCurrency),
                  "symbol",
              );

    // Package is one of the three headline facts, so it gets its own row and
    // degrades in steps: named packages -> a property count -> "No package".
    const packageNames = (deal.packages ?? [])
        .map((pkg) => pkg.name?.trim())
        .filter((name): name is string => Boolean(name));
    const propertyCount = deal.products_count ?? deal.products?.length ?? 0;
    const packageLabel = packageNames.length
        ? packageNames.join(", ")
        : propertyCount > 0
          ? `${propertyCount} ${td(
                propertyCount === 1 ? "property" : "properties",
                { source: "en" },
            )}`
          : td("No package", { source: "en" });
    const packageEmpty = packageNames.length === 0 && propertyCount === 0;

    const outcome =
        deal.outcome_status === "won"
            ? td("Won", { source: "en" })
            : deal.outcome_status === "lost"
              ? td("Lost", { source: "en" })
              : null;

    const followUpRaw = deal.next_follow_up_date ?? deal.next_follow_up ?? null;
    const followUpDate = followUpRaw ? new Date(followUpRaw) : null;
    const followUpOverdue =
        followUpDate != null &&
        !Number.isNaN(followUpDate.getTime()) &&
        followUpDate.getTime() < Date.now() &&
        !outcome;

    // A fixed set of columns in a fixed order, every one always rendered —
    // that is what keeps the detail columns lined up from card to card. A
    // deal missing a value shows a muted dash rather than collapsing the
    // column and shifting everything after it.
    const details: Array<{
        label: string;
        value: string;
        tone?: "muted" | "alert";
    }> = [
        {
            label: td("Agent", { source: "en" }),
            value: agentName ?? "—",
            tone: agentName ? undefined : "muted",
        },
        {
            label: td("Category", { source: "en" }),
            value: categoryName ?? "—",
            tone: categoryName ? undefined : "muted",
        },
        {
            label: td("Next follow-up", { source: "en" }),
            value: followUpRaw ? formatCompanyDate(followUpRaw) : "—",
            tone: followUpRaw
                ? followUpOverdue
                    ? "alert"
                    : undefined
                : "muted",
        },
        {
            label: td("Close date", { source: "en" }),
            value: deal.close_date ? formatCompanyDate(deal.close_date) : "—",
            tone: deal.close_date ? undefined : "muted",
        },
        {
            label: td("Created", { source: "en" }),
            value: deal.created_at ? formatCompanyDate(deal.created_at) : "—",
            tone: deal.created_at ? undefined : "muted",
        },
    ];

    // The card is full page width, so it reads across rather than down: the
    // three headline facts occupy two tight lines on the left, the supporting
    // detail spreads into the space that was empty, and the value anchors the
    // right edge. Below `md` it stacks instead of squeezing.
    const body = (
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-6">
            <div className="min-w-0 md:flex-1">
                {/* Line 1 — deal name and where it stands. */}
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="min-w-0 truncate text-[14px] font-bold leading-snug text-[#1a1f2e]">
                        {deal.name}
                    </span>
                    {stageName ? (
                        <StagePill name={stageName} color={stageColor} />
                    ) : (
                        <span className="text-[11px] text-[#9ca3af]">
                            {td("No stage", { source: "en" })}
                        </span>
                    )}
                    {outcome ? (
                        <span
                            className={`v2-pill${
                                deal.outcome_status === "won"
                                    ? " v2-pill-teal"
                                    : " v2-pill-amber"
                            }`}
                        >
                            {outcome}
                        </span>
                    ) : null}
                </div>

                {/* Line 2 — pipeline and package, the other two headline
                    facts, on one dense line. */}
                <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[12px]">
                    <span className="flex min-w-0 items-center gap-1.5">
                        <Icon name="grid" size={12} color="#6b7280" />
                        <span className="truncate font-semibold text-[#374151]">
                            {pipelineName ??
                                td("No pipeline", { source: "en" })}
                        </span>
                    </span>
                    <span aria-hidden="true" className="text-[#d1d5db]">
                        ·
                    </span>
                    <span className="flex min-w-0 items-center gap-1.5">
                        <Icon
                            name="layers"
                            size={12}
                            color={packageEmpty ? "#9ca3af" : "#6b7280"}
                        />
                        <span
                            className={`truncate ${
                                packageEmpty
                                    ? "italic text-[#9ca3af]"
                                    : "font-medium text-[#374151]"
                            }`}
                            title={packageLabel}
                        >
                            {packageLabel}
                        </span>
                    </span>
                </div>
            </div>

            {/* Supporting detail, filling the width the card used to waste.
                Fixed-width track (not wrapping flex) so column 1 of one card
                sits directly above column 1 of the next. */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 md:w-[520px] md:shrink-0 md:grid-cols-5">
                {details.map((detail) => (
                    <DetailItem
                        key={detail.label}
                        label={detail.label}
                        value={detail.value}
                        tone={detail.tone}
                    />
                ))}
            </div>

            <span className="shrink-0 text-[15px] font-bold tabular-nums text-[#1a6bb5] md:w-[104px] md:text-right">
                {valueLabel}
            </span>
        </div>
    );

    const className = "v2-deal-card mb-2 block w-full cursor-pointer text-left";

    if (href) {
        return (
            <a
                href={href}
                className={className}
                onClick={(event) => {
                    // Let the browser handle anything that means "somewhere
                    // else": new tab/window, or a download.
                    if (
                        !onClick ||
                        event.defaultPrevented ||
                        event.button !== 0 ||
                        event.metaKey ||
                        event.ctrlKey ||
                        event.shiftKey ||
                        event.altKey
                    ) {
                        return;
                    }
                    event.preventDefault();
                    onClick();
                }}
            >
                {body}
            </a>
        );
    }

    return (
        <button type="button" className={className} onClick={onClick}>
            {body}
        </button>
    );
}
