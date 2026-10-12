<?php

namespace App\Email\Enums;

enum HandoffType: string
{
    case Handoff = 'handoff';
    case Escalate = 'escalate';
}
