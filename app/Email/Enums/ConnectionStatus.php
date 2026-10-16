<?php

namespace App\Email\Enums;

enum ConnectionStatus: string
{
    case Active = 'active';
    case Stopped = 'stopped';
    case NeedsReconnect = 'needs_reconnect';
    case Error = 'error';
}
