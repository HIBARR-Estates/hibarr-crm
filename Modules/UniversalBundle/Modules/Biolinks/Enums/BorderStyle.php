<?php

namespace Modules\Biolinks\Enums;

enum BorderStyle: string
{

    // phpcs:disable
    case SOLID = 'solid';
    case DASHED = 'dashed';
    case DOUBLE = 'double';
    case OUTSET = 'outset';
    case INSET = 'inset';
    // phpcs:enable

    // This method is used to display the enum value in the user interface.
    public function label(): string
    {
        return match ($this) {
            self::SOLID, self::DASHED, self::OUTSET, self::DOUBLE, self::INSET => __('biolinks::app.' . $this->value),
            default => $this->value,
        };
    }

}
