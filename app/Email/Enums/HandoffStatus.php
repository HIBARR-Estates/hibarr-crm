<?php

namespace App\Email\Enums;

enum HandoffStatus: string
{
    case Pending = 'pending';
    case Accepted = 'accepted';
    case Rejected = 'rejected';
}
