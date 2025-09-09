<?php

namespace Modules\Webhooks\Jobs;

use GuzzleHttp\Client;
use GuzzleHttp\HandlerStack;
use GuzzleHttp\Middleware;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Modules\Webhooks\Entities\WebhooksLog;
use Modules\Webhooks\Entities\WebhooksSetting;
use Monolog\Handler\StreamHandler;
use Monolog\Logger;
use Psr\Http\Message\ResponseInterface;

class SendWebhook implements ShouldQueue
{

    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    protected $data;
    protected $webhookFor;
    protected $companyId;

    public function __construct(array $data = [], string $webhookFor = '', int|null $companyId = null)
    {
        $this->webhookFor = $webhookFor;
        $this->companyId = $companyId;
        $this->data = $this->dataCleanUp($data);
    }

    public function handle()
    {
        $webhooks = WebhooksSetting::where('company_id', $this->companyId)
            ->where('status', 'active')
            ->where('webhook_for', $this->webhookFor)
            ->get();

        foreach ($webhooks as $webhook) {
            $data = $this->data;
            $data = $this->mapData($webhook, $data);
            $headers = $this->mapHeaders($webhook);
            $client = $this->getClientRequest($webhook, $data, $headers);

            $client->request(
                $webhook->request_method,
                $webhook->url,
                [
                    'headers' => $headers,
                    'form_params' => $data,
                ]
            );
        }
    }

    private function getClientRequest($webhook, $data, $headers)
    {

        $logger = new Logger('Zapier');
        $logger->pushHandler(new StreamHandler(storage_path('logs/zapier-' . date('Y-m-d') . '.log')));

        $stack = HandlerStack::create();
//        $stack->push(
//            Middleware::log(
//                $logger,
//                new MessageFormatter("{method} {uri} HTTP/{version} {req_body} | RESPONSE: {code} - {res_body}")
//            )
//        );

        $stack->push(Middleware::mapResponse(function (ResponseInterface $response) use ($webhook, $data, $headers) {
            $this->saveData($response, $webhook, $data, $headers);

            return $response;
        }));


        return new Client([
            'timeout' => 60,
            'connect_timeout' => 60,
            'http_errors' => false,
            'verify' => false,
            'handler' => $stack,
        ]);
    }

    private function saveData($response, $webhook, $data, $headers)
    {
        $responseBody = $response->getBody();

        if (json_decode($responseBody)) {
            $responseBody = json_encode(json_decode($responseBody), JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES);
        }
        $log = new WebhooksLog();
        $log->company_id = $webhook->company_id;
        $log->method = $webhook->request_method;
        $log->webhooks_setting_id = $webhook->id;
        $log->headers = json_encode($headers, JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES);
        $log->action = $webhook->url;
        $log->webhook_for = $webhook->webhook_for;
        $log->raw_content = json_encode($data, JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES);
        $log->response = $responseBody;
        $log->response_code = $response->getStatusCode();
        $log->save();
    }

    private function mapData($webhook, $data)
    {
        foreach ($webhook->webhooksBodyRequests as $webhooksBodyRequest) {

            $dataVariable = $this->getVariableClass()::tryFrom($webhooksBodyRequest->body_value);

            if ($dataVariable) {
                $data[$webhooksBodyRequest->body_key] = $data[$dataVariable->key()] ?? '';
            }
            else {
                $data[$webhooksBodyRequest->body_key] = $webhooksBodyRequest->body_value;
            }
        }

        return $data;
    }

    private function mapHeaders($webhook)
    {
        $headers = [];

        foreach ($webhook->webhooksHeadersRequests as $webhooksHeadersRequest) {
            $headers[$webhooksHeadersRequest->headers_key] = $webhooksHeadersRequest->headers_value;
        }

        return $headers;
    }

    private function getVariableClass()
    {
        return match ($this->webhookFor) {
            'Client' => \Modules\Webhooks\Enums\ClientVariable::class,
            'Employee' => \Modules\Webhooks\Enums\EmployeeVariable::class,
            'Invoice' => \Modules\Webhooks\Enums\InvoiceVariable::class,
            'Lead' => \Modules\Webhooks\Enums\LeadVariable::class,
            'Project' => \Modules\Webhooks\Enums\ProjectVariable::class,
            'Proposal' => \Modules\Webhooks\Enums\ProposalVariable::class,
            'Task' => \Modules\Webhooks\Enums\TaskVariable::class,
            default => null,
        };
    }

    private function dataCleanUp($data)
    {
        $invalidVariables = $this->getVariableClass() ? ($this->getVariableClass()::invalidVariables() ?? []) : [];


        foreach ($data as $key => $value) {
            if(is_array($value)){
               continue;
            }

            try{
                if (in_array($key, $invalidVariables)) {
                    unset($data[$key]);
                }else{
                    $data[$key] = str_replace('\\/', '/', $value);
                }
            }catch(\Exception $e){

            }


        }

        return $data;
    }

}
