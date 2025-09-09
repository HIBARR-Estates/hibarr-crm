<?php

namespace Modules\Biolinks\Enums;

enum Font: string
{
    // phpcs:disable
    case ARIAL = 'arial';
    case HELVETICA = 'helvetica';
    case TIMES_NEW_ROMAN = 'times-new-roman';
    case TIMES = 'times';
    case COURIER_NEW = 'courier-new';
    case COURIER = 'courier';
    case VERDANA = 'verdana';
    case GEORGIA = 'georgia';
    case PALATINO = 'palatino';
    case GARAMOND = 'garamond';
    case BOOKMAN = 'bookman';
    case COMIC_SANS_MS = 'comic-sans-ms';
    case TREBUCHET_MS = 'trebuchet-ms';
    case ARIAL_BLACK = 'arial-black';
    case IMPACT = 'impact';
    case TAHOMA = 'tahoma';
    case GENEVA = 'geneva';
    case CENTURY_GOTHIC = 'century-gothic';
    case LUCIDA_GRANDE = 'lucida-grande';
    case OPTIMA = 'optima';
    case AVANT_GARDE = 'avant-garde';
    case ARIAL_NARROW = 'arial-narrow';
    case SANS_SERIF = 'sans-serif';
    case SERIF = 'serif';
    case MONOSPACE = 'monospace';
    case FANTASY = 'fantasy';
    case CURSIVE = 'cursive';
    // phpcs:enable

    // This method is used to display the enum value in the user interface.
    public function label(): string
    {
        return match ($this) {
            self::ARIAL => __('biolinks::app.font.' . $this->value),
            self::HELVETICA => __('biolinks::app.font.' . $this->value),
            self::TIMES_NEW_ROMAN => __('biolinks::app.font.' . $this->value),
            self::TIMES => __('biolinks::app.font.' . $this->value),
            self::COURIER_NEW => __('biolinks::app.font.' . $this->value),
            self::COURIER => __('biolinks::app.font.' . $this->value),
            self::VERDANA => __('biolinks::app.font.' . $this->value),
            self::GEORGIA => __('biolinks::app.font.' . $this->value),
            self::PALATINO => __('biolinks::app.font.' . $this->value),
            self::GARAMOND => __('biolinks::app.font.' . $this->value),
            self::BOOKMAN => __('biolinks::app.font.' . $this->value),
            self::COMIC_SANS_MS => __('biolinks::app.font.' . $this->value),
            self::TREBUCHET_MS => __('biolinks::app.font.' . $this->value),
            self::ARIAL_BLACK => __('biolinks::app.font.' . $this->value),
            self::IMPACT => __('biolinks::app.font.' . $this->value),
            self::TAHOMA => __('biolinks::app.font.' . $this->value),
            self::GENEVA => __('biolinks::app.font.' . $this->value),
            self::CENTURY_GOTHIC => __('biolinks::app.font.' . $this->value),
            self::LUCIDA_GRANDE => __('biolinks::app.font.' . $this->value),
            self::OPTIMA => __('biolinks::app.font.' . $this->value),
            self::AVANT_GARDE => __('biolinks::app.font.' . $this->value),
            self::ARIAL_NARROW => __('biolinks::app.font.' . $this->value),
            self::SANS_SERIF => __('biolinks::app.font.' . $this->value),
            self::SERIF => __('biolinks::app.font.' . $this->value),
            self::MONOSPACE => __('biolinks::app.font.' . $this->value),
            self::FANTASY => __('biolinks::app.font.' . $this->value),
            self::CURSIVE => __('biolinks::app.font.' . $this->value),
            default => $this->value,
        };
    }

    public function family(): string
    {
        return match ($this) {
            self::ARIAL => 'sans-serif',
            self::HELVETICA => 'sans-serif',
            self::TIMES_NEW_ROMAN => 'serif',
            self::TIMES => 'serif',
            self::COURIER_NEW => 'monospace',
            self::COURIER => 'monospace',
            self::VERDANA => 'sans-serif',
            self::GEORGIA => 'serif',
            self::PALATINO => 'serif',
            self::GARAMOND => 'serif',
            self::BOOKMAN => 'serif',
            self::COMIC_SANS_MS => 'cursive',
            self::TREBUCHET_MS => 'sans-serif',
            self::ARIAL_BLACK => 'sans-serif',
            self::IMPACT => 'sans-serif',
            self::TAHOMA => 'sans-serif',
            self::GENEVA => 'sans-serif',
            self::CENTURY_GOTHIC => 'sans-serif',
            self::LUCIDA_GRANDE => 'sans-serif',
            self::OPTIMA => 'sans-serif',
            self::AVANT_GARDE => 'sans-serif',
            self::ARIAL_NARROW => 'sans-serif',
            default => '',
        };
    }

    public function familyValue():string
    {
        return $this->realName() . ($this->family() ? ', ' . $this->family() : '');
    }

    public function realName():string
    {
        return match ($this) {
            self::ARIAL => 'Arial',
            self::HELVETICA => 'Helvetica',
            self::TIMES_NEW_ROMAN => 'Times New Roman',
            self::TIMES => 'Times',
            self::COURIER_NEW => 'Courier New',
            self::COURIER => 'Courier',
            self::VERDANA => 'Verdana',
            self::GEORGIA => 'Georgia',
            self::PALATINO => 'Palatino',
            self::GARAMOND => 'Garamond',
            self::BOOKMAN => 'Bookman',
            self::COMIC_SANS_MS => 'Comic Sans MS',
            self::TREBUCHET_MS => 'Trebuchet MS',
            self::ARIAL_BLACK => 'Arial Black',
            self::IMPACT => 'Impact',
            self::TAHOMA => 'Tahoma',
            self::GENEVA => 'Geneva',
            self::CENTURY_GOTHIC => 'Century Gothic',
            self::LUCIDA_GRANDE => 'Lucida Grande',
            self::OPTIMA => 'Optima',
            self::AVANT_GARDE => 'Avant Garde',
            self::ARIAL_NARROW => 'Arial Narrow',
            self::SANS_SERIF => 'Sans Serif',
            self::SERIF => 'Serif',
            self::MONOSPACE => 'Monospace',
            self::FANTASY => 'Fantasy',
            self::CURSIVE => 'Cursive',
            default => $this->value,
        };
    }

}
