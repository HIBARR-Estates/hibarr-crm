<?php

namespace App\Email\Matching;

enum MatchResult: string
{
    /** The conversation was linked to the one lead the address belongs to. */
    case Linked = 'linked';

    /** The conversation was already on a record; the message simply joined it. */
    case AlreadyLinked = 'already_linked';

    /** No single visible lead: the copy waits in its owner's private review. */
    case Review = 'review';
}
