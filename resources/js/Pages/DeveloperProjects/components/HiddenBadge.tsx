import { Tag } from "antd";

interface HiddenBadgeProps {
    className?: string;
    /** When true, project is hidden because its parent developer is hidden */
    inherited?: boolean;
}

/**
 * Muted "Hidden" pill for users who can still see restricted developers/projects.
 */
const HiddenBadge = ({ className, inherited = false }: HiddenBadgeProps) => (
    <Tag
        className={className}
        color="default"
        style={{ margin: 0, fontSize: 11, lineHeight: "18px" }}
    >
        {inherited ? "Hidden via developer" : "Hidden"}
    </Tag>
);

export default HiddenBadge;
