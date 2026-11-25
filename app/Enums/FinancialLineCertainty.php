<?php

namespace App\Enums;

enum FinancialLineCertainty: string
{
    case Confirmed = 'confirmed';
    case Likely = 'likely';
    case Uncertain = 'uncertain';
}
