<?php

namespace Modules\Biolinks\Enums;

enum Status: string
{

    // phpcs:disable
    case Active = 'active';
    case Inactive = 'inactive';
    // phpcs:enable

    // This method is used to display the enum value in the user interface.
    public function label(): string
    {
        return match ($this) {
            self::Active => __('app.' . $this->value),
            self::Inactive => __('app.' . $this->value),
            default => $this->value,
        };
    }

    public function html(): string
    {
        return match ($this) {
            self::Active => "<i class='fa fa-circle mr-2 text-light-green'></i> " . $this->label(),
            self::Inactive => "<i class='fa fa-circle mr-2 text-red'></i> " . $this->label(),
            default => "<i class='fa fa-circle mr-2 text-info'></i> " . $this->label(),
        };
    }

}
