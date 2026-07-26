import {
    CSSProperties,
    Ref,
    forwardRef,
    useEffect,
    useImperativeHandle,
    useLayoutEffect,
    useState,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import useTranslation from "@/Hooks/useTranslation";
import useProductTour from "./useProductTour";
import type { ProductTourProps, TourPlacement } from "./types";
import "./productTour.css";

/** Imperative handle for pages that trigger a replay from elsewhere on the page (e.g. an actions menu). */
export interface ProductTourHandle {
    restart: () => void;
}

const GAP = 14;
const PADDING = 6;
const TOOLTIP_WIDTH = 320;
// A step's target may not exist in the DOM yet this tick (e.g. its onEnter
// just switched tabs and the pane hasn't rendered) — poll a few frames
// before giving up and skipping the step.
const MAX_TARGET_WAIT_FRAMES = 20;

function computeTooltipStyle(rect: DOMRect, placement?: TourPlacement) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const spaceBelow = vh - rect.bottom - GAP;
    const spaceAbove = rect.top - GAP;
    const side: TourPlacement =
        placement ?? (spaceBelow >= 140 || spaceBelow >= spaceAbove ? "bottom" : "top");

    const style: CSSProperties = { position: "fixed", width: TOOLTIP_WIDTH };

    if (side === "top") {
        style.bottom = vh - rect.top + GAP;
    } else if (side === "left") {
        style.top = rect.top;
        style.right = vw - rect.left + GAP;
    } else if (side === "right") {
        style.top = rect.top;
        style.left = rect.right + GAP;
    } else {
        style.top = rect.bottom + GAP;
    }

    if (side === "top" || side === "bottom") {
        style.left = Math.min(Math.max(12, rect.left), vw - TOOLTIP_WIDTH - 12);
    }

    return style;
}

/**
 * Config-driven spotlight tour. Pass a `tourId` (drives cross-device
 * seen-state), a `steps` list — each step either spotlights a `target` CSS
 * selector or, if omitted, renders a centered closing card — and `labels`
 * (translation keys for the tour's own Next/Back/Done/Skip chrome).
 * `title`/`body` on each step and every `labels` value are translation keys
 * resolved via `t()`, not raw copy — this tour's instructions are static,
 * pre-translated strings in every supported language, not machine-translated
 * at render time. See resources/js/Pages/Deals/Redesign/config/dealTourSteps.ts
 * for the reference consumer.
 */
function ProductTour(
    { tourId, steps, labels }: ProductTourProps,
    ref: Ref<ProductTourHandle>,
) {
    const { t } = useTranslation();
    const { active, stepIndex, next, prev, skip, restart } = useProductTour(
        tourId,
        steps.length,
    );
    useImperativeHandle(ref, () => ({ restart }), [restart]);
    const [rect, setRect] = useState<DOMRect | null>(null);

    const step = steps[stepIndex];
    const isLast = stepIndex === steps.length - 1;
    const isFirst = stepIndex === 0;

    // Run the step's side effect (e.g. switch tabs so its target renders),
    // then locate + track that target's rect — retrying across a few frames
    // since onEnter's state update lands on the *next* render, not this one.
    useLayoutEffect(() => {
        if (!active || !step) {
            setRect(null);
            return undefined;
        }

        step.onEnter?.();

        if (!step.target) {
            setRect(null);
            return undefined;
        }

        const target = step.target;
        let cancelled = false;
        let rafId: number;
        let attempts = 0;

        const trackRect = () => {
            const el = document.querySelector(target);
            setRect(el ? el.getBoundingClientRect() : null);
        };

        const waitForTarget = () => {
            if (cancelled) return;
            const el = document.querySelector(target);
            if (el) {
                trackRect();
                return;
            }
            if (attempts >= MAX_TARGET_WAIT_FRAMES) {
                next();
                return;
            }
            attempts += 1;
            rafId = requestAnimationFrame(waitForTarget);
        };
        waitForTarget();

        window.addEventListener("scroll", trackRect, true);
        window.addEventListener("resize", trackRect);
        return () => {
            cancelled = true;
            if (rafId) cancelAnimationFrame(rafId);
            window.removeEventListener("scroll", trackRect, true);
            window.removeEventListener("resize", trackRect);
        };
    }, [active, step, next]);

    useEffect(() => {
        if (!active) return undefined;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") skip();
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [active, skip]);

    if (!active || !step || typeof document === "undefined") return null;
    if (step.target && !rect) return null;

    const tooltipStyle = rect ? computeTooltipStyle(rect, step.placement) : undefined;

    return createPortal(
        <div className="product-tour-root" role="dialog" aria-modal="true">
            {rect && (
                <>
                    <div
                        className="product-tour-scrim"
                        style={{ top: 0, left: 0, right: 0, height: Math.max(0, rect.top - PADDING) }}
                    />
                    <div
                        className="product-tour-scrim"
                        style={{ top: rect.bottom + PADDING, left: 0, right: 0, bottom: 0 }}
                    />
                    <div
                        className="product-tour-scrim"
                        style={{
                            top: rect.top - PADDING,
                            left: 0,
                            width: Math.max(0, rect.left - PADDING),
                            height: rect.height + PADDING * 2,
                        }}
                    />
                    <div
                        className="product-tour-scrim"
                        style={{
                            top: rect.top - PADDING,
                            left: rect.right + PADDING,
                            right: 0,
                            height: rect.height + PADDING * 2,
                        }}
                    />
                    <div
                        className="product-tour-ring"
                        style={{
                            top: rect.top - PADDING,
                            left: rect.left - PADDING,
                            width: rect.width + PADDING * 2,
                            height: rect.height + PADDING * 2,
                        }}
                    />
                </>
            )}
            {!rect && <div className="product-tour-scrim" style={{ inset: 0 }} />}

            <AnimatePresence mode="wait">
                <motion.div
                    key={stepIndex}
                    className={`product-tour-tooltip${rect ? "" : " product-tour-tooltip-centered"}`}
                    style={tooltipStyle}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.15 }}
                >
                    <div className="product-tour-title">{t(step.title)}</div>
                    <div className="product-tour-body">{t(step.body)}</div>
                    <div className="product-tour-footer">
                        <button type="button" className="product-tour-skip" onClick={skip}>
                            {t(labels.skip)}
                        </button>
                        <div className="product-tour-steps">
                            {stepIndex + 1} / {steps.length}
                        </div>
                        <div className="product-tour-actions">
                            {!isFirst && (
                                <button type="button" className="product-tour-btn-ghost" onClick={prev}>
                                    {t(labels.back)}
                                </button>
                            )}
                            <button type="button" className="product-tour-btn-primary" onClick={next}>
                                {isLast ? t(labels.done) : t(labels.next)}
                            </button>
                        </div>
                    </div>
                </motion.div>
            </AnimatePresence>
        </div>,
        document.body,
    );
}

export default forwardRef(ProductTour);
