<?php

namespace App\Services\Dashboard;

use App\Enums\MaritalStatus;
use App\Enums\MlmCommissionStatus;
use App\Enums\MlmCommissionType;
use App\Enums\OutcomeStatus;
use App\Models\Currency;
use App\Models\Deal;
use App\Models\Designation;
use App\Models\EmployeeDetails;
use App\Models\Lead;
use App\Models\LeadAgent;
use App\Models\LeadCategory;
use App\Models\LeadPipeline;
use App\Models\MlmCommission;
use App\Models\PipelineStage;
use App\Models\Role;
use App\Models\Team;
use App\Models\User;
use App\Services\LeadLifecycleStatusService;
use App\Support\DemoSeeding;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;

/**
 * Local-only filler for the team dashboard: a three-generation downline under
 * the signed-in user, plus the deals, leads and commissions those panels read.
 *
 * Idempotent on the demo email prefix (`teamdemo.{userId}.*@hibarr.test`) so a
 * second visit does not double the network. Production is refused by the
 * controller, not here.
 */
class TeamDashboardDemoDataService
{
    private const EMAIL_DOMAIN = 'hibarr.test';

    private const GEN1 = 6;

    private const GEN2_PER_PARENT = 2;

    private const GEN3_COUNT = 6;

    /** @var array<int, LeadAgent> */
    private array $downline = [];

    private string $passwordHash = '';

    public function seedFor(User $viewer): array
    {
        set_time_limit(120);

        $companyId = (int) $viewer->company_id;

        if ($companyId < 1) {
            throw new \RuntimeException('The signed-in account has no company to seed into.');
        }

        if ($this->alreadySeeded((int) $viewer->id)) {
            return ['created' => false, 'reason' => 'already_seeded'];
        }

        // bcrypt once — hashing per agent was a large part of the 30s timeout.
        $this->passwordHash = Hash::make(DemoSeeding::password());

        $pipeline = LeadPipeline::query()
            ->where('company_id', $companyId)
            ->orderByDesc('default')
            ->first();
        $stage = $pipeline
            ? PipelineStage::query()
                ->where('lead_pipeline_id', $pipeline->id)
                ->orderBy('priority')
                ->first()
            : null;
        $currency = Currency::query()->where('company_id', $companyId)->first()
            ?? $viewer->company?->currency;

        if (! $pipeline || ! $stage || ! $currency) {
            throw new \RuntimeException('Need a pipeline, a stage and a currency on this company before the team page can be filled.');
        }

        $wasSeeding = config('app.seeding');
        config(['app.seeding' => true]);
        Notification::fake();

        try {
            return DB::transaction(function () use ($viewer, $companyId, $pipeline, $stage, $currency) {
                $root = $this->ensureRootAgent($viewer, $companyId);
                $this->createDownline($root, $viewer, $companyId);
                $this->createLeadsAndDeals($viewer, $companyId, $pipeline, $stage, $currency);
                $this->createCommissions($root, $companyId);

                return [
                    'created' => true,
                    'agents' => count($this->downline),
                    'reason' => null,
                ];
            });
        } finally {
            config(['app.seeding' => $wasSeeding]);
        }
    }

    private function alreadySeeded(int $userId): bool
    {
        return User::query()
            ->where('email', 'like', $this->emailPrefix($userId).'%@'.self::EMAIL_DOMAIN)
            ->exists();
    }

    private function emailPrefix(int $userId): string
    {
        return 'teamdemo.'.$userId.'.';
    }

    private function ensureRootAgent(User $viewer, int $companyId): LeadAgent
    {
        $existing = LeadAgent::query()->where('user_id', $viewer->id)->first();

        if ($existing) {
            return $existing;
        }

        $agent = new LeadAgent;
        $agent->company_id = $companyId;
        $agent->user_id = $viewer->id;
        $agent->status = 'enabled';
        $agent->lead_category_id = LeadCategory::query()->where('company_id', $companyId)->value('id');
        $agent->save();

        return $agent;
    }

