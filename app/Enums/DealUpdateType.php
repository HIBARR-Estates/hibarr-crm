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
    /** Analysis modal: mark a required step as one the customer would not answer. */
    case ANALYSIS_UNANSWERED = 'analysis_unanswered';
}
