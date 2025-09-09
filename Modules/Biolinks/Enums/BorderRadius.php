<?php

namespace Modules\Biolinks\Enums;

enum BorderRadius: string
{

    // phpcs:disable
    case STRAIGHT = 'straight';
    case ROUND = 'round';
    case ROUNDED = 'rounded';
    // phpcs:enable

    // This method is used to display the enum value in the user interface.
    public function label(): string
    {
        return match ($this) {
            self::STRAIGHT, self::ROUND, self::ROUNDED => __('biolinks::app.' . $this->value),
            default => $this->value,
        };
    }

}
