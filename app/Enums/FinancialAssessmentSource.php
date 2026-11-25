<?php

namespace App\Enums;

/** Where the information in an assessment came from. */
enum FinancialAssessmentSource: string
{
    case Call = 'call';
    case Consultation = 'consultation';
    case ClientForm = 'client_form';
    case Api = 'api';
    case Manual = 'manual';
    case Import = 'import';
}
