// Run with: node --experimental-strip-types --test resources/js/__tests__/entryFields.test.mts
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { channelOptions } from "../Pages/Settings/Automation/config/entryFields.ts";

const channel = (uuid: string, name: string, parentUuid: string | null, depth: number, status = "active") => ({
    uuid,
    key: name.toLowerCase(),
    name,
    type: "consultation_booking",
    path: name,
    depth,
    parentUuid,
    status,
    tags: [],
});

describe("channelOptions", () => {
    const catalog = {
        entryChannels: [
            channel("a", "Consultation booking", null, 0),
            channel("b", "Consultation (DE)", "a", 1),
            channel("c", "Kickoff call (DE)", "b", 2, "archived"),
        ],
    } as never;

    test("names each channel by its path, with no indent marker", () => {
        const labels = channelOptions(catalog).map((option) => option.label);
        assert.deepEqual(labels, [
            "Consultation booking",
            "Consultation booking › Consultation (DE)",
            "Consultation booking › Consultation (DE) › Kickoff call (DE) (archived)",
        ]);
        assert.ok(labels.every((label) => !label.includes("·")));
    });

    test("copes with no catalog entries", () => {
        assert.deepEqual(channelOptions({} as never), []);
    });
});
