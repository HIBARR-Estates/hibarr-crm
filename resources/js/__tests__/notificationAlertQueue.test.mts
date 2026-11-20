// Run with: node --experimental-strip-types --test resources/js/__tests__/notificationAlertQueue.test.mts
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { decideNextAlert } from "../lib/notificationAlertQueue.ts";

const alert = (id: string, urgent = false) => ({ id, urgent });

describe("decideNextAlert", () => {
    test("nothing waiting means nothing to show", () => {
        assert.deepEqual(decideNextAlert([], 3), { kind: "empty" });
    });

    test("shows the oldest waiting alert first, first in first out", () => {
        const decision = decideNextAlert([alert("a"), alert("b"), alert("c")], 3);

        assert.equal(decision.kind, "show");
        if (decision.kind !== "show") return;
        assert.equal(decision.alert.id, "a");
        assert.deepEqual(decision.rest.map((x) => x.id), ["b", "c"]);
    });

    test("exactly the threshold is still shown one by one", () => {
        const decision = decideNextAlert([alert("a"), alert("b"), alert("c")], 3);

        assert.equal(decision.kind, "show");
    });

    test("more than the threshold collapses into one summary", () => {
        const decision = decideNextAlert(
            [alert("a"), alert("b"), alert("c"), alert("d")],
            3,
        );

        assert.deepEqual(decision, { kind: "collapse", count: 4 });
    });

    test("an urgent alert jumps the queue", () => {
        const decision = decideNextAlert(
            [alert("a"), alert("b"), alert("meeting", true), alert("c")],
            3,
        );

        assert.equal(decision.kind, "show");
        if (decision.kind !== "show") return;
        assert.equal(decision.alert.id, "meeting");
        assert.deepEqual(decision.rest.map((x) => x.id), ["a", "b", "c"]);
    });

    test("urgent alerts are never folded into a summary, even in a big backlog", () => {
        const waiting = [
            alert("a"),
            alert("b"),
            alert("c"),
            alert("d"),
            alert("meeting", true),
        ];

        const first = decideNextAlert(waiting, 3);
        assert.equal(first.kind, "show");
        if (first.kind !== "show") return;
        assert.equal(first.alert.id, "meeting");

        // Once the urgent one is out of the way, the rest is a backlog again.
        assert.deepEqual(decideNextAlert(first.rest, 3), {
            kind: "collapse",
            count: 4,
        });
    });

    test("does not mutate the queue it is given", () => {
        const waiting = [alert("a"), alert("b")];
        decideNextAlert(waiting, 3);

        assert.deepEqual(waiting.map((x) => x.id), ["a", "b"]);
    });
});
