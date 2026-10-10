<?php

namespace App\Email\Enums;

/** Per-address outcome. Accepted by the provider is the furthest the CRM can claim. */
enum SendRecipientStatus: string
{
    case Pending = 'pending';
    case Accepted = 'accepted';
    case Delayed = 'delayed';
    case Bounced = 'bounced';
    case BlockedUntilReview = 'blocked_until_review';
}
