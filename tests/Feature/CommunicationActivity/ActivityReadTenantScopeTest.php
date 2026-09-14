<?php

namespace Tests\Feature\CommunicationActivity;

use App\Http\Controllers\CommunicationActivityController;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Tests\TestCase;

/**
 * The activity read endpoints serve API-token requests, where CompanyScope is
 * inactive, so they must check the tenant themselves. Controller methods are
 * called directly: ApiTokenAuth has already set X-COMPANY-ID by that point.
 */
class ActivityReadTenantScopeTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Schema::create('deals', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id')->nullable();
        });

        Schema::create('leads', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id')->nullable();
            $table->softDeletes();
        });

        Schema::create('communication_activities', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedBigInteger('deal_id')->nullable();
            $table->unsignedBigInteger('lead_id')->nullable();
            $table->unsignedBigInteger('parent_activity_id')->nullable();
            $table->string('channel_type')->nullable();
            $table->text('message_content')->nullable();
            $table->timestamp('timestamp')->nullable();
            $table->timestamps();
        });

        DB::table('deals')->insert([['id' => 1, 'company_id' => 1], ['id' => 2, 'company_id' => 2]]);
        DB::table('leads')->insert([['id' => 1, 'company_id' => 1], ['id' => 2, 'company_id' => 2]]);
        DB::table('communication_activities')->insert([
            ['company_id' => 1, 'deal_id' => 1, 'lead_id' => 1, 'channel_type' => 'email', 'message_content' => 'ours', 'timestamp' => now()],
            ['company_id' => 2, 'deal_id' => 2, 'lead_id' => 2, 'channel_type' => 'email', 'message_content' => 'theirs', 'timestamp' => now()],
        ]);
    }

    public function test_deal_activities_of_another_company_are_not_found(): void
    {
        $this->expectException(NotFoundHttpException::class);

        $this->controller()->getDealActivities($this->requestForCompany(1), 2);
    }

    public function test_own_deal_activities_are_listed(): void
    {
        $result = $this->controller()->getDealActivities($this->requestForCompany(1), 1);

        $this->assertSame(['ours'], collect($result['data']->items())->pluck('message_content')->all());
    }

    public function test_lead_activities_of_another_company_are_not_found(): void
    {
        $this->expectException(NotFoundHttpException::class);

        $this->controller()->getLeadActivities($this->requestForCompany(1), 2);
    }

    public function test_channel_listing_only_returns_own_company(): void
    {
        $result = $this->controller()->getActivitiesByChannel($this->requestForCompany(1), 'email');

        $this->assertSame(['ours'], collect($result['data']->items())->pluck('message_content')->all());
    }

    public function test_request_without_company_is_not_found(): void
    {
        $this->expectException(NotFoundHttpException::class);

        $this->controller()->getActivitiesByChannel(Request::create('/'), 'email');
    }

    private function controller(): CommunicationActivityController
    {
        return app(CommunicationActivityController::class);
    }

    private function requestForCompany(int $companyId): Request
    {
        return Request::create('/', 'GET', [], [], [], ['HTTP_X_COMPANY_ID' => (string) $companyId]);
    }
}
