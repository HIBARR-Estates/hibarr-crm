<?php

namespace Modules\Biolinks\Enums;

enum PaypalType: string
{

    // phpcs:disable
    case BUY_NOW = 'buy now';
    case ADD_TO_CART = 'add to cart';
    case DONATION = 'donation';
    // phpcs:enable

    // This method is used to display the enum value in the user interface.
    public function label(): string
    {
        return match ($this) {
            self::BUY_NOW, self::ADD_TO_CART, self::DONATION => __('biolinks::app.' . $this->value),
            default => $this->value,
        };
    }

}
