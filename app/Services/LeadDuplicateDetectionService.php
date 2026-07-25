<?php

namespace App\Services;

use App\Models\Lead;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

class LeadDuplicateDetectionService
{
    /**
     * Find merge candidates that share an exact client_email and/or mobile/cell
     * with the given lead (same company). Soft-deleted leads are excluded by
     * SoftDeletes. Matching is raw string equality (v1 — no phone normalization).
     *
     * @return Collection<int, Lead>
     */
    public function findDuplicates(Lead $lead): Collection
    {
        $email = $this->nonEmptyString($lead->client_email);
        $mobile = $this->nonEmptyString($lead->mobile);
        $cell = $this->nonEmptyString($lead->cell);

        if ($email === null && $mobile === null && $cell === null) {
            return collect();
        }

        return Lead::query()
            ->where('company_id', $lead->company_id)
            ->where('id', '!=', $lead->id)
            ->where(function (Builder $query) use ($email, $mobile, $cell) {
                if ($email !== null) {
                    $query->orWhere('client_email', $email);
                }

                if ($mobile !== null) {
                    $query->orWhere('mobile', $mobile)
                        ->orWhere('cell', $mobile);
                }

                if ($cell !== null) {
                    $query->orWhere('mobile', $cell)
                        ->orWhere('cell', $cell);
                }
            })
            ->orderBy('id')
            ->get();
    }

    private function nonEmptyString(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $string = is_string($value) ? trim($value) : trim((string) $value);

        return $string === '' ? null : $string;
    }
}
