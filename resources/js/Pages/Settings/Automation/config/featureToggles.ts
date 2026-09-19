/**
 * Build-time toggles for automation UI that is written and working but not
 * being shown yet. Flip a flag to true to bring the feature back — nothing
 * else needs changing.
 */

/**
 * The "Fired for" panel on an automation's detail page (which records it ran
 * against, with each record's own run tally) plus its matching stat tile.
 *
 * Hidden for now by request. While it's off the stats endpoint isn't asked
 * for the breakdown at all, so nothing pays for the extra grouping query
 * either — see useAutomationStats and DealAutomationController::stats().
 */
export const SHOW_FIRED_FOR = false;
