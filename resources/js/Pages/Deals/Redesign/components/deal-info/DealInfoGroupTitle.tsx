import { ReactNode } from "react";
import { DEAL_REDESIGN_TOKENS as T } from "../../tokens";

interface DealInfoGroupTitleProps {
    children: ReactNode;
}

export default function DealInfoGroupTitle({ children }: DealInfoGroupTitleProps) {
    return (
        <div
            className="mb-2.5 pb-1.5 text-[12px] font-semibold uppercase tracking-[0.07em]"
            style={{
                color: T.TEXT_HINT,
                borderBottom: `1px solid ${T.BORDER}`,
            }}
        >
            {children}
        </div>
    );
}
