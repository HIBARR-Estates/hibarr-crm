import { ReactNode } from "react";
import { DEAL_REDESIGN_TOKENS as T } from "../../tokens";

interface DealInfoGroupTitleProps {
    children: ReactNode;
}

export default function DealInfoGroupTitle({ children }: DealInfoGroupTitleProps) {
    return (
        <div
            className="mb-2.5 pb-1.5 text-[13px] font-semibold uppercase tracking-wider text-black"
            style={{
                borderBottom: `1px solid ${T.BORDER}`,
            }}
        >
            {children}
        </div>
    );
}
