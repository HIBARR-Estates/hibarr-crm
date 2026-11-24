// Run with: node --experimental-strip-types --test resources/js/__tests__/meetingAttendees.test.mts
// Plain-Node test (relative .ts imports, partial fixtures): not part of the app type-check.
// @ts-nocheck
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { meetingAttendees } from "../Components/Redesign/meeting/meetingAttendees.ts";

const people = [
    { id: 2, name: "Kim", email: "kim@hibarr.de", image_url: "kim.png" },
    { id: 3, name: "Lee" },
];

describe("meetingAttendees", () => {
    test("the host is listed first, ahead of the participants", () => {
        const result = meetingAttendees({
            host_id: 1,
            host: { id: 1, name: "Sam" },
            participant_users: people,
        });
        assert.deepEqual(
            result.map((person) => [person.name, person.isHost]),
            [["Sam", true], ["Kim", false], ["Lee", false]],
        );
    });

    test("participants alone no longer stand in for everybody", () => {
        const result = meetingAttendees({
            host_id: 1,
            host: { id: 1, name: "Sam" },
            participant_users: [],
        });
        assert.deepEqual(result.map((person) => person.name), ["Sam"]);
    });

    test("a host who is also among the participants is listed once", () => {
        const result = meetingAttendees({
            host_id: 2,
            host: { id: 2, name: "Kim" },
            participant_users: people,
        });
        assert.deepEqual(result.map((person) => person.id), [2, 3]);
        assert.equal(result[0].isHost, true);
        // What the participant list knew about them is not thrown away.
        assert.equal(result[0].email, "kim@hibarr.de");
    });

    test("with no host chosen the person who created it is the organizer", () => {
        const result = meetingAttendees({
            host_id: null,
            added_by: { id: 9, name: "Creator", email: "c@hibarr.de", image_url: undefined },
            participant_users: people,
        });
        assert.deepEqual(result.map((person) => [person.name, person.isHost]), [
            ["Creator", true],
            ["Kim", false],
            ["Lee", false],
        ]);
    });

    test("a host id that resolves to nobody adds nobody, and the participants stay", () => {
        const result = meetingAttendees({
            host_id: 77,
            participant_users: people,
        });
        assert.deepEqual(result.map((person) => person.name), ["Kim", "Lee"]);
        assert.ok(result.every((person) => !person.isHost));
    });

    test("nobody on the meeting at all gives an empty list", () => {
        assert.deepEqual(meetingAttendees({}), []);
    });
});
