<?php

namespace Tests\Feature\FinancialAssessment;

use App\Http\Controllers\Api\LeadFinancialAssessmentApiController;
use App\Models\FinancialAssessment;
use App\Models\Lead;
use App\Services\FinancialAssessment\AssessmentService;
use App\Support\RequestCompany;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Tests\Concerns\SetsFeatureFlags;
use Tests\FinancialAssessmentTestCase;

class LeadFinancialAssessmentApiTest extends FinancialAssessmentTestCase
{
    use SetsFeatureFlags;

    private AssessmentService $service;

    private LeadFinancialAssessmentApiController $api;

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow('2026-11-12 10:00:00');
        $this->setFeatureFlag('crm.lead-financial-assessments', true);
        $this->service = app(AssessmentService::class);
        $this->api = app(LeadFinancialAssessmentApiController::class);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function request(?int $companyId = null, array $query = []): Request
    {
        $request = Request::create('/api/leads/1/financial-assessments', 'GET', $query);
        $request->attributes->set(RequestCompany::TOKEN_COMPANY_ATTRIBUTE, $companyId ?? $this->companyId);

        return $request;
    }

    private function body(JsonResponse $response): array
    {
        return json_decode($response->getContent(), true);
    }

    private function finalised(Lead $lead, array $lines): FinancialAssessment
    {
        $draft = $this->service->startDraft($lead, $this->userId);
        foreach ($lines as $type => $amount) {
            $this->service->addLine($draft, $type, ['amount' => $amount]);
        }

        return $this->service->finalise($draft, $this->userId);
    }

    public function test_current_returns_the_final_assessment_with_lines_and_summary(): void
    {
        $lead = $this->makeLead();
        $this->finalised($lead, ['salary' => 6500, 'bank' => 42000]);

        $response = $this->api->current($this->request(), (string) $lead->id);
        $body = $this->body($response);

        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame('success', $body['status']);
        $this->assertSame('final', $body['data']['status']);
        $this->assertTrue($body['data']['is_current']);
        $this->assertFalse($body['data']['verified']);
        $this->assertEqualsCanonicalizing(['salary', 'bank'], array_column($body['data']['lines'], 'type'));
        $this->assertEquals(42000, $body['summary']['available_now']);
        $this->assertEquals(6500, $body['summary']['income_monthly']);
        $this->assertSame('EUR', $body['summary']['currency']);
    }

    public function test_a_lead_without_a_final_assessment_is_a_404_and_drafts_are_never_exposed(): void
    {
        $lead = $this->makeLead();
        $draft = $this->service->startDraft($lead, $this->userId);
        $this->service->addLine($draft, 'salary', ['amount' => 5000]);

        $this->assertSame(404, $this->api->current($this->request(), (string) $lead->id)->getStatusCode());
        $this->assertSame(0, $this->body($this->api->index($this->request(), (string) $lead->id))['total']);
        $this->assertSame(404, $this->api->show($this->request(), (string) $lead->id, (string) $draft->id)->getStatusCode());
    }

    public function test_index_lists_finals_and_superseded_newest_first_without_lines_and_caps_per_page(): void
    {
        $lead = $this->makeLead();
        $first = $this->finalised($lead, ['salary' => 6000]);
        Carbon::setTestNow('2026-11-20 10:00:00');
        $second = $this->finalised($lead, ['salary' => 6500]);
        $this->service->startDraft($lead, $this->userId);

        $body = $this->body($this->api->index($this->request(null, ['per_page' => 5000]), (string) $lead->id));

        $this->assertSame(2, $body['total']);
        $this->assertSame(200, $body['per_page']);
        $this->assertSame([$second->id, $first->id], array_column($body['data'], 'id'));
        $this->assertSame(['final', 'superseded'], array_column($body['data'], 'status'));
        $this->assertArrayNotHasKey('lines', $body['data'][0]);
        $this->assertFalse($body['data'][1]['is_current']);
    }

    public function test_show_returns_a_superseded_assessment_with_lines(): void
    {
        $lead = $this->makeLead();
        $first = $this->finalised($lead, ['salary' => 6000]);
        $this->finalised($lead, ['salary' => 6500]);

        $body = $this->body($this->api->show($this->request(), (string) $lead->id, (string) $first->id));

        $this->assertSame('superseded', $body['data']['status']);
        $this->assertEquals(6000, $body['data']['lines'][0]['amount']);
    }

    public function test_verification_is_reported(): void
    {
        $lead = $this->makeLead();
        $assessment = $this->finalised($lead, ['bank' => 1000]);
        $this->service->verify($assessment, $this->userId);

        $data = $this->body($this->api->current($this->request(), (string) $lead->id))['data'];

        $this->assertTrue($data['verified']);
        $this->assertNotNull($data['verified_at']);
    }

    public function test_another_companys_token_cannot_see_the_lead_or_its_assessments(): void
    {
        $lead = $this->makeLead();
        $assessment = $this->finalised($lead, ['bank' => 1000]);
        DB::table('companies')->insert(['id' => 2, 'company_name' => 'Other', 'currency_id' => 1]);
        $other = $this->request(2);

        foreach ([
            $this->api->index($other, (string) $lead->id),
            $this->api->current($other, (string) $lead->id),
            $this->api->show($other, (string) $lead->id, (string) $assessment->id),
        ] as $response) {
            $this->assertSame(404, $response->getStatusCode());
        }
    }

    public function test_an_assessment_of_a_different_lead_is_not_reachable_through_this_lead(): void
    {
        $lead = $this->makeLead('One');
        $stranger = $this->makeLead('Two');
        $foreign = $this->finalised($stranger, ['bank' => 1000]);

        $this->assertSame(404, $this->api->show($this->request(), (string) $lead->id, (string) $foreign->id)->getStatusCode());
    }

    public function test_non_numeric_ids_are_a_404_not_a_server_error(): void
    {
        $lead = $this->makeLead();

        $this->assertSame(404, $this->api->current($this->request(), 'abc')->getStatusCode());
        $this->assertSame(404, $this->api->show($this->request(), (string) $lead->id, 'current-ish')->getStatusCode());
        $this->assertSame(404, $this->api->index($this->request(), '1; drop table leads')->getStatusCode());
    }

    public function test_everything_is_a_404_while_the_feature_flag_is_off(): void
    {
        $lead = $this->makeLead();
        $this->finalised($lead, ['bank' => 1000]);
        $this->setFeatureFlag('crm.lead-financial-assessments', false);

        $this->assertSame(404, $this->api->current($this->request(), (string) $lead->id)->getStatusCode());
        $this->assertSame(404, $this->api->index($this->request(), (string) $lead->id)->getStatusCode());
    }

    public function test_a_request_without_a_company_resolves_to_nothing(): void
    {
        $lead = $this->makeLead();
        $this->finalised($lead, ['bank' => 1000]);
        $request = Request::create('/api/leads/1/financial-assessments', 'GET');

        $this->assertSame(404, $this->api->current($request, (string) $lead->id)->getStatusCode());
    }

    public function test_token_scopes_cover_the_new_routes(): void
    {
        $config = require dirname(__DIR__, 3).'/config/api-token-scopes.php';
        $json = json_encode($config);

        foreach (['api.leads.financial-assessments.index', 'api.leads.financial-assessments.current', 'api.leads.financial-assessments.show', 'api.lead-fields.index'] as $route) {
            $this->assertStringContainsString($route, $json);
        }
    }
}
