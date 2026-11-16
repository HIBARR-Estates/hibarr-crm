<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * An issued invoice or receipt for a deal payment. The number is permanent
 * and the snapshot is exactly what was printed.
 *
 * @property int $id
 * @property int $company_id
 * @property int $payment_id
 * @property string $kind
 * @property string $series
 * @property int $sequence
 * @property \Illuminate\Support\Carbon $issued_at
 * @property array<string, mixed> $snapshot
 * @property int|null $issued_by
 */
class PaymentDocument extends Model
{
    public const INVOICE = 'invoice';

    public const RECEIPT = 'receipt';

    protected $guarded = ['id'];

    protected $casts = [
        'sequence' => 'integer',
        'issued_at' => 'datetime',
        'snapshot' => 'array',
    ];

    public static function formatNumber(string $series, int $sequence, int $padding): string
    {
        $number = str_pad((string) $sequence, max(1, $padding), '0', STR_PAD_LEFT);

        return trim($series.' '.$number);
    }
}
