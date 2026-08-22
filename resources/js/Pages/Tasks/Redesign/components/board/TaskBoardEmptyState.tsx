import { useTd } from "@/Hooks/useDynamicTranslation";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import { TASK_ICON } from "../../config/taskDesignTokens";
import {
    BOARD_EMPTY_COPY,
    BOARD_EMPTY_DEFAULT,
    BOARD_EMPTY_STATE_HEIGHT,
} from "../../config/boardEmptyCopy";
import { TaskGlyph } from "../primitives/TaskGlyphs";

interface TaskBoardEmptyStateProps {
    slug: string;
}

export default function TaskBoardEmptyState({ slug }: TaskBoardEmptyStateProps) {
    const { td } = useTd();
    const copy = BOARD_EMPTY_COPY[slug] ?? BOARD_EMPTY_DEFAULT;

    return (
        <div
            className="flex flex-col items-center justify-center gap-2"
            style={{
                height: BOARD_EMPTY_STATE_HEIGHT,
                flexShrink: 0,
                padding: "16px 14px",
                border: `1px dashed ${T.BORDER}`,
                borderRadius: 10,
                background: "#fbfcfd",
            }}
        >
            <TaskGlyph
                d={TASK_ICON.inboxEmpty}
                size={22}
                color={T.NAVY_MID}
                strokeWidth={1.5}
            />
            <span
                style={{
                    fontSize: 15,
                    fontWeight: 600,
                    color: T.TEXT_MUTED,
                    textAlign: "center",
                }}
            >
                {td(copy.line)}
            </span>
            <span
                style={{
                    fontSize: 14,
                    color: T.TEXT_HINT,
                    textAlign: "center",
                    lineHeight: 1.45,
                }}
            >
                {td(copy.hint)}
            </span>
        </div>
    );
}
