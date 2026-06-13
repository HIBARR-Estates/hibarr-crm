<?php

namespace App\Services;

use App\Models\LeadLifecycleStatus;
use Illuminate\Support\Collection;

class LeadLifecycleStatusService
{
    public function listForCompany(int $companyId): Collection
    {
        return LeadLifecycleStatus::query()
            ->where('company_id', $companyId)
            ->withCount('leads')
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();
    }

    public function resolveDefaultForCompany(int $companyId): ?LeadLifecycleStatus
    {
        return LeadLifecycleStatus::findByKey($companyId, LeadLifecycleStatus::DEFAULT_KEY);
    }

    public function isInUse(LeadLifecycleStatus $status): bool
    {
        return $status->leads()->exists();
    }

    public function update(LeadLifecycleStatus $status, array $data): LeadLifecycleStatus
    {
        $status->update([
            'label' => $data['label'],
            'description' => $data['description'] ?? null,
            'label_color' => $data['label_color'],
            'sort_order' => (int) $data['sort_order'],
        ]);

        return $status->fresh();
    }
}
