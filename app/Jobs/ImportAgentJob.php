<?php

namespace App\Jobs;

use App\Models\LeadAgent;
use App\Models\LeadCategory;
use App\Models\Role;
use App\Models\User;
use Exception;
use Illuminate\Bus\Batchable;
use Illuminate\Bus\Queueable;
use App\Traits\ExcelImportable;
use Illuminate\Support\Facades\DB;
use App\Traits\UniversalSearchTrait;
use Illuminate\Queue\SerializesModels;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;

class ImportAgentJob implements ShouldQueue
{

    use Batchable, Dispatchable, InteractsWithQueue, Queueable, SerializesModels, UniversalSearchTrait;
    use ExcelImportable;

    private $row;
    private $columns;
    private $company;

    public function __construct($row, $columns, $company = null)
    {
        $this->row = $row;
        $this->columns = $columns;
        $this->company = $company;
    }

    public function handle()
    {
        if (!$this->isColumnExists('name')) {
            $this->failJob(__('messages.invalidData'));
            return;
        }

        $name = $this->getColumnValue('name');
        $email = $this->isColumnExists('email') && $this->isEmailValid($this->getColumnValue('email'))
            ? $this->getColumnValue('email')
            : null;
        $mobile = $this->isColumnExists('mobile') ? $this->getColumnValue('mobile') : null;
        $categoryName = $this->isColumnExists('category') ? $this->getColumnValue('category') : null;
        $status = $this->isColumnExists('status') ? strtolower($this->getColumnValue('status')) : 'enabled';

        // Normalize status
        if (!in_array($status, ['enabled', 'disabled'])) {
            $status = 'enabled';
        }

        // Check for existing user by email
        $user = null;

        if ($email) {
            $user = User::where('email', $email)->first();
        }

        DB::beginTransaction();

        try {
            if (!$user) {
                // Create new user
                $user = new User();
                $user->company_id = $this->company?->id;
                $user->name = $name;
                $user->email = $email;
                $user->password = bcrypt(str()->random(16));
                $user->mobile = $mobile;
                $user->save();

                // Attach employee role
                $role = Role::where('name', 'employee')
                    ->where('company_id', $this->company?->id)
                    ->select('id')
                    ->first();

                if ($role) {
                    $user->attachRole($role->id);
                    $user->assignUserRolePermission($role->id);
                }
            }

            // Resolve category
            $categoryId = null;

            if ($categoryName) {
                $category = LeadCategory::where('company_id', $this->company?->id)
                    ->where('category_name', $categoryName)
                    ->first();

                if ($category) {
                    $categoryId = $category->id;
                }
            }

            // Check if LeadAgent already exists for this user + category combo
            $exists = LeadAgent::where('user_id', $user->id)
                ->where('company_id', $this->company?->id)
                ->where('lead_category_id', $categoryId)
                ->exists();

            if (!$exists) {
                LeadAgent::create([
                    'company_id' => $this->company?->id,
                    'user_id' => $user->id,
                    'lead_category_id' => $categoryId,
                    'status' => $status,
                    'added_by' => $user->id,
                ]);
            }

            DB::commit();
        } catch (Exception $e) {
            DB::rollBack();
            $this->failJobWithMessage($e->getMessage());
        }
    }

}
