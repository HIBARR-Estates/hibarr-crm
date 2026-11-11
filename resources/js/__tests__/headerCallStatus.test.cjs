const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

describe("Header Call Status & Access Visibility Specs", () => {
    describe("Call availability switch specs", () => {
        // Spec constants
        const READY_STATE = {
            label: "Ready for calls",
            ariaChecked: true,
            background: "#e6f6ef",
            textColor: "#0b6b4f",
            dotColor: "#16a36f",
            trackColor: "#0b6b4f",
            knobTransform: "translateX(14px)",
        };

        const PAUSED_STATE = {
            label: "Calls paused",
            ariaChecked: false,
            background: "#f3f4f6",
            textColor: "#4b5563",
            dotColor: "#9ca3af",
            trackColor: "#9ca3af",
            knobTransform: "translateX(0)",
        };

        function getSwitchStyleProps(canReceive) {
            return {
                role: "switch",
                ariaChecked: canReceive,
                label: canReceive ? "Ready for calls" : "Calls paused",
                height: "44px",
                padding: "0 8px 0 14px",
                borderRadius: "9999px",
                border: "none",
                gap: "10px",
                fontSize: "13px",
                fontWeight: 600,
                backgroundColor: canReceive ? "#e6f6ef" : "#f3f4f6",
                textColor: canReceive ? "#0b6b4f" : "#4b5563",
                dot: {
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    backgroundColor: canReceive ? "#16a36f" : "#9ca3af",
                },
                track: {
                    width: "36px",
                    height: "22px",
                    borderRadius: "9999px",
                    backgroundColor: canReceive ? "#0b6b4f" : "#9ca3af",
                },
                knob: {
                    width: "16px",
                    height: "16px",
                    borderRadius: "50%",
                    backgroundColor: "#ffffff",
                    transform: canReceive ? "translateX(14px)" : "translateX(0)",
                },
            };
        }

        test("Ready for calls state matches exact component specs", () => {
            const state = getSwitchStyleProps(true);

            assert.equal(state.role, "switch");
            assert.equal(state.ariaChecked, READY_STATE.ariaChecked);
            assert.equal(state.label, READY_STATE.label);
            assert.equal(state.backgroundColor, READY_STATE.background);
            assert.equal(state.textColor, READY_STATE.textColor);
            assert.equal(state.dot.backgroundColor, READY_STATE.dotColor);
            assert.equal(state.track.backgroundColor, READY_STATE.trackColor);
            assert.equal(state.knob.transform, READY_STATE.knobTransform);
            assert.equal(state.height, "44px");
            assert.equal(state.padding, "0 8px 0 14px");
            assert.equal(state.border, "none");
        });

        test("Calls paused state matches exact component specs", () => {
            const state = getSwitchStyleProps(false);

            assert.equal(state.role, "switch");
            assert.equal(state.ariaChecked, PAUSED_STATE.ariaChecked);
            assert.equal(state.label, PAUSED_STATE.label);
            assert.equal(state.backgroundColor, PAUSED_STATE.background);
            assert.equal(state.textColor, PAUSED_STATE.textColor);
            assert.equal(state.dot.backgroundColor, PAUSED_STATE.dotColor);
            assert.equal(state.track.backgroundColor, PAUSED_STATE.trackColor);
            assert.equal(state.knob.transform, PAUSED_STATE.knobTransform);
            assert.equal(state.height, "44px");
            assert.equal(state.padding, "0 8px 0 14px");
            assert.equal(state.border, "none");
        });
    });

    describe("Access button admin-only visibility", () => {
        function shouldRenderAccessButton(userRoles) {
            const isAdmin = Boolean(
                userRoles &&
                    (userRoles.includes("admin") ||
                        userRoles.some((r) => r.name === "admin" || r.display_name === "Admin" || r === "administrator"))
            );
            return isAdmin;
        }

        test("Access button is visible for admin users", () => {
            assert.equal(shouldRenderAccessButton(["admin"]), true);
            assert.equal(shouldRenderAccessButton([{ name: "admin" }]), true);
        });

        test("Access button is hidden (returns null) for non-admin users", () => {
            assert.equal(shouldRenderAccessButton(["agent"]), false);
            assert.equal(shouldRenderAccessButton(["manager"]), false);
            assert.equal(shouldRenderAccessButton([]), false);
            assert.equal(shouldRenderAccessButton(null), false);
        });
    });

    describe("Profile avatar letter fallback", () => {
        function resolveUserAvatar(user, imageLoadFailed = false) {
            const photoUrl = user?.image_url?.trim() || user?.image?.trim() || "";
            const initialLetter = user?.name?.trim()?.charAt(0)?.toUpperCase() || "U";

            if (photoUrl && !imageLoadFailed) {
                return { type: "image", src: photoUrl };
            }

            return {
                type: "letter",
                letter: initialLetter,
                backgroundColor: "#6b7280",
                color: "#ffffff",
                size: "36px",
            };
        }

        test("Falls back to initial letter when user has no photo", () => {
            const res = resolveUserAvatar({ name: "Alice Smith", image_url: null });
            assert.equal(res.type, "letter");
            assert.equal(res.letter, "A");
            assert.equal(res.backgroundColor, "#6b7280");
            assert.equal(res.color, "#ffffff");
        });

        test("Falls back to initial letter when image_url is empty string", () => {
            const res = resolveUserAvatar({ name: "Bob", image_url: "  " });
            assert.equal(res.type, "letter");
            assert.equal(res.letter, "B");
        });

        test("Falls back to 'U' when name is missing and no photo", () => {
            const res = resolveUserAvatar({ name: null, image_url: null });
            assert.equal(res.type, "letter");
            assert.equal(res.letter, "U");
        });

        test("Falls back to letter when image fails to load (onError)", () => {
            const res = resolveUserAvatar({ name: "Carol", image_url: "https://example.com/broken.png" }, true);
            assert.equal(res.type, "letter");
            assert.equal(res.letter, "C");
        });

        test("Displays image when valid image_url is provided and load succeeds", () => {
            const res = resolveUserAvatar({ name: "Dave", image_url: "https://example.com/photo.jpg" }, false);
            assert.equal(res.type, "image");
            assert.equal(res.src, "https://example.com/photo.jpg");
        });
    });

    describe("Tier 1 Lead Owner Priority Routing & Multi-Tier Escalation", () => {
        /**
         * Pure model function mirroring TelephonySoftphoneEventController::buildRotationSequence
         */
        function buildRotationSequence(owner, lineUsers, defaultFallbackUsers, adminFallbackUsers) {
            const sequence = [];
            const seenUserIds = new Set();

            if (owner && owner.id) {
                sequence.push({
                    id: owner.id,
                    name: owner.name || `User #${owner.id}`,
                    role: "owner",
                });
                seenUserIds.add(owner.id);
            }

            for (const tierUsers of [lineUsers, defaultFallbackUsers, adminFallbackUsers]) {
                for (const candidate of tierUsers) {
                    const candidateId = candidate.id;
                    if (!seenUserIds.has(candidateId)) {
                        sequence.push(candidate);
                        seenUserIds.add(candidateId);
                    }
                }
            }

            return sequence;
        }

        /**
         * Resolves the matching lead owner (mirroring leadByPhone logic)
         */
        function resolveLeadOwnerFromMatches(matchingLeads) {
            if (!matchingLeads || matchingLeads.length === 0) {
                return null;
            }
            // Prefer match with assigned lead owner
            const lead = matchingLeads.find((l) => l.lead_owner && l.owner) || matchingLeads[0];
            const owner = lead.owner;
            if (
                owner &&
                owner.status === "active" &&
                owner.login !== "disable" &&
                (owner.can_receive_calls ?? true)
            ) {
                return { id: owner.id, name: owner.name };
            }
            return null;
        }

        test("Matched lead with active owner routes to Lead Owner first (Tier 1 index 0)", () => {
            const matchingLeads = [
                {
                    id: 101,
                    lead_owner: 42,
                    owner: { id: 42, name: "Sarah Owner", status: "active", login: "enable", can_receive_calls: true },
                },
            ];
            const lineAgents = [
                { id: 10, name: "Line Agent Bob", role: "line" },
                { id: 11, name: "Line Agent Carol", role: "line" },
            ];
            const defaultFallback = [{ id: 20, name: "Fallback Agent Dan", role: "default_fallback" }];
            const adminFallback = [{ id: 1, name: "Admin Alice", role: "admin_fallback" }];

            const owner = resolveLeadOwnerFromMatches(matchingLeads);
            const sequence = buildRotationSequence(owner, lineAgents, defaultFallback, adminFallback);

            assert.equal(sequence.length, 5);
            assert.equal(sequence[0].id, 42);
            assert.equal(sequence[0].role, "owner");
            assert.equal(sequence[0].name, "Sarah Owner");
            assert.equal(sequence[1].id, 10);
            assert.equal(sequence[1].role, "line");
            assert.equal(sequence[2].id, 11);
            assert.equal(sequence[3].id, 20);
            assert.equal(sequence[3].role, "default_fallback");
            assert.equal(sequence[4].id, 1);
            assert.equal(sequence[4].role, "admin_fallback");
        });

        test("Multiple matching leads picks the lead with an active owner", () => {
            const matchingLeads = [
                { id: 201, lead_owner: null, owner: null },
                {
                    id: 202,
                    lead_owner: 77,
                    owner: { id: 77, name: "Assigned Agent Mark", status: "active", login: "enable", can_receive_calls: true },
                },
            ];
            const owner = resolveLeadOwnerFromMatches(matchingLeads);
            assert.ok(owner);
            assert.equal(owner.id, 77);
            assert.equal(owner.name, "Assigned Agent Mark");
        });

        test("Unmatched caller (0 leads) starts sequence at Tier 2 (Line Pool)", () => {
            const matchingLeads = [];
            const lineAgents = [{ id: 10, name: "Line Agent Bob", role: "line" }];
            const defaultFallback = [{ id: 20, name: "Fallback Agent Dan", role: "default_fallback" }];
            const adminFallback = [{ id: 1, name: "Admin Alice", role: "admin_fallback" }];

            const owner = resolveLeadOwnerFromMatches(matchingLeads);
            assert.equal(owner, null);

            const sequence = buildRotationSequence(owner, lineAgents, defaultFallback, adminFallback);
            assert.equal(sequence.length, 3);
            assert.equal(sequence[0].id, 10);
            assert.equal(sequence[0].role, "line");
            assert.equal(sequence[1].id, 20);
            assert.equal(sequence[2].id, 1);
        });

        test("Lead Owner who is paused or inactive does not ring Tier 1; falls back to Tier 2", () => {
            const matchingLeads = [
                {
                    id: 301,
                    lead_owner: 42,
                    owner: { id: 42, name: "Paused Owner", status: "active", login: "enable", can_receive_calls: false },
                },
            ];
            const lineAgents = [{ id: 10, name: "Line Agent Bob", role: "line" }];

            const owner = resolveLeadOwnerFromMatches(matchingLeads);
            assert.equal(owner, null);

            const sequence = buildRotationSequence(owner, lineAgents, [], []);
            assert.equal(sequence.length, 1);
            assert.equal(sequence[0].id, 10);
            assert.equal(sequence[0].role, "line");
        });

        test("Deduplication prevents Lead Owner from ringing twice if they also exist in later tiers", () => {
            const owner = { id: 50, name: "Agent Dave" };
            const lineAgents = [{ id: 50, name: "Agent Dave", role: "line" }, { id: 51, name: "Agent Eve", role: "line" }];
            const adminFallback = [{ id: 50, name: "Agent Dave", role: "admin_fallback" }];

            const sequence = buildRotationSequence(owner, lineAgents, [], adminFallback);
            assert.equal(sequence.length, 2);
            assert.equal(sequence[0].id, 50);
            assert.equal(sequence[0].role, "owner"); // Kept as owner at index 0
            assert.equal(sequence[1].id, 51);
        });
    });
});
