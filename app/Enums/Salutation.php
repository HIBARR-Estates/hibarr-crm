<?php

namespace App\Enums;

enum Salutation: string
{

    // phpcs:disable
    case Mr = 'mr';
    case Mrs = 'mrs';
    case Miss = 'miss';
    case Dr = 'dr';
    case Sir = 'sir';
    case Madam = 'madam';
    case Herr = 'herr';
    case Frau = 'frau';
    // phpcs:enable

    // This method is used to display the enum value in the user interface.
    // `$locale` renders it in that language (e.g. a lead's own); null keeps the
    // current app locale, as before.
    public function label(?string $locale = null): string
    {
        return match ($this) {
            self::Mr, self::Mrs, self::Miss, self::Dr, self::Sir, self::Madam, self::Herr, self::Frau => __('app.' . $this->value, [], $locale),
            default => $this->value,
        };
    }

}