    private function createDownline(LeadAgent $root, User $viewer, int $companyId): void
    {
        $role = Role::query()->where('name', 'employee')->first();
        $departmentId = Team::query()->where('company_id', $companyId)->value('id');
        $designationId = Designation::query()->where('company_id', $companyId)->value('id');
        $categoryId = LeadCategory::query()->where('company_id', $companyId)->value('id');
        $faker = \Faker\Factory::create();

        $total = self::GEN1 + (self::GEN1 * self::GEN2_PER_PARENT) + self::GEN3_COUNT;
        $joinDates = $this->joinDates($total);
        $cursor = 0;

        $gen1 = [];
        for ($i = 0; $i < self::GEN1; $i++) {
            $gen1[] = $this->createAgent(
                $viewer,
                $companyId,
                $root,
                $joinDates[$cursor++] ?? now(),
                $departmentId,
                $designationId,
                $categoryId,
                $faker,
            );
        }

        $gen2 = [];
        foreach ($gen1 as $parent) {
            for ($i = 0; $i < self::GEN2_PER_PARENT; $i++) {
                $gen2[] = $this->createAgent(
                    $viewer,
                    $companyId,
                    $parent,
                    $joinDates[$cursor++] ?? now(),
                    $departmentId,
                    $designationId,
                    $categoryId,
                    $faker,
                );
            }
        }

        for ($i = 0; $i < self::GEN3_COUNT; $i++) {
            $parent = $gen2[$i % max(count($gen2), 1)] ?? $gen1[0];
            $this->createAgent(
                $viewer,
                $companyId,
                $parent,
                $joinDates[$cursor++] ?? now(),
                $departmentId,
                $designationId,
                $categoryId,
                $faker,
            );
        }

        if ($role && $this->downline) {
            DB::table('role_user')->insertOrIgnore(array_map(
                fn (LeadAgent $agent) => [
                    'user_id' => $agent->user_id,
                    'role_id' => $role->id,
                ],
                $this->downline,
            ));
        }
    }

    /**
     * Writes the agent row without observers. Level assignment, cycle
     * enrollment and HierarchyService::setParent each cost a round-trip;
     * doing all three per person is what blew the 30s PHP timeout. The team
     * dashboard walks parent_agent_id, so the FK alone is enough here.
     */
    private function createAgent(
        User $viewer,
        int $companyId,
        LeadAgent $parent,
        \DateTimeInterface $joinedAt,
        mixed $departmentId,
        mixed $designationId,
        mixed $categoryId,
        \Faker\Generator $faker,
    ): LeadAgent {
        $seq = count($this->downline) + 1;
        $email = $this->emailPrefix((int) $viewer->id).$seq.'@'.self::EMAIL_DOMAIN;
        $joined = \Illuminate\Support\Carbon::parse($joinedAt);

        $user = User::withoutEvents(function () use ($companyId, $email, $faker) {
            $user = new User;
            $user->company_id = $companyId;
            $user->name = $faker->name();
            $user->email = $email;
            $user->password = $this->passwordHash;
            $user->gender = $faker->randomElement(['male', 'female']);
            $user->locale = 'en';
            $user->status = 'active';
            $user->login = 'enable';
            $user->email_notifications = false;
            $user->dark_theme = false;
            $user->rtl = false;
            $user->save();

            return $user;
        });

        EmployeeDetails::withoutEvents(function () use ($user, $companyId, $departmentId, $designationId, $joined, $seq) {
            $details = new EmployeeDetails;
            $details->user_id = $user->id;
            $details->company_id = $companyId;
            $details->employee_id = 'TEAMDEMO-'.$user->id.'-'.$seq;
            $details->joining_date = $joined;
            $details->department_id = $departmentId;
            $details->designation_id = $designationId;
            $details->calendar_view = 'task,events,holiday,tickets,leaves,follow_ups';
            $details->marital_status = MaritalStatus::Single;
            $details->save();
        });

        $agent = LeadAgent::withoutEvents(function () use (
            $user, $viewer, $companyId, $parent, $categoryId, $joined
        ) {
            $agent = new LeadAgent;
            $agent->company_id = $companyId;
            $agent->user_id = $user->id;
            $agent->status = 'enabled';
            $agent->parent_agent_id = $parent->id;
            $agent->lead_category_id = $categoryId;
            $agent->added_by = $viewer->id;
            $agent->created_at = $joined;
            $agent->updated_at = $joined;
            $agent->save();

            return $agent;
        });

        $this->downline[] = $agent;

        return $agent;
    }

