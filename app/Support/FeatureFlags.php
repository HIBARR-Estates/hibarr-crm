<?php

namespace App\Support;

class FeatureFlags
{
    /**
     * @return array<string, bool>
     */
    public static function forInertia(): array
    {
        return [
            'crm.lead-qualification-tab' => (bool) config('features.crm.lead-qualification-tab'),
            'crm.lead-language-core-field' => (bool) config('features.crm.lead-language-core-field'),
        ];
    }
}
