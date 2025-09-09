<?php

namespace Modules\Webhooks\Enums;

use Modules\Webhooks\Enums\Variable;

enum ProjectVariable: string implements Variable
{
    case project_name = '##PROJECT_NAME##';
    case project_short_code = '##PROJECT_SHORT_CODE##';
    case project_summary = '##PROJECT_SUMMARY##';
    case project_budget = '##PROJECT_BUDGET##';
    case status = '##STATUS##';
    case notes = '##NOTES##';

    public function key(): string
    {
        return match ($this) {
            default => $this->name,
        };
    }

    public static function invalidVariables(): array
    {
        return [
            'id',
            'company',
            'company_id',
            'last_updated_by',
            'added_by',
            'category_id',
            'client_id',
            'team_id',
            'currency_id',
        ];
    }

}
