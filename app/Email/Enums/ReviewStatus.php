<?php

namespace App\Email\Enums;

enum ReviewStatus: string
{
    case None = 'none';
    case Unlinked = 'unlinked';
    case Dismissed = 'dismissed';
    case HandedOff = 'handed_off';
}
