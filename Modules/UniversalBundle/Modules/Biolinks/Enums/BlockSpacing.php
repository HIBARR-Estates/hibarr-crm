<?php

namespace Modules\Biolinks\Enums;

enum BlockSpacing: string
{
    // phpcs:disable
    case SMALL = 'small';
    case MEDIUM = 'medium';
    case LARGE = 'large';
    // phpcs:enable

    // This method is used to display the enum value in the user interface.
    public function label(): string
    {
        return match ($this) {
            self::SMALL, self::MEDIUM, self::LARGE => __('biolinks::app.' . $this->value),
            default => $this->value,
        };
    }

}
