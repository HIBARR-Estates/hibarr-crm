<?php

namespace App\Email\Enums;

enum LinkAuditAction: string
{
    case Link = 'link';
    case Unlink = 'unlink';
    case Dismiss = 'dismiss';
    case Handoff = 'handoff';
    case Escalate = 'escalate';
    case Accept = 'accept';
    case Reject = 'reject';
}
