<?php

namespace App\Http\Requests\ApiV2\CrmWrite\Concerns;

use Illuminate\Validation\Rule;

trait ValidatesMeetingLocationRules
{
    /**
     * @return array<string, mixed>
     */
    protected function meetingTypeIdRule(int $companyId): array
    {
        return [
            'nullable',
            'integer',
            Rule::exists('meeting_types', 'id')->where(fn ($q) => $q->where('company_id', $companyId)),
        ];
    }

    /**
     * @return array<int, mixed>
     */
    protected function participantUserRule(int $companyId, bool $required = false): array
    {
        return [
            $required ? 'required' : 'required_with:participants',
            'integer',
            Rule::exists('users', 'id')->where(fn ($q) => $q->where('company_id', $companyId)),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    protected function meetingLocationRules(?string $location, bool $isUpdate, int $companyId): array
    {
        if ($location === null) {
            return [
                'meeting_link' => 'nullable|url',
            ];
        }

        $rules = [];

        if (in_array($location, ['zoho', 'office', 'phone', 'physical'], true)) {
            $rules['meeting_link'] = 'nullable|url';
        } else {
            $rules['meeting_link'] = 'required|url';
        }

        if ($location === 'zoho') {
            $rules['participants'] = ($isUpdate ? 'sometimes|' : '') . 'required|array|min:1';
            $rules['participants.*'] = $this->participantUserRule($companyId, true);
        }

        return $rules;
    }
}
