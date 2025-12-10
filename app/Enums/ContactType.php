<?php

namespace App\Enums;

enum ContactType: string
{
    case Agent = 'agent';
    case Customer = 'customer';

    /**
     * Get the label for the enum value.
     *
     * @return string
     */
    public function label(): string
    {
        return match ($this) {
            self::Agent => __('app.agent'),
            self::Customer => __('app.customer'),
            default => $this->value,
        };
    }
}

