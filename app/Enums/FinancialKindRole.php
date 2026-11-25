<?php

namespace App\Enums;

/**
 * How the lines of a kind are counted. The calculator reads the role, never
 * the kind's key, so an admin-created kind works in the totals straight away.
 */
enum FinancialKindRole: string
{
    /** Recurring inflow, counted per month. */
    case Income = 'income';

    /** A stock of money, counted when confirmed or likely. */
    case Asset = 'asset';

    /** A one-off inflow, counted once available. */
    case Funding = 'funding';

    /** A recurring outflow that reduces disposable income. */
    case Commitment = 'commitment';

    public function isRecurring(): bool
    {
        return $this === self::Income || $this === self::Commitment;
    }

    public function isOneOff(): bool
    {
        return $this === self::Asset || $this === self::Funding;
    }
}
