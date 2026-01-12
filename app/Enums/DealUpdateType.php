<?php

namespace App\Enums;

enum DealUpdateType: string
{
    case DETAILS = 'details';
    case CONTACT = 'contact';
    case CUSTOM_FIELD = 'custom_field';
    case HIBARR_FIELD = 'hibarr_field';
}
