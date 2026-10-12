<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use OpenTelemetry\API\Trace\SpanKind;
use OpenTelemetry\API\Trace\StatusCode;
use OpenTelemetry\API\Trace\TracerProviderInterface;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

/**
 * Wraps every HTTP request in a single OTel server span, giving Signoz the
 * request-duration + status-code data it needs to derive RED metrics
 * (rate/errors/duration) for the CRM Reliability dashboard, without any
 * separate metrics pipeline.
 *
 * Registered as global middleware (see App\Http\Kernel) so it wraps the
 * full request lifecycle, including unmatched routes (404s) — the route
 * itself isn't known until after $next() runs, so the span is renamed once
 * routing has resolved.
 *
 * Because the span is activated on the current OTel context for the
 * duration of the request, any log record emitted via the `otlp` log
 * channel during this window is automatically correlated with this
 * trace_id/span_id — that's what lets an alert link straight to a trace.
 *
 * @see config/opentelemetry.php
 */
class OpenTelemetryTraceMiddleware
{
    public function __construct(
        protected TracerProviderInterface $tracerProvider,
    ) {}

    public function handle(Request $request, Closure $next): Response
    {
        if (! config('opentelemetry.traces.enabled')) {
            return $next($request);
        }

        $tracer = $this->tracerProvider->getTracer('hibarr-crm');

        $span = $tracer->spanBuilder($request->method() . ' ' . $request->path())
            ->setSpanKind(SpanKind::KIND_SERVER)
            ->setAttribute('http.request.method', $request->method())
            ->setAttribute('url.path', $request->path())
            ->setAttribute('server.address', $request->getHost())
            ->startSpan();

        $scope = $span->activate();

        try {
            $response = $next($request);

            $route = $request->route()?->uri();

            $span->updateName($request->method() . ' ' . ($route ?? $request->path()));
            $span->setAttribute('http.route', $route ?? 'unmatched');
            $span->setAttribute('http.response.status_code', $response->getStatusCode());

            if ($response->getStatusCode() >= 500) {
                $span->setStatus(StatusCode::STATUS_ERROR);
            }

            return $response;
        } catch (Throwable $e) {
            $span->recordException($e);
            $span->setStatus(StatusCode::STATUS_ERROR);

            throw $e;
        } finally {
            $span->end();
            $scope->detach();
        }
    }
}
