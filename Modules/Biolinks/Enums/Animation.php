<?php

namespace Modules\Biolinks\Enums;

enum Animation: string
{

    // phpcs:disable
    case NONE = 'none';
    case SPIN = 'spin';
    case PING = 'ping';
    case PULSE = 'pulse';
    case BOUNCE = 'bounce';
    // phpcs:enable

    // This method is used to display the enum value in the user interface.
    public function label(): string
    {
        return match ($this) {
            self::NONE, self::SPIN, self::PING, self::PULSE, self::BOUNCE => __('biolinks::app.' . $this->value),
            default => $this->value,
        };
    }

}
