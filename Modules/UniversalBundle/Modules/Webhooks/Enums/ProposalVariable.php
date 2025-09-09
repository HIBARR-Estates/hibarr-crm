<?php

namespace Modules\Webhooks\Enums;

use Modules\Webhooks\Enums\Variable;

enum ProposalVariable: string implements Variable
{
    case sub_total = '##SUB_TOTAL##';
    case total = '##TOTAL##';
    case discount = '##DISCOUNT##';
    case discount_type = '##DISCOUNT_TYPE##';
    case description = '##DESCRIPTION##';
    case calculate_tax = '##CALCULATE_TAX##';

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
            'lead',
            'lead_id',
            'currency_id',
        ];
    }

}
