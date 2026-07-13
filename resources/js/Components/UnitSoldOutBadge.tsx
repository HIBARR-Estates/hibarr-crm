import { Tag } from "antd";

interface UnitSoldOutBadgeProps {
    soldOut?: boolean;
    className?: string;
}

export default function UnitSoldOutBadge({
    soldOut,
    className,
}: UnitSoldOutBadgeProps) {
    if (!soldOut) {
        return null;
    }

    return (
        <Tag color="orange" className={className}>
            Sold Out
        </Tag>
    );
}