    /**
     * Spread joins across the last 12 months, denser in the recent ones so the
     * default 30-day window still has a bar.
     *
     * @return array<int, \Illuminate\Support\Carbon>
     */
    private function joinDates(int $count): array
    {
        $dates = [];

        for ($i = 0; $i < $count; $i++) {
            $monthSlot = (int) floor($i * 12 / max($count, 1));
            $monthsAgo = 11 - $monthSlot;
            $dates[] = now()->copy()
                ->subMonths($monthsAgo)
                ->startOfMonth()
                ->addDays(1 + ($i % 24))
                ->setTime(10, 15);
        }

        return $dates;
    }

    private function createLeadsAndDeals(
        User $viewer,
        int $companyId,
        LeadPipeline $pipeline,
        PipelineStage $stage,
        Currency $currency,
    ): void {
        $faker = \Faker\Factory::create();
        $defaultStatusId = app(LeadLifecycleStatusService::class)
            ->resolveDefaultForCompany($companyId)?->id;
        $seq = 0;

        foreach ($this->downline as $index => $agent) {
            $openDeals = 1 + ($index % 2);
            $wonDeals = 1;
            $contactedLeads = 1;
            $untouchedLeads = $index % 2;

            for ($i = 0; $i < $contactedLeads + $untouchedLeads; $i++) {
                $seq++;
                $contacted = $i < $contactedLeads;
                $when = now()->copy()->subDays(4 + ($seq % 40));

                $this->createLead(
                    $agent,
                    $viewer,
                    $companyId,
                    $faker,
                    'teamdemo-lead.'.$agent->user_id.'.'.$seq.'@'.self::EMAIL_DOMAIN,
                    $when,
                    $defaultStatusId,
                    $contacted ? $when->copy()->addHours(6) : null,
                );
            }

            for ($i = 0; $i < $openDeals; $i++) {
                $seq++;
                $this->createDeal(
                    $agent,
                    $viewer,
                    $companyId,
                    $pipeline,
                    $stage,
                    $currency,
                    $faker,
                    $seq,
                    won: false,
                    at: now()->copy()->subDays(8 + ($seq % 50)),
                );
            }

            for ($i = 0; $i < $wonDeals; $i++) {
                $seq++;
                $this->createDeal(
                    $agent,
                    $viewer,
                    $companyId,
                    $pipeline,
                    $stage,
                    $currency,
                    $faker,
                    $seq,
                    won: true,
                    at: now()->copy()->subDays(3 + ($seq % 320)),
                );
            }
        }
    }

    /**
     * next_follow_up lived on leads until the deal split; the column is gone
     * from this table. Do not set it here.
     */
    private function createLead(
        LeadAgent $agent,
        User $viewer,
        int $companyId,
        \Faker\Generator $faker,
        string $email,
        \DateTimeInterface $at,
        ?int $lifecycleStatusId = null,
        mixed $firstContactedAt = null,
    ): Lead {
        return Lead::withoutEvents(function () use (
            $agent, $viewer, $companyId, $faker, $email, $at, $lifecycleStatusId, $firstContactedAt
        ) {
            $lead = new Lead;
            $lead->company_id = $companyId;
            $lead->hash = md5($email.microtime());
            $lead->client_name = $faker->name();
            $lead->client_email = $email;
            $lead->company_name = $faker->company();
            $lead->lead_owner = $agent->user_id;
            $lead->added_by = $viewer->id;
            $lead->lead_lifecycle_status_id = $lifecycleStatusId;
            $lead->column_priority = 0;
            $lead->assigned_at = $at;
            $lead->first_contacted_at = $firstContactedAt;
            $lead->created_at = $at;
            $lead->updated_at = $at;
            $lead->save();

            return $lead;
        });
    }

