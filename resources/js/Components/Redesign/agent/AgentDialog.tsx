import { useId, type ReactNode } from "react";
import Icon from "@/Components/Redesign/primitives/Icon";
import ModalShell from "@/Components/Redesign/primitives/ModalShell";

interface AgentDialogProps {
    open: boolean;
    onClose: () => void;
    title: ReactNode;
    /** Small caps line above the title ("Meeting brief"). */
    eyebrow?: ReactNode;
    /** Muted line under the title. */
    subtitle?: ReactNode;
    /** The square icon left of the title. */
    icon?: ReactNode;
    /** Buttons and pills at the right of the header, before the close button. */
    headerAside?: ReactNode;
    /** A strip of label/value cells under the header (the brief's Type / Where / With / Deal). */
    strip?: Array<{ label: ReactNode; value: ReactNode }>;
    /** Footer row; put a flex spacer in it to split left and right actions. */
    footer?: ReactNode;
    closeLabel: string;
    /** Width cap in px; the dialog is full width on a phone. */
    width?: number;
    /** A form (canvas L7-32, L7-33): white footer with the buttons on the right, and no closing on a stray backdrop click. */
    form?: boolean;
    children: ReactNode;
}

/**
 * The read-mostly dialog of the agent workspace (canvas L8-07, L8-08): a
 * header with an optional icon, eyebrow, actions and close; an optional fact
 * strip; a scrolling body; and a tinted footer. On a phone it fills the screen.
 */
export default function AgentDialog({
    open,
    onClose,
    title,
    eyebrow,
    subtitle,
    icon,
    headerAside,
    strip,
    footer,
    closeLabel,
    width = 880,
    form = false,
    children,
}: AgentDialogProps) {
    const titleId = useId();
    return (
        <ModalShell
            open={open}
            onClose={onClose}
            closeOnBackdrop={!form}
            ariaLabelledBy={titleId}
            overlayClassName="agent-dlg-overlay"
            panelClassName={form ? "agent-dlg agent-dlg--form" : "agent-dlg"}
            panelStyle={{ maxWidth: `min(${width}px, 100%)` }}
            initialFocus="panel"
            trapFocus
        >
            <div className="agent-dlg__head">
                {icon ? (
                    <span className="agent-dlg__icon" aria-hidden="true">
                        {icon}
                    </span>
                ) : null}
                <span className="agent-dlg__titles">
                    {eyebrow ? <span className="agent-dlg__eyebrow">{eyebrow}</span> : null}
                    <h2 id={titleId} className="agent-dlg__title">
                        {title}
                    </h2>
                    {subtitle ? <span className="agent-dlg__subtitle">{subtitle}</span> : null}
                </span>
                {headerAside ? <span className="agent-dlg__aside">{headerAside}</span> : null}
                <button type="button" className="agent-dlg__close" aria-label={closeLabel} onClick={onClose}>
                    <Icon name="x" size={14} />
                </button>
            </div>
            {strip && strip.length > 0 ? (
                <dl className="agent-dlg__strip">
                    {strip.map((cell, index) => (
                        <div key={index} className="agent-dlg__cell">
                            <dt>{cell.label}</dt>
                            <dd>{cell.value}</dd>
                        </div>
                    ))}
                </dl>
            ) : null}
            <div className="agent-dlg__body">{children}</div>
            {footer ? <div className="agent-dlg__foot">{footer}</div> : null}
        </ModalShell>
    );
}

/** A titled block inside an AgentDialog body. */
export function AgentDialogSection({ title, tag, children }: { title: ReactNode; tag?: ReactNode; children: ReactNode }) {
    return (
        <section className="agent-dlg__section">
            <div className="agent-dlg__section-head">
                <span className="agent-dlg__cap">{title}</span>
                {tag}
            </div>
            {children}
        </section>
    );
}
