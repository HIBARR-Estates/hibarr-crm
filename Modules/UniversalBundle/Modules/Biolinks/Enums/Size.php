<?php

namespace Modules\Biolinks\Enums;

enum Size: string
{
    // phpcs:disable
    case SMALL = 'small';
    case MEDIUM = 'medium';
    case LARGE = 'large';
    case EXTRA_LARGE = 'extra large';
    // phpcs:enable

    // This method is used to display the enum value in the user interface.
    public function label(): string
    {
        return match ($this) {
            self::SMALL => __('biolinks::app.' . $this->value),
            self::MEDIUM => __('biolinks::app.' . $this->value),
            self::LARGE => __('biolinks::app.' . $this->value),
            self::EXTRA_LARGE => __('biolinks::app.' . $this->value),
            default => $this->value,
        };
    }

}
