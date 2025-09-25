<?php

namespace App\Enums;

enum ResolutionStatus: string
{
    case Resolved = 'resolved';
    case Unresolved = 'unresolved';
    case Pending = 'pending';


    // This method is used to display the enum value in the user interface.
    public function label(): string
    {
        return match ($this) {
            self::Resolved, self::Unresolved, self::Pending => __('app.' . $this->value),
            default => $this->value,
        };
    }

}
