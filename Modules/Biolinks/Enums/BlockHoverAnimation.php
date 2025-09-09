<?php

namespace Modules\Biolinks\Enums;

enum BlockHoverAnimation: string
{

    // phpcs:disable
    case NONE = 'none';
    case SMOOTH = 'smooth';
    case INSTANT = 'instant';
    // phpcs:enable

    // This method is used to display the enum value in the user interface.
    public function label(): string
    {
        return match ($this) {
            self::NONE, self::SMOOTH, self::INSTANT => __('biolinks::app.' . $this->value),
            default => $this->value,
        };
    }

}
