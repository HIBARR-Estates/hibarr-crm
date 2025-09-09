<?php

namespace Modules\Biolinks\Enums;

enum YesNo: string
{
    // phpcs:disable
    case Yes = 'yes';
    case No = 'no';
    // phpcs:enable

    // This method is used to display the enum value in the user interface.
    public function label(): string
    {
        return match ($this) {
            self::Yes => __('app.' . $this->value),
            self::No => __('app.' . $this->value),
            default => $this->value,
        };
    }

}