    private function createDeal(
        LeadAgent $agent,
        User $viewer,
        int $companyId,
        LeadPipeline $pipeline,
        PipelineStage $stage,
        Currency $currency,
        \Faker\Generator $faker,
        int $seq,
        bool $won,
        \DateTimeInterface $at,
    ): Deal {
        $contact = $this->createLead(
            $agent,
            $viewer,
            $companyId,
            $faker,
            'teamdemo-deal.'.$agent->user_id.'.'.$seq.'@'.self::EMAIL_DOMAIN,
            $at,
        );

        $deal = null;

        Deal::withoutEvents(function () use (
            &$deal, $contact, $agent, $viewer, $companyId, $pipeline, $stage, $currency, $faker, $seq, $won, $at
        ) {
            $deal = new Deal;
            $deal->company_id = $companyId;
            $deal->hash = md5('deal-'.$seq.microtime());
            $deal->lead_id = $contact->id;
            $deal->lead_pipeline_id = $pipeline->id;
            $deal->pipeline_stage_id = $stage->id;
            $deal->agent_id = $agent->id;
            $deal->name = $faker->catchPhrase();
            $deal->value = $won ? rand(8_000, 48_000) : rand(4_000, 22_000);
            $deal->currency_id = $currency->id;
            $deal->exchange_rate = $currency->exchange_rate ?? 1;
            $deal->next_follow_up = 'yes';
            $deal->column_priority = 0;
            $deal->added_by = $viewer->id;
            $deal->stage_entered_at = $at;

            if ($won) {
                $deal->outcome_status = OutcomeStatus::Won;
                $deal->won_at = $at;
            }

            $deal->created_at = $at;
            $deal->updated_at = $at;
            $deal->save();
        });

        return $deal;
    }

    private function createCommissions(LeadAgent $root, int $companyId): void
    {
        $wonDeals = Deal::query()
            ->whereIn('agent_id', array_map(fn (LeadAgent $agent) => $agent->id, $this->downline))
            ->where('outcome_status', OutcomeStatus::Won->value)
            ->get();

        $agentsById = collect($this->downline)->keyBy('id');
        $n = 0;

        foreach ($wonDeals as $deal) {
            $closer = $agentsById->get((int) $deal->agent_id);
            if (! $closer) {
                continue;
            }

            $paidAt = $deal->won_at ?? $deal->updated_at ?? now();
            $agentAmount = round(((float) $deal->value) * 0.08, 2);
            $status = match ($n % 9) {
                0 => MlmCommissionStatus::Pending,
                1 => MlmCommissionStatus::Reverted,
                default => MlmCommissionStatus::Paid,
            };

            $this->writeCommission(
                $companyId,
                $deal,
                $closer,
                $closer,
                MlmCommissionType::Agent,
                $agentAmount,
                8,
                $status,
                $status === MlmCommissionStatus::Paid ? $paidAt : null,
            );

            $parentId = (int) $closer->parent_agent_id;
            $parent = $parentId === (int) $root->id
                ? $root
                : $agentsById->get($parentId);

            if ($parent && $parent->id !== $closer->id && $status !== MlmCommissionStatus::Pending) {
                $this->writeCommission(
                    $companyId,
                    $deal,
                    $parent,
                    $closer,
                    MlmCommissionType::Upline,
                    round($agentAmount * 0.35, 2),
                    3,
                    $status === MlmCommissionStatus::Reverted
                        ? MlmCommissionStatus::Reverted
                        : MlmCommissionStatus::Paid,
                    $status === MlmCommissionStatus::Paid ? $paidAt : null,
                );
            }

            $n++;
        }
    }

    private function writeCommission(
        int $companyId,
        Deal $deal,
        LeadAgent $recipient,
        LeadAgent $source,
        MlmCommissionType $type,
        float $amount,
        float $percentage,
        MlmCommissionStatus $status,
        mixed $paidAt,
    ): void {
        $row = new MlmCommission;
        $row->company_id = $companyId;
        $row->deal_id = $deal->id;
        $row->agent_id = $recipient->id;
        $row->source_agent_id = $source->id;
        $row->percentage = $percentage;
        $row->amount = $amount;
        $row->type = $type;
        $row->status = $status;
        $row->paid_at = $status === MlmCommissionStatus::Paid ? $paidAt : null;
        $row->reverted_at = $status === MlmCommissionStatus::Reverted ? ($paidAt ?? now()) : null;
        $row->reverted_reason = $status === MlmCommissionStatus::Reverted
            ? 'Demo clawback so the recent feed is not only wins'
            : null;
        $row->created_at = $paidAt ?? now();
        $row->updated_at = $paidAt ?? now();
        $row->save();
    }
}
