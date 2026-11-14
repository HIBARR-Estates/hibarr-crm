<?php

namespace Tests\Feature\CommunicationActivity;

use App\Http\Controllers\CommunicationActivityController;
use App\Http\Requests\CommunicationActivity\SendEmailRequest;
use App\Support\RequestCompany;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Tests\TestCase;

/**
 * sendEmailToCustomer resolves activity_id by id and then *writes* to it
 * (metadata.direction = outbound). That path serves API-token requests, where
 * CompanyScope is inactive, so it must scope the lookup itself. Otherwise any
 * authenticated caller can pass another company's activity_id and rewrite it.
 *
 * Controller methods are called directly; no mail is sent because the tenant
 * check rejects the request before the send.
 */
class SendEmailTenantScopeTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Schema::create('communication_activities', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedBigInteger('deal_id')->nullable();
            $table->unsignedBigInteger('lead_id')->nullable();
            $table->string('channel_type')->nullable();
            $table->text('message_content')->nullable();
            $table->json('sender_info')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamp('timestamp')->nullable();
            $table->timestamps();
        });

        DB::table('communication_activities')->insert([
            [
                'id' => 1,
                'company_id' => 1,
                'channel_type' => 'email',
                'message_content' => 'ours',
                'sender_info' => json_encode(['contact' => 'ours@example.com']),
                'metadata' => json_encode(['direction' => 'inbound']),
                'timestamp' => now(),
            ],
            [
                'id' => 2,
                'company_id' => 2,
                'channel_type' => 'email',
                'message_content' => 'theirs',
                'sender_info' => json_encode(['contact' => 'theirs@example.com']),
                'metadata' => json_encode(['direction' => 'inbound']),
                'timestamp' => now(),
            ],
        ]);
    }

    public function test_activity_of_another_company_is_not_found(): void
    {
        $this->expectException(NotFoundHttpException::class);

        $this->controller()->sendEmailToCustomer($this->requestForCompany(1, 2));
    }

    public function test_activity_of_another_company_is_left_unchanged(): void
    {
        try {
            $this->controller()->sendEmailToCustomer($this->requestForCompany(1, 2));
            $this->fail('Expected a NotFoundHttpException for another company activity.');
        } catch (NotFoundHttpException $e) {
            // Expected: the cross-tenant id must not resolve.
        }

        $row = DB::table('communication_activities')->where('id', 2)->first();

        // The unscoped bug rewrote this row's direction before sending.
        $this->assertSame('theirs', $row->message_content);
        $this->assertSame(json_encode(['direction' => 'inbound']), $row->metadata);
    }

    public function test_own_activity_is_resolved(): void
    {
        // Reaches past the tenant check; fails later on the missing deal/lead,
        // which proves the lookup itself was allowed.
        $result = $this->controller()->sendEmailToCustomer($this->requestForCompany(1, 1));

        $this->assertSame('fail', $result['status']);
    }

    private function controller(): CommunicationActivityController
    {
        return app(CommunicationActivityController::class);
    }

    private function requestForCompany(int $companyId, int $activityId): SendEmailRequest
    {
        // Deliberately wrong header: the company comes from the token attribute.
        $wrongHeaderCompanyId = $companyId === 1 ? 2 : 1;

        $request = SendEmailRequest::create('/', 'POST', [
            'activity_id' => $activityId,
            'subject' => 'hello',
            'message' => 'body',
        ]);
        $request->headers->set('X-COMPANY-ID', (string) $wrongHeaderCompanyId);
        $request->attributes->set(RequestCompany::TOKEN_COMPANY_ATTRIBUTE, $companyId);

        return $request;
    }
}