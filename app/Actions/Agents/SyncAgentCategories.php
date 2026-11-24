<?php

namespace App\Actions\Agents;

use App\Models\LeadAgent;

/**
 * Makes a user's lead_agents rows match the categories selected for them: one
 * row per category, or a single row with no category when none is selected.
 *
 * It reconciles instead of deleting and recreating. A row for a category that
 * stays selected keeps its identity and its settings (partner status, referral
 * terms, custom rates), so saving an agent's profile can never reset what was
 * configured on them.
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

        $existing
            ->reject(fn (LeadAgent $row) => in_array(
                $row->lead_category_id === null ? null : (int) $row->lead_category_id,
                $wanted,
                true
            ))
            ->each->delete();

        // A category added to a partner is still that partner: follow the user's
        // partner row if they have one, not whichever row sorts first.
        $template = $existing->firstWhere('is_partner', true) ?? $existing->first();

        foreach ($wanted as $categoryId) {
            LeadAgent::firstOrCreate(
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
        }
    }
}
