<?php

namespace App\Enums;

/**
 * A financial assessment is edited as a draft, frozen as final, and kept as
 * superseded history once a newer final replaces it.
 */
enum FinancialAssessmentStatus: string
{
    case Draft = 'draft';
    case Final = 'final';
    case Superseded = 'superseded';
}
