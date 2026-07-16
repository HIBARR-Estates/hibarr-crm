import { StopOutlined } from "@ant-design/icons";
import useUnitSoldOutBadgeFlags from "@/Hooks/useUnitSoldOutBadgeFlags";

export type UnitSoldOutBadgeVariant = "grid" | "modal" | "inline";

interface UnitSoldOutBadgeProps {
    soldOut?: boolean;
    className?: string;
    /**
     * "grid" — thumbnail overlay (diagonal ribbon or bottom bar, chosen by feature flag).
     * "modal" — status banner for unit detail modals (always iteration 3).
     * "inline" (default) — compact chip for tables and tag rows.
     */
    variant?: UnitSoldOutBadgeVariant;
}

export default function UnitSoldOutBadge({
    soldOut,
    className,
    variant = "inline",
}: UnitSoldOutBadgeProps) {
    const { enabled, gridVariant } = useUnitSoldOutBadgeFlags();

    if (!soldOut || !enabled) {
        return null;
    }

    if (variant === "grid") {
        if (gridVariant === "diagonal") {
            return (
                <div className="absolute top-0 right-0 z-20 w-[110px] h-[110px] overflow-hidden pointer-events-none">
                    <div className="absolute top-5 -right-8 w-[150px] rotate-45 bg-red-600 py-1.5 text-center text-[11px] font-bold tracking-wide text-white shadow-md">
                        SOLD OUT
                    </div>
                </div>
            );
        }

        return (
            <div className="absolute inset-x-0 bottom-0 z-20 flex items-center justify-center gap-1.5 bg-red-600/95 px-3 py-2 text-xs font-bold tracking-wide text-white">
                <StopOutlined />
                SOLD OUT
            </div>
        );
    }

    if (variant === "modal") {
        return (
            <div
                className={`flex items-center gap-2 rounded-r-md border-l-4 border-red-600 bg-red-50 px-3.5 py-2 text-[13px] font-bold text-red-800 ${className ?? ""}`}
            >
                <StopOutlined className="shrink-0 text-[15px]" />
                This unit is sold out
            </div>
        );
    }

    return (
        <span
            className={`inline-flex items-center gap-1 rounded-md border border-red-600 bg-white px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-red-600 ${className ?? ""}`}
        >
            SOLD OUT
        </span>
    );
}
