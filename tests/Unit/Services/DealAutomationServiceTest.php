<?php

namespace Tests\Unit\Services;

use App\Models\Deal;
use App\Models\DealAutomation;
use App\Models\PipelineStage;
use App\Services\ConditionEvaluatorService;
use App\Services\DealAutomationService;
use App\Services\FieldResolverService;
use Mockery;
use Tests\TestCase;

class DealAutomationServiceTest extends TestCase
{
    protected $fieldResolver;
    protected $conditionEvaluator;

    protected function setUp(): void
    {
        parent::setUp();

        $this->fieldResolver = Mockery::mock(FieldResolverService::class);
        $this->conditionEvaluator = Mockery::mock(ConditionEvaluatorService::class);
    }

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    public function test_process_executes_actions_when_conditions_pass()
    {
        // Mock Deal
        $deal = Mockery::mock(Deal::class)->makePartial();
        $deal->id = 1;
        $deal->lead_pipeline_id = 1;
        $deal->pipeline_stage_id = 1;
        $deal->shouldReceive('save')->once();

        // Mock Automation
        $automation = Mockery::mock(DealAutomation::class)->makePartial();
        $automation->setRawAttributes(['id' => 1, 'name' => 'Test Auto']);
        
        $condition = (object)['field' => 'val', 'operator' => '>', 'value' => 100];
        $action = (object)['target_stage_id' => 2, 'target_pipeline_id' => 1, 'forward_only' => false];
        
        $automation->setRelation('conditions', collect([$condition]));
        $automation->setRelation('actions', collect([$action]));

        // Mock Service (Partial)
        $service = Mockery::mock(DealAutomationService::class, [
            $this->fieldResolver,
            $this->conditionEvaluator
        ])->makePartial();
        $service->shouldAllowMockingProtectedMethods();
        
        $service->shouldReceive('getAutomations')
            ->with(1, 'trigger')
            ->andReturn(collect([$automation]));

        // Mock Services
        $this->fieldResolver->shouldReceive('resolve')->andReturn(200);
        $this->conditionEvaluator->shouldReceive('evaluate')->andReturn(true);

        $service->process($deal, 'trigger');
        
        $this->assertEquals(2, $deal->pipeline_stage_id);
    }

    public function test_process_skips_actions_when_conditions_fail()
    {
        // Mock Deal
        $deal = Mockery::mock(Deal::class)->makePartial();
        $deal->id = 1;
        $deal->lead_pipeline_id = 1;
        $deal->pipeline_stage_id = 1;
        $deal->shouldReceive('save')->never();

        // Mock Automation
        $automation = Mockery::mock(DealAutomation::class)->makePartial();
        $automation->setRawAttributes(['id' => 1, 'name' => 'Test Auto']);
        
        $condition = (object)['field' => 'val', 'operator' => '>', 'value' => 100];
        $action = (object)['target_stage_id' => 2, 'target_pipeline_id' => 1, 'forward_only' => false];
        
        $automation->setRelation('conditions', collect([$condition]));
        $automation->setRelation('actions', collect([$action]));

        // Mock Service (Partial)
        $service = Mockery::mock(DealAutomationService::class, [
            $this->fieldResolver,
            $this->conditionEvaluator
        ])->makePartial();
        $service->shouldAllowMockingProtectedMethods();
        
        $service->shouldReceive('getAutomations')
            ->with(1, 'trigger')
            ->andReturn(collect([$automation]));

        // Mock Services
        $this->fieldResolver->shouldReceive('resolve')->andReturn(50);
        $this->conditionEvaluator->shouldReceive('evaluate')->andReturn(false);

        $service->process($deal, 'trigger');
        
        $this->assertEquals(1, $deal->pipeline_stage_id);
    }

    public function test_process_respects_forward_only_logic()
    {
        // Mock Deal
        $deal = Mockery::mock(Deal::class)->makePartial();
        $deal->id = 1;
        $deal->lead_pipeline_id = 1;
        $deal->pipeline_stage_id = 1;
        $deal->shouldReceive('save')->never();

        // Mock Automation
        $automation = Mockery::mock(DealAutomation::class)->makePartial();
        $automation->setRawAttributes(['id' => 1, 'name' => 'Test Auto']);
        
        $action = (object)['target_stage_id' => 2, 'target_pipeline_id' => 1, 'forward_only' => true];
        
        $automation->setRelation('conditions', collect([])); // No conditions
        $automation->setRelation('actions', collect([$action]));

        // Mock Stages
        $currentStage = Mockery::mock(PipelineStage::class)->makePartial();
        $currentStage->setRawAttributes(['id' => 1, 'priority' => 10, 'name' => 'Stage 10']);
        
        $targetStage = Mockery::mock(PipelineStage::class)->makePartial();
        $targetStage->setRawAttributes(['id' => 2, 'priority' => 5, 'name' => 'Stage 5']);

        // Mock Service (Partial)
        $service = Mockery::mock(DealAutomationService::class, [
            $this->fieldResolver,
            $this->conditionEvaluator
        ])->makePartial();
        $service->shouldAllowMockingProtectedMethods();
        
        $service->shouldReceive('getAutomations')
            ->with(1, 'trigger')
            ->andReturn(collect([$automation]));
            
        $service->shouldReceive('getStage')->with(1)->andReturn($currentStage);
        $service->shouldReceive('getStage')->with(2)->andReturn($targetStage);

        $service->process($deal, 'trigger');
        
        $this->assertEquals(1, $deal->pipeline_stage_id);
    }
}
