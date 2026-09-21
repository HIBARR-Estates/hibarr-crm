import { CSSProperties, ReactNode } from "react";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign";
import { useTd } from "@/Hooks/useDynamicTranslation";

interface DashboardPanelProps {
    /**
     * Panel title. When `localize` is true (default), treated as an English
     * source string and run through td(). Pass false when the caller already
     * resolved a lang-file key via t().
     */
    title?: string;
    /** Optional caveat shown under the title, e.g. a known data limitation. */
    note?: string;
    /**
     * When false, title/note are rendered as-is (already translated via t()).
     * Defaults to true so other dashboards keep dynamic translation.
     */
    localize?: boolean;
    extra?: ReactNode;
    /** Summary line pinned to the panel's foot. */
    footer?: ReactNode;
    /**
     * Foot background. `sunken` (default) is the quiet strip; `raised` is
     * white so a filled detail block (e.g. network numbers) reads against
     * the body above it.
     */
    footerTone?: "sunken" | "raised";
    /** Drops the header/body padding so tables can run edge to edge. */
    flush?: boolean;
    /** `data-tour` selector target for the ProductTour engine. */
    dataTour?: string;
    style?: CSSProperties;
    children: ReactNode;
}

/**
 * The white card everything on these dashboards sits in.
 *
 * Inline-styled rather than Ant's Card: the surrounding pages are being moved
 * onto the redesign tokens, and Card's own header/body padding fights the
 * flush tables the team and partner views need.
 */
export default function DashboardPanel({
    title,
    note,
    localize = true,
    extra,
    footer,
    footerTone = "sunken",
    flush = false,
    dataTour,
    style,
    children,
}: DashboardPanelProps) {
    const { td } = useTd();
    const titleText = title
        ? localize
            ? td(title, { source: "en" })
            : title
        : null;
    const noteText = note
        ? localize
            ? td(note, { source: "en" })
            : note
        : null;

    return (
        <section
            {...(dataTour ? { "data-tour": dataTour } : {})}
            style={{
                background: T.SURFACE,
                border: `1px solid ${T.BORDER}`,
                borderRadius: 10,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                ...style,
            }}
        >
            {(title || extra) && (
                <header
                    style={{
                        display: "flex",
                        alignItems: "baseline",
                        justifyContent: "space-between",
                        gap: 12,
                        flexWrap: "wrap",
                        padding: "14px 18px",
                        borderBottom: `1px solid ${T.BORDER_SOFT}`,
                    }}
                >
                    <div>
                        {titleText && (
                            <h2
                                style={{
                                    margin: 0,
                                    fontSize: 16,
                                    fontWeight: 600,
                                    color: T.NAVY,
                                }}
                            >
                                {titleText}
                            </h2>
                        )}
                        {noteText && (
                            <p
                                style={{
                                    margin: "3px 0 0",
                                    fontSize: 12,
                                    color: T.TEXT_HINT,
                                }}
                            >
                                {noteText}
                            </p>
                        )}
                    </div>
                    {extra}
                </header>
            )}

            <div style={{ flex: 1, padding: flush ? 0 : "16px 18px" }}>
                {children}
            </div>

            {footer && (
                <footer
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "12px 18px",
                        background:
                            footerTone === "raised" ? T.SURFACE : T.SURFACE_2,
                        borderTop: `1px solid ${
                            footerTone === "raised" ? T.BORDER : T.BORDER_SOFT
                        }`,
                        fontSize: 14,
                        lineHeight: 1.5,
                    }}
                >
                    {footer}
                </footer>
            )}
        </section>
    );
}

/** Fallback for <Deferred> while a panel's data is in flight. */
export function PanelSkeleton({ rows = 4 }: { rows?: number }) {
    return (
        <div
            aria-hidden
            style={{ display: "flex", flexDirection: "column", gap: 10 }}
        >
            {Array.from({ length: rows }).map((_, index) => (
                <div
                    key={index}
                    className="dr-skeleton"
                    style={{
                        height: 14,
                        borderRadius: 4,
                        // Taper the rows so a skeleton doesn't read as content.
                        width: `${100 - index * 7}%`,
                    }}
                />
            ))}
        </div>
    );
}

/** Skeleton shaped like a panel, for grids that defer the whole card. */
export function CardSkeleton({ height = 120 }: { height?: number }) {
    return (
        <div
            aria-hidden
            className="dr-skeleton"
            style={{ height, borderRadius: 10 }}
        />
    );
}
