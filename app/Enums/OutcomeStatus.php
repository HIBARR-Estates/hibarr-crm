<?php

namespace App\Enums;

enum OutcomeStatus: string
{
    case Won = 'won';
    case Lost = 'lost';

    public function label(): string
    {
        return match ($this) {
            self::Won => __('app.outcomeStatus.won'),
            self::Lost => __('app.outcomeStatus.lost'),
        };
    }

    public static function toArray(): array
    {
        return array_map(fn (self $case) => $case->value, self::cases());
    }
}
