<?php

namespace App\Enums;

enum Gender: string
{

    // phpcs:disable
    case Male = 'male';
    case Female = 'female';
    // phpcs:enable

    // This method is used to display the enum value in the user interface.
    public function label(): string
    {
        return match ($this) {
            self::Male, self::Female => __('app.' . $this->value),
            default => $this->value,
        };
    }

}
