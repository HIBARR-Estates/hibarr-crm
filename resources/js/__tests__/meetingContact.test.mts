// Run with: node --experimental-strip-types --test resources/js/__tests__/meetingContact.test.mts
// Plain-Node test (relative .ts imports, partial fixtures): not part of the app type-check.
// @ts-nocheck
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
    contactRequirement,
    contactShortfall,
} from "../Components/Redesign/meeting/meetingContact.ts";

const none = { emails: [], phones: [] };
const emailOnly = { emails: ["ada@example.com"], phones: [] };
const phoneOnly = { emails: [], phones: ["+4915112345678"] };
const both = { emails: ["ada@example.com"], phones: ["+4915112345678"] };

describe("contactRequirement", () => {
    test("an online meeting is sent by email", () => {
        for (const platform of ["zoom", "zoho", "zoho_meet", "google_meet", "meet", "teams"]) {
            assert.equal(contactRequirement(platform), "email", platform);
        }
    });

    test("a phone meeting needs a number", () => {
        assert.equal(contactRequirement("phone"), "phone");
    });

    test("in person or anything else needs some way to reach them", () => {
        for (const platform of ["physical", "office", "other", "skype", ""]) {
            assert.equal(contactRequirement(platform), "any", platform);
        }
    });
});

describe("contactShortfall", () => {
    test("an online meeting with no email is held back, even with a phone", () => {
        assert.equal(contactShortfall("zoom", phoneOnly), "email");
        assert.equal(contactShortfall("google_meet", none), "email");
        assert.equal(contactShortfall("zoom", emailOnly), null);
    });

    test("a phone meeting with no number is held back, even with an email", () => {
        assert.equal(contactShortfall("phone", emailOnly), "phone");
        assert.equal(contactShortfall("phone", none), "phone");
        assert.equal(contactShortfall("phone", phoneOnly), null);
    });

    test("an in-person meeting needs either, and a lead with neither cannot be met", () => {
        assert.equal(contactShortfall("physical", none), "any");
        assert.equal(contactShortfall("physical", emailOnly), null);
        assert.equal(contactShortfall("physical", phoneOnly), null);
    });

    test("a lead with both can be met any way", () => {
        for (const platform of ["zoom", "teams", "phone", "physical", "other"]) {
            assert.equal(contactShortfall(platform, both), null, platform);
        }
    });
});
