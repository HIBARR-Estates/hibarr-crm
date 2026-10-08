<?php

namespace App\Email\Data;

/**
 * What the provider said about a submission. There is deliberately no
 * "delivered": acceptance by the provider is not delivery.
 */
enum SendStatus: string
{
    case Accepted = 'accepted';
    case Rejected = 'rejected';
    case Unknown = 'unknown';
    case Throttled = 'throttled';
}
