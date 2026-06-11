<?php

namespace App\Enums;

enum QualificationStatus: string
{
    case InProgress = 'inProgress';
    case Completed = 'completed';
    case Abandoned = 'abandoned';
}
