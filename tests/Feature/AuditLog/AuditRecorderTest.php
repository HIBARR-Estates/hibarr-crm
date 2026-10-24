<?php

namespace Tests\Feature\AuditLog;

use App\Models\AuditLog;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Foundation\Auth\User as AuthUser;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class AuditRecorderTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Schema::dropIfExists('audit_logs');
        (require base_path('database/migrations/2026_10_23_000002_create_audit_logs_table.php'))->up();

        Schema::dropIfExists('audit_widgets');
        Schema::create('audit_widgets', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id')->nullable();
            $table->string('name');
            $table->string('status')->nullable();
            $table->string('password')->nullable();
            $table->string('pin_code')->nullable();
            $table->string('paystack_key')->nullable();
            $table->timestamp('read_at')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::dropIfExists('audit_actors');
        Schema::create('audit_actors', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id')->nullable();
            $table->string('name');
            $table->string('email')->nullable();
            $table->string('password')->nullable();
        });
    }

    public function test_create_records_new_values_with_secrets_redacted(): void
    {
        $widget = AuditWidget::create(['company_id' => 7, 'name' => 'Alpha', 'password' => 'hunter2', 'pin_code' => '1234', 'paystack_key' => 'pk_live_x']);

        $log = AuditLog::sole();
        $this->assertSame('created', $log->event);
        $this->assertSame(AuditWidget::class, $log->auditable_type);
        $this->assertSame((string) $widget->id, $log->auditable_id);
        $this->assertSame('Alpha', $log->auditable_label);
        $this->assertSame(7, $log->company_id);
        $this->assertSame('Alpha', $log->new_values['name']);
        $this->assertSame('[redacted]', $log->new_values['password']);
        $this->assertSame('[redacted]', $log->new_values['pin_code'], 'hidden attributes are redacted');
        $this->assertSame('[redacted]', $log->new_values['paystack_key']);
        $this->assertArrayNotHasKey('created_at', $log->new_values);
        $this->assertNull($log->old_values);
        $this->assertSame('console', $log->source);
        $this->assertNull($log->user_id);
    }

    public function test_update_records_only_changed_fields_before_and_after(): void
    {
        $widget = AuditWidget::create(['name' => 'Alpha', 'status' => 'open']);
        $widget->update(['status' => 'won']);

        $log = AuditLog::where('event', 'updated')->sole();
        $this->assertSame(['status' => 'open'], $log->old_values);
        $this->assertSame(['status' => 'won'], $log->new_values);
    }

    public function test_update_that_only_marks_something_read_is_not_recorded(): void
    {
        $widget = AuditWidget::create(['name' => 'Alpha']);
        $widget->update(['read_at' => now()]);

        $this->assertSame(0, AuditLog::where('event', 'updated')->count());
    }

    public function test_delete_and_restore_are_recorded_without_a_duplicate_update(): void
    {
        $widget = AuditWidget::create(['name' => 'Alpha', 'status' => 'open']);
        $widget->delete();
        $widget->restore();

        $this->assertSame(['created', 'deleted', 'restored'], AuditLog::orderBy('id')->pluck('event')->all());
        $this->assertSame('open', AuditLog::where('event', 'deleted')->sole()->old_values['status']);
    }

    public function test_signed_in_user_is_recorded_as_the_actor(): void
    {
        $actor = AuditActor::create(['company_id' => 3, 'name' => 'Ayo Admin', 'email' => 'ayo@example.test']);
        Auth::guard()->setUser($actor);

        AuditWidget::create(['name' => 'Alpha']);

        $log = AuditLog::where('auditable_type', AuditWidget::class)->sole();
        $this->assertSame($actor->id, $log->user_id);
        $this->assertSame('Ayo Admin', $log->user_name);
        $this->assertSame(3, $log->company_id, 'falls back to the actor company when the record has none');
    }

    public function test_excluded_models_are_not_recorded(): void
    {
        config(['audit-log.excluded_models' => [AuditWidget::class]]);

        AuditWidget::create(['name' => 'Alpha']);

        $this->assertSame(0, AuditLog::count());
    }

    public function test_rolled_back_change_leaves_no_audit_row(): void
    {
        try {
            DB::transaction(function () {
                AuditWidget::create(['name' => 'Alpha']);
                throw new \RuntimeException('abort');
            });
        } catch (\RuntimeException) {
        }

        $this->assertSame(0, AuditWidget::count());
        $this->assertSame(0, AuditLog::count());
    }

    public function test_a_broken_audit_table_never_breaks_the_write(): void
    {
        AuditWidget::create(['name' => 'Alpha']);
        Schema::drop('audit_logs');

        $widget = AuditWidget::create(['name' => 'Beta']);
        $widget->update(['status' => 'won']);
        $widget->delete();

        $this->assertSame(1, AuditWidget::count());
        $this->assertSame(1, AuditWidget::withTrashed()->where('name', 'Beta')->whereNotNull('deleted_at')->count());
    }
}

class AuditWidget extends Model
{
    use SoftDeletes;

    protected $table = 'audit_widgets';

    protected $guarded = [];

    protected $hidden = ['pin_code'];
}

class AuditActor extends AuthUser
{
    protected $table = 'audit_actors';

    protected $guarded = [];

    public $timestamps = false;
}
