<?php

namespace App\Enums;

enum FinancialLineFrequency: string
{
    case Once = 'once';
    case Monthly = 'monthly';
    case Yearly = 'yearly';
}
