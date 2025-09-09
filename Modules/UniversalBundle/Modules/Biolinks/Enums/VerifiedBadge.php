<?php

namespace Modules\Biolinks\Enums;

enum VerifiedBadge: string
{
    // phpcs:disable
    case NONE = 'none';
    case TOP = 'top';
    case BOTTOM = 'bottom';
    // phpcs:enable

    // This method is used to display the enum value in the user interface.
    public function label(): string
    {
        return match ($this) {
            self::NONE => __('biolinks::app.' . $this->value),
            self::TOP => __('biolinks::app.' . $this->value),
            self::BOTTOM => __('biolinks::app.' . $this->value),
            default => $this->value,
        };
    }

}
