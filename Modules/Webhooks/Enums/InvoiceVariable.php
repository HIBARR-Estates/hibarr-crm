<?php

namespace Modules\Webhooks\Enums;

use Modules\Webhooks\Enums\Variable;

enum InvoiceVariable: string implements Variable
{
    case total = '##TOTAL##';
    case total_amount = '##TOTAL_AMOUNT##';
    case due_amount = '##DUE_AMOUNT##';
    case sub_total = '##SUB_TOTAL##';
    case discount_type = '##DISCOUNT_TYPE##';
    case recurring = '##RECURRING##';
    case billing_frequency = '##BILLING_FREQUENCY##';
    case billing_interval = '##BILLING_INTERVAL##';
    case billing_cycle = '##BILLING_CYCLE##';
    case note = '##NOTE##';
    case invoice_number = '##INVOICE_NUMBER##';
    case calculate_tax = '##CALCULATE_TAX##';
    case issue_on = '##ISSUE_ON##';
    case status = '##STATUS##';

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
            'project_id',
            'project_id',
            'client_id',
            'currency_id',
            'default_currency_id',
            'company_address_id',
            'estimate_id',
            'bank_account_id',
        ];
    }

}
