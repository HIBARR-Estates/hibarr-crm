import { Avatar, Table, Tag, Tooltip } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useTd } from "@/Hooks/useDynamicTranslation";

export interface LeaderboardRow {
    agent_id: number;
    name: string;
    image?: string | null;
    won: number;
    lost: number;
    open: number;
    /** null when nothing has been decided yet — not the same as 0%. */
    win_rate: number | null;
    /** null when no lead of theirs has both an assignment and a contact stamp. */
    avg_response_hours: number | null;
}

interface LeaderboardTableProps {
    rows: LeaderboardRow[];
}

/**
 * Per-agent comparison — the coaching surface, and the one panel that genuinely
 * differs from the other views.
 *
 * Missing values render as "—" rather than 0. An agent with no closed deals has
 * no win rate; showing 0% would read as failure instead of absence of data.
 */
export default function LeaderboardTable({ rows }: LeaderboardTableProps) {
    const { td } = useTd();

    const columns: ColumnsType<LeaderboardRow> = [
        {
            title: td("Agent"),
            dataIndex: "name",
            key: "name",
            render: (name: string, row) => (
                <div className="flex items-center gap-2">
                    <Avatar size={24} src={row.image || undefined}>
                        {name?.charAt(0)?.toUpperCase()}
                    </Avatar>
                    <span className="truncate">{name}</span>
                </div>
            ),
        },
        {
            title: td("Won"),
            dataIndex: "won",
            key: "won",
            width: 80,
            sorter: (a, b) => a.won - b.won,
        },
        {
            title: td("Open"),
            dataIndex: "open",
            key: "open",
            width: 80,
            sorter: (a, b) => a.open - b.open,
        },
        {
            title: td("Win rate"),
            dataIndex: "win_rate",
            key: "win_rate",
            width: 110,
            sorter: (a, b) => (a.win_rate ?? -1) - (b.win_rate ?? -1),
            render: (rate: number | null) =>
                rate === null ? (
                    <Tooltip title={td("No closed deals yet")}>
                        <span className="text-slate-400">—</span>
                    </Tooltip>
                ) : (
                    <Tag color={rate >= 50 ? "green" : rate >= 25 ? "gold" : "red"}>
                        {rate}%
                    </Tag>
                ),
        },
        {
            title: td("Avg. response"),
            dataIndex: "avg_response_hours",
            key: "avg_response_hours",
            width: 140,
            sorter: (a, b) =>
                (a.avg_response_hours ?? Number.MAX_SAFE_INTEGER) -
                (b.avg_response_hours ?? Number.MAX_SAFE_INTEGER),
            render: (hours: number | null) =>
                hours === null ? (
                    <Tooltip title={td("No tracked first contact yet")}>
                        <span className="text-slate-400">—</span>
                    </Tooltip>
                ) : (
                    <span>{hours < 1 ? td("under an hour") : `${hours}h`}</span>
                ),
        },
    ];

    return (
        <Table<LeaderboardRow>
            rowKey="agent_id"
            size="small"
            columns={columns}
            dataSource={rows}
            pagination={false}
        />
    );
}
