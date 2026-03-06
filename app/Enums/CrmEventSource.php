<?php

namespace App\Enums;

/**
 * Defines the source/origin of a CRM event — how the event was triggered.
 */
enum CrmEventSource: string
{
    case API = 'api';
    case GRPC = 'grpc';
    case OBSERVER = 'observer';
    case CONTROLLER = 'controller';
    case JOB = 'job';
    case MIDDLEWARE = 'middleware';
    case SYSTEM = 'system';

    /**
     * Get the human-readable label for this source.
     */
    public function label(): string
    {
        return match ($this) {
            self::API => 'REST API',
            self::GRPC => 'gRPC',
            self::OBSERVER => 'Model Observer',
            self::CONTROLLER => 'Controller',
            self::JOB => 'Queue Job',
            self::MIDDLEWARE => 'Middleware',
            self::SYSTEM => 'System',
        };
    }
}
