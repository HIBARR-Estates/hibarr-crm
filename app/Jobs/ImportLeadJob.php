<?php

namespace App\Jobs;

use App\Models\Deal;
use App\Models\Lead;
use App\Models\LeadCategory;
use App\Models\LeadLifecycleStatus;
use App\Models\LeadNote;
use App\Models\LeadPipeline;
use App\Models\LeadSource;
use App\Models\PipelineStage;
use App\Models\User;
use App\Traits\ExcelImportable;
use App\Traits\RecordsCrmEvents;
use App\Traits\UniversalSearchTrait;
use Exception;
use Illuminate\Bus\Batchable;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Session;

class ImportLeadJob implements ShouldQueue
{

    use Batchable, Dispatchable, InteractsWithQueue, Queueable, SerializesModels, UniversalSearchTrait;
    use ExcelImportable;
    use RecordsCrmEvents;

    private $row;
    private $columns;
    private $company;
    private $importingUserId;

    /**
     * Create a new job instance.
     *
     * @return void
     */
    public function __construct($row, $columns, $company = null)
    {
        $this->row = $row;
        $this->columns = $columns;
        $this->company = $company;
        $this->importingUserId = user()?->id;
    }

    /**
     * Execute the job.
     *
     * @return void
     */
    public function handle()
    {
        $leadCount = Session::get('total_leads');
        $leadCount++;
        info($leadCount);
        Session::put('total_leads', $leadCount);

        if ($this->isColumnExists('name')) {

            $rawEmail = $this->isColumnExists('email') ? $this->getColumnValue('email') : null;
            $emailForDupCheck = $rawEmail !== null && $rawEmail !== '' ? trim((string) $rawEmail) : '';

            if ($emailForDupCheck !== '') {
                if (! $this->isEmailValid($emailForDupCheck)) {
                    $this->failJob(__('messages.invalidData'));

                    return;
                }

                $lead = Lead::where('client_email', $emailForDupCheck)->where('company_id', $this->company?->id)->first();
                $user = User::where('email', $emailForDupCheck)->first();

                if ($lead || $user) {
                    $this->failJobWithMessage(__('messages.duplicateEntryForEmail') . $emailForDupCheck);

                    return;
                }
            }

            DB::beginTransaction();
            Session::put('is_imported', true);
            Session::put('is_deal', true);
            try {

                $leadSource = null;

                if ($this->isColumnExists('source') && $this->company?->id) {
                    $leadSource = LeadSource::resolveFromText($this->company->id, $this->getColumnValue('source'));
                }

                $leadCategory = null;

                if ($this->isColumnExists('category') && $this->company?->id) {
                    $leadCategory = LeadCategory::resolveFromText($this->company->id, $this->getColumnValue('category'));
                }

                $lifecycleStatus = null;

                if ($this->isColumnExists('lifecycle_status') && $this->company?->id) {
                    $lifecycleStatus = LeadLifecycleStatus::resolveFromText(
                        $this->company->id,
                        $this->getColumnValue('lifecycle_status')
                    );
                }

                $lead = new Lead();
                $lead->company_id = $this->company?->id;
                $lead->client_name = $this->getColumnValue('name');
                $lead->client_email = $emailForDupCheck !== '' ? $emailForDupCheck : null;
                $lead->salutation = $this->isColumnExists('salutation') ? $this->getColumnValue('salutation') : null;
                $genderValue = $this->isColumnExists('gender') ? strtolower(trim($this->getColumnValue('gender'))) : null;
                $lead->gender = ($genderValue && in_array($genderValue, ['male', 'female'])) ? $genderValue : null;
                $lead->note = $this->isColumnExists('note') ? $this->getColumnValue('note') : null;
                $lead->company_name = $this->isColumnExists('company_name') ? $this->getColumnValue('company_name') : null;
                $lead->website = $this->isColumnExists('company_website') ? $this->getColumnValue('company_website') : null;
                $lead->mobile = $this->isColumnExists('mobile') ? $this->getColumnValue('mobile') : null;
                $lead->office = $this->isColumnExists('company_phone') ? $this->getColumnValue('company_phone') : null;
                $lead->country = $this->isColumnExists('country') ? $this->getColumnValue('country') : null;
                $lead->state = $this->isColumnExists('state') ? $this->getColumnValue('state') : null;
                $lead->city = $this->isColumnExists('city') ? $this->getColumnValue('city') : null;
                $lead->postal_code = $this->isColumnExists('postal_code') ? $this->getColumnValue('postal_code') : null;
                $lead->address = $this->isColumnExists('address') ? $this->getColumnValue('address') : null;
                $lead->source_id = $leadSource?->id;
                $lead->category_id = $leadCategory?->id;
                // Leave unset (null) when the cell is blank or doesn't match a known
                // status — LeadObserver will fill in the company's default status.
                $lead->lead_lifecycle_status_id = $lifecycleStatus?->id;

                $leads = Session::get('leads', []);

                $leads[] = [
                    'lead_name'  => $lead->client_name,
                    'email' => $lead->client_email,
                    'deal_name' => $lead->client_name,
                ];

                info($leads);
                Session::put('leads', $leads);

                $lead->save();

                $notesValue = $this->isColumnExists('notes') ? $this->getColumnValue('notes') : null;
                if ($notesValue !== null && trim((string) $notesValue) !== '') {
                    $note = new LeadNote();
                    $note->lead_id = $lead->id;
                    $note->title = 'Imported note';
                    $note->details = trim_editor((string) $notesValue);
                    $note->type = 0;
                    $importingUserId = $this->importingUserId;
                    if ($importingUserId !== null) {
                        $note->added_by = $importingUserId;
                        $note->last_updated_by = $importingUserId;
                    }
                    $note->save();

                    $this->recordCrmEvent('lead_updated', $lead, [
                        'metadata' => [
                            'action' => 'note_added',
                            'comment' => 'Note added: Imported note',
                            'note_id' => $note->id,
                            'note_title' => $note->title,
                            'note_type' => 'public',
                        ],
                        'user_id' => $importingUserId,
                    ]);
                }

                $leadPipeline = LeadPipeline::where('default', '1')->where('company_id', $lead->company_id)->first();
                $leadStage = PipelineStage::where('default', '1')->where('lead_pipeline_id', $leadPipeline->id)->where('company_id', $lead->company_id)->first();

                $deal = new Deal();
                $deal->company_id = $lead->company_id;
                $deal->lead_id = $lead->id;
                $deal->name = $lead->client_name ?? '';
                $deal->lead_pipeline_id = $leadPipeline->id;
                $deal->pipeline_stage_id = $leadStage->id;
                $deal->value = 0;
                $deal->currency_id = $lead->company?->currency_id;
                $deal->save();

                // Log search
                $this->logSearchEntry($lead->id, $lead->client_name, 'lead-contact', 'lead', $lead->company_id);

                if (!is_null($lead->client_email)) {
                    $this->logSearchEntry($lead->id, $lead->client_email, 'lead-contact', 'lead', $lead->company_id);
                }

                if (!is_null($lead->company_name)) {
                    $this->logSearchEntry($lead->id, $lead->company_name, 'lead-contact', 'lead', $lead->company_id);
                }

                DB::commit();
            } catch (Exception $e) {
                DB::rollBack();
                $this->failJobWithMessage($e->getMessage());
            }
        }
        else {
            $this->failJob(__('messages.invalidData'));
        }


    }

}

