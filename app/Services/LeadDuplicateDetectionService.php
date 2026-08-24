<?php

namespace App\Services;

use App\Enums\LeadContactMethodType;
use App\Models\Lead;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Schema;

class LeadDuplicateDetectionService
{
    public function __construct(
        private LeadContactMethodService $contactMethodService,
    ) {
    }

    /**
     * Find merge candidates that share an exact client_email and/or mobile/cell
     * with the given lead (same company), plus any lead_contact_methods matches.
     * Soft-deleted leads are excluded by SoftDeletes. Column matching is raw
     * string equality (v1 — no phone normalization); method matching uses
     * normalized identifier values.
     *
     * @return Collection<int, Lead>
     */
    public function findDuplicates(Lead $lead): Collection
    {
        $email = $this->nonEmptyString($lead->client_email);
        $mobile = $this->nonEmptyString($lead->mobile);
        $cell = $this->nonEmptyString($lead->cell);

        $emailNormalized = [];
        $phoneNormalized = [];

        if ($parsed = $this->contactMethodService->parseEmail($lead->client_email)) {
            $emailNormalized[] = $parsed['normalized'];
        }

        foreach ([$lead->mobile, $lead->cell] as $rawPhone) {
            if ($parsed = $this->contactMethodService->parsePhone($rawPhone)) {
                $phoneNormalized[] = $parsed['normalized'];
            }
        }

        if (Schema::hasTable('lead_contact_methods')) {
            foreach ($lead->contactMethods as $method) {
                $type = $method->type instanceof LeadContactMethodType
                    ? $method->type
                    : LeadContactMethodType::tryFrom((string) $method->type);

                if ($type === LeadContactMethodType::Email) {
                    $emailNormalized[] = $method->normalized;
                    $emailNormalized[] = strtolower((string) $method->identifier);
                } elseif ($type === LeadContactMethodType::Phone) {
                    $phoneNormalized[] = $method->normalized;
                }
            }
        }

        $emailNormalized = array_values(array_unique(array_filter($emailNormalized)));
        $phoneNormalized = array_values(array_unique(array_filter($phoneNormalized)));

        if ($email === null && $mobile === null && $cell === null && $emailNormalized === [] && $phoneNormalized === []) {
            return collect();
        }

        return Lead::query()
            ->where('company_id', $lead->company_id)
            ->where('id', '!=', $lead->id)
            ->where(function (Builder $query) use ($email, $mobile, $cell, $emailNormalized, $phoneNormalized) {
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

                if ($emailNormalized !== []) {
                    $query->orWhereIn('client_email', $emailNormalized);
                }

                $allNormalized = array_values(array_unique(array_merge($emailNormalized, $phoneNormalized)));
                if ($allNormalized !== [] && Schema::hasTable('lead_contact_methods')) {
                    $query->orWhereHas('contactMethods', function (Builder $methods) use ($allNormalized) {
                        $methods->whereIn('normalized', $allNormalized);
                    });
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
