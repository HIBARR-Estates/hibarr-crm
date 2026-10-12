<?php

namespace App\Email\Data;

enum HealthState: string
{
    case Ok = 'ok';
    case NeedsReconnect = 'needs_reconnect';
    case QuotaBackoff = 'quota_backoff';
    case Unreachable = 'unreachable';
}
