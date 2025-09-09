<?php

namespace Modules\Biolinks\Enums;

enum Heading: string
{

    // phpcs:disable
    case H1 = 'h1';
    case H2 = 'h2';
    case H3 = 'h3';
    case H4 = 'h4';
    case H5 = 'h5';
    case H6 = 'h6';
    // phpcs:enable

    // This method is used to display the enum value in the user interface.
    public function label(): string
    {
        return match ($this) {
            self::H1, self::H2, self::H3, self::H4, self::H5, self::H6 => __('biolinks::app.' . $this->value),
            default => $this->value,
        };
    }

}
