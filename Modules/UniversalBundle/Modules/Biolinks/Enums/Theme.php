<?php

namespace Modules\Biolinks\Enums;

enum Theme: string
{
    // phpcs:disable
    case MONOCHROME = 'MonoChrome';
    case GRADIENTA = 'Gradienta';
    case CUSTOM = 'Custom';
    // phpcs:enable

    // This method is used to display the enum value in the user interface.
    public function label(): string
    {
        return match ($this) {
            self::MONOCHROME => __('biolinks::app.' . $this->value),
            self::GRADIENTA => __('biolinks::app.' . $this->value),
            self::CUSTOM => __('biolinks::app.' . $this->value),
            default => $this->value,
        };
    }

}
