<?php

namespace App\Enums;

enum QualificationActionRunStatus: string
{
    case Pending = 'pending';
    case Completed = 'completed';
    case Failed = 'failed';
    case Skipped = 'skipped';
    case Unavailable = 'unavailable';
}
