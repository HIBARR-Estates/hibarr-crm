<?php

namespace App\Email\Enums;

enum SendRecipientKind: string
{
    case To = 'to';
    case Cc = 'cc';
}
