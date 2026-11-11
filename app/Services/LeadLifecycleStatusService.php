<?php

namespace App\Services;

use App\Models\Lead;
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

    /**
     * Give a not-yet-saved lead its company's default status when it has none.
     *
     * LeadObserver::creating calls this, but saveQuietly() skips observers,
     * so any path that creates leads quietly (external API, Bitrix import)
     * must call it before saving or the lead is stored without a status.
     */
    public function applyDefaultIfMissing(Lead $lead): void
    {
        if ($lead->lead_lifecycle_status_id || ! $lead->company_id) {
            return;
        }

        $defaultStatus = $this->resolveDefaultForCompany((int) $lead->company_id);

        if ($defaultStatus) {
            $lead->lead_lifecycle_status_id = $defaultStatus->id;
        }
    }

    public function isInUse(LeadLifecycleStatus $status): bool
    {
        return $status->leads()->exists();
    }

    public function create(int $companyId, array $data): LeadLifecycleStatus
    {
        $maxSortOrder = (int) LeadLifecycleStatus::query()
            ->where('company_id', $companyId)
            ->max('sort_order');

        return LeadLifecycleStatus::create([
            'company_id' => $companyId,
            'key' => $data['key'],
            'label' => $data['label'],
            'description' => $data['description'] ?? null,
            'label_color' => $data['label_color'],
            'sort_order' => isset($data['sort_order'])
                ? (int) $data['sort_order']
                : $maxSortOrder + 1,
        ]);
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

    public function delete(LeadLifecycleStatus $status): void
    {
        if ($status->isSystemKey()) {
            throw new \InvalidArgumentException('Built-in lead statuses cannot be deleted.');
        }

        if ($this->isInUse($status)) {
            throw new \InvalidArgumentException('This lead status is assigned to leads and cannot be deleted.');
        }

        $status->delete();
    }

    /**
     * @param  list<int>  $ids
     */
    public function reorder(int $companyId, array $ids): Collection
    {
        $existingIds = LeadLifecycleStatus::query()
            ->where('company_id', $companyId)
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->all();

        if (array_diff($ids, $existingIds) !== [] || array_diff($existingIds, $ids) !== []) {
            throw new \InvalidArgumentException('Lead status order is incomplete.');
        }

        foreach ($ids as $index => $id) {
            LeadLifecycleStatus::query()
                ->where('company_id', $companyId)
                ->where('id', $id)
                ->update(['sort_order' => $index + 1]);
        }

        return $this->listForCompany($companyId);
    }
}
