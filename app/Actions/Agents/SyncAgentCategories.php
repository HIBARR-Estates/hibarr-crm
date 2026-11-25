<?php

namespace App\Actions\Agents;

use App\Models\AgentPackageCommissionRate;
use App\Models\LeadAgent;

/**
 * Makes a user's lead_agents rows match the categories selected for them: one
 * row per category, or a single row with no category when none is selected.
 *
 * It reconciles instead of deleting and recreating. A row for a category that
 * stays selected keeps its identity and its settings (partner status, referral
 * terms, custom rates), so saving an agent's profile can never reset what was
 * configured on them.
 *
 * A category the partner gains is still that partner, so it starts with the
 * partner's terms: the default referral terms and what they have on each package.
 * Package terms hang off the row, and the database removes them with it, so they
 * are read before a deselected row is deleted and carried to the rows created here.
 * That way changing a partner's only category does not wipe what they were set up on,
 * and when the row the terms were set on is removed, the partner rows that stay get
 * the packages they have no terms for yet (never overwriting terms they do have).
 */
class SyncAgentCategories
{
    /**
     * @param  array<int, int|string>  $categoryIds
     */
    public function handle(
        LeadAgent $agent,
        array $categoryIds,
        int $companyId,
        ?int $actingUserId,
        string $status = 'enabled',
    ): void {
        $addedBy = $agent->added_by ?? $actingUserId;

        $existing = LeadAgent::where('user_id', $agent->user_id)
            ->where('company_id', $companyId)
            ->get();

        $wanted = $categoryIds === []
            ? [null]
            : array_map(fn ($id) => (int) $id, $categoryIds);

        // A category added to a partner is still that partner: follow the user's
        // partner row if they have one, not whichever row sorts first.
        $template = $existing->firstWhere('is_partner', true) ?? $existing->first();

        $templateRemoved = $template !== null && ! in_array(
            $template->lead_category_id === null ? null : (int) $template->lead_category_id,
            $wanted,
            true
        );

        // Read before any row is deleted: the package terms go with the row.
        $packageTerms = $template?->is_partner
            ? AgentPackageCommissionRate::where('agent_id', $template->id)->get()
            : collect();

        $existing
            ->reject(fn (LeadAgent $row) => in_array(
                $row->lead_category_id === null ? null : (int) $row->lead_category_id,
                $wanted,
                true
            ))
            ->each->delete();

        foreach ($wanted as $categoryId) {
            $row = LeadAgent::firstOrCreate(
                [
                    'user_id' => $agent->user_id,
                    'lead_category_id' => $categoryId,
                    'company_id' => $companyId,
                ],
                [
                    'added_by' => $addedBy,
                    'last_updated_by' => $actingUserId,
                    'status' => $status,
                    'is_partner' => (bool) $template?->is_partner,
                    'referral_commission_type' => $template?->referral_commission_type,
                    'referral_commission_value' => $template?->referral_commission_value,
                ]
            );

            // A new row starts with the partner's terms. When the row they were set on
            // is the one going away, the rows that stay take them over too, so a
            // category change never leaves the partner paid nothing on a package. A
            // package a surviving row already has terms for is left as it is.
            if ($row->wasRecentlyCreated || ($templateRemoved && $row->is_partner)) {
                $this->carryPackageTerms($packageTerms, $row);
            }
        }
    }

    /**
     * @param  \Illuminate\Support\Collection<int, AgentPackageCommissionRate>  $terms
     */
    private function carryPackageTerms($terms, LeadAgent $row): void
    {
        foreach ($terms as $term) {
            AgentPackageCommissionRate::firstOrCreate(
                ['agent_id' => $row->id, 'package_id' => $term->package_id],
                [
                    'company_id' => $term->company_id,
                    'commission_type' => $term->commission_type,
                    'commission_value' => $term->commission_value,
                    'referral_commission_type' => $term->referral_commission_type,
                    'referral_commission_value' => $term->referral_commission_value,
                ]
            );
        }
    }
}
