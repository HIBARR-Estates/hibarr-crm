<?php

namespace App\Enums;

enum DealUpdateType: string
{
    case DETAILS = 'details';
    case CONTACT = 'contact';
    case CUSTOM_FIELD = 'custom_field';
    case HIBARR_FIELD = 'hibarr_field';
    case LEAD_CUSTOM_FIELD = 'lead_custom_field';
    case RECALCULATE_VALUE = 'recalculate_value';
}
