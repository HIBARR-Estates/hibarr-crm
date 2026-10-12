<?php

namespace App\Email\Enums;

enum FileScanStatus: string
{
    /** Stored, or waiting to be; not scanned. Everything is here until a scanner exists (E-43). */
    case Pending = 'pending';
    case Clean = 'clean';
    case Infected = 'infected';
    /** Could not be fetched or stored, or refused by the size/type limits. */
    case Unavailable = 'unavailable';
}
