<?php

namespace Modules\Biolinks\Enums;

enum ObjectFit: string
{

    // phpcs:disable
    case COVER = 'cover';
    case FILL = 'fill';
    case CONTAIN = 'contain';
    // phpcs:enable

    // This method is used to display the enum value in the user interface.
    public function label(): string
    {
        return match ($this) {
            self::COVER, self::FILL, self::CONTAIN => __('biolinks::app.' . $this->value),
            default => $this->value,
        };
    }

}
