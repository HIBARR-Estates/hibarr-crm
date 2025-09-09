<?php

namespace Modules\Biolinks\Enums;

enum Alignment: string
{

    // phpcs:disable
    case CENTER = 'center';
    case LEFT = 'left';
    case RIGHT = 'right';
    case JUSTIFY = 'justify';
    // phpcs:enable

    // This method is used to display the enum value in the user interface.
    public function label(): string
    {
        return match ($this) {
            self::CENTER, self::LEFT, self::RIGHT, self::JUSTIFY => __('biolinks::app.' . $this->value),
            default => $this->value,
        };
    }

}
