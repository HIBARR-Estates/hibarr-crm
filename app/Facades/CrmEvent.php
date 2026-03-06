<?php

namespace App\Facades;

use App\Services\CrmEventService;
use Illuminate\Support\Facades\Facade;

/**
 * Facade for the CRM Event Record Keeping Engine.
 *
 * Provides static access to CrmEventService methods:
 *
 *   CrmEvent::record([...])
 *   CrmEvent::recordBatch([...])
 *   CrmEvent::startCorrelation()
 *   CrmEvent::query([...])
 *   CrmEvent::getEventChain($correlationId, $companyId)
 *   CrmEvent::getModelEvents($modelType, $modelId, $companyId)
 *   CrmEvent::resolveEventType($slug, $companyId)
 *   CrmEvent::clearTypeCache($companyId)
 *
 * @method static \App\Models\CrmEvent|null record(array $params, bool $forceSync = false)
 * @method static \Illuminate\Support\Collection recordBatch(array $events)
 * @method static string startCorrelation()
 * @method static \Illuminate\Contracts\Pagination\LengthAwarePaginator query(array $filters)
 * @method static \Illuminate\Database\Eloquent\Collection getEventChain(string $correlationId, int $companyId)
 * @method static \Illuminate\Database\Eloquent\Collection getModelEvents(string $modelType, int $modelId, int $companyId)
 * @method static \App\Models\CrmEventType|null resolveEventType(string $slug, ?int $companyId = null)
 * @method static void clearTypeCache(?int $companyId = null)
 *
 * @see \App\Services\CrmEventService
 */
class CrmEvent extends Facade
{
    /**
     * Get the registered name of the component.
     */
    protected static function getFacadeAccessor(): string
    {
        return CrmEventService::class;
    }
}
