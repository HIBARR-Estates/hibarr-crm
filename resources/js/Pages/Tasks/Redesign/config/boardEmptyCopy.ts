/**
 * Per-column empty-state copy. Keyed by column slug so each lane says
 * something encouraging rather than a flat "no tasks". English source
 * strings — wrap in `td()` at the render site.
 */
export const BOARD_EMPTY_COPY: Record<
    string,
    { line: string; hint: string }
> = {
    to_do: {
        line: "Nothing waiting here",
        hint: "A clean backlog is a rare and beautiful thing.",
    },
    incomplete: {
        line: "Nothing waiting here",
        hint: "A clean backlog is a rare and beautiful thing.",
    },
    in_progress: {
        line: "Nothing in flight",
        hint: "Drag something over when you're ready to start.",
    },
    waiting: {
        line: "Nobody's blocked",
        hint: "No one is waiting on anyone. Enjoy it.",
    },
    done: {
        line: "No wins logged yet",
        hint: "Finish something and watch this fill up.",
    },
};

export const BOARD_EMPTY_DEFAULT = {
    line: "This lane is clear",
    hint: "Drag a card here to move it.",
};

/** Every empty lane renders at this height, so the columns line up. */
export const BOARD_EMPTY_STATE_HEIGHT = 152;
