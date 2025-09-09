<?php

namespace Modules\Webhooks\Enums;

enum LeadVariable: string implements Variable
{

    case name = '##NAME##';
    case email = '##EMAIL##';
    case company_name = '##COMPANY_NAME##';
    case website = '##WEBSITE##';
    case address = '##ADDRESS##';
    case salutation = '##SALUTATION##';
    case mobile = '##MOBILE##';
    case office = '##OFFICE##';
    case city = '##CITY##';
    case state = '##STATE##';
    case country = '##COUNTRY##';
    case postal_code = '##POSTAL_CODE##';
    case note = '##NOTE##';

    public function key(): string
    {
        return match ($this) {
            self::name => 'client_name',
            self::email => 'client_email',
            default => $this->name,
        };
    }

    public static function invalidVariables(): array
    {
        return [
            'id',
            'agent_id',
            'source_id',
            'status_id',
            'company_id',
            'currency_id',
            'last_updated_by',
            'added_by',
            'image_url',
            'company'
        ];
    }

}
