<?php

namespace App\Enums;

enum CommissionStatus: string
{
    case Pending   = 'pending';
    case Approved  = 'approved';
    case Paid      = 'paid';
    case Cancelled = 'cancelled';



    public function label(): string
    {
        return match ($this) {
            self::Pending, self::Approved, self::Paid, self::Cancelled => __('app.commissionStatus.' . $this->value),
            default => $this->value,
        };
    }

    public static function toArray(): array
    {
        $statuses = [];
        foreach (CommissionStatus::cases() as $status) {
            $statuses[] = $status->value;
        }
        return $statuses;
    }
}