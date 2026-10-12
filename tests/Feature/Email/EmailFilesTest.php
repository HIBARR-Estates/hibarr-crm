<?php

namespace Tests\Feature\Email;

use App\Email\Adapters\FakeMailAdapter;
use App\Email\Data\Draft;
use App\Email\Data\DraftAttachment;
use App\Email\Data\EmailAddress;
use App\Email\EmailFeature;
use App\Email\Enums\FileScanStatus;
use App\Email\Enums\SendAttemptStatus;
use App\Email\Files\EmailFiles;
use App\Email\Jobs\SyncMailboxJob;
use App\Email\Linking\ConversationLinker;
use App\Email\Models\EmailConnection;
use App\Email\Models\EmailFile;
use App\Email\Models\EmailMailboxCopy;
use App\Email\Models\EmailMessage;
use App\Email\Models\EmailPilotAllowlistEntry;
use App\Email\Sending\DraftValidator;
use App\Email\Sending\SendAttemptService;
use App\Email\Sync\MailboxSynchronizer;
use App\Models\Company;
use App\Models\Lead;
use App\Models\User;
use Illuminate\Http\Client\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Tests\Concerns\BuildsEmailSchema;
use Tests\Concerns\SetsFeatureFlags;
use Tests\TestCase;

class EmailFilesTest extends TestCase
{
    use BuildsEmailSchema;
    use SetsFeatureFlags;

    private const BYTES = '%PDF-1.4 floor plan';

    private FakeMailAdapter $fake;

    private Company $company;

    private User $owner;

    private User $leadOwner;

    private EmailConnection $mailbox;

    private Lead $lead;

    protected function setUp(): void
    {
        parent::setUp();

        $this->buildEmailSchema();
        $this->setFeatureFlag(EmailFeature::FLAG, true);

        config([
            'file_storage.base_url' => 'https://files.test',
            'file_storage.api_key' => 'gateway-key',
            'file_storage.retry_count' => 0,
        ]);

        // The gateway: every upload lands at a fresh object path, every stored object reads back the same bytes.
        Http::fake(function (Request $request) {
            if ($request->method() === 'POST' && str_starts_with($request->url(), 'https://files.test/upload')) {
                parse_str((string) parse_url($request->url(), PHP_URL_QUERY), $query);
                $path = ($query['targetFolder'] ?? 'none').'/'.Str::random(8).'-file';

                return Http::response(['data' => [[
                    'objectPath' => $path,
                    'originalName' => 'file',
                    'downloadUrl' => 'https://cdn.test/'.$path,
                ]]]);
            }

            return str_starts_with($request->url(), 'https://cdn.test/email-attachments/')
                ? Http::response(self::BYTES)
                : Http::response('', 404);
        });

        $this->fake = app(FakeMailAdapter::class);
        $this->company = $this->makeEmailCompany();
        EmailPilotAllowlistEntry::factory()->forCompany($this->company->id)->create();

        $this->owner = $this->user(['view_lead' => 'all']);
        $this->leadOwner = $this->user(['view_lead' => 'owned']);
        $this->mailbox = EmailConnection::factory()->forUser($this->owner)->create();

        $lead = $this->makeEmailLead($this->company, null, ['lead_owner' => $this->leadOwner->id]);
        $this->lead = Lead::withoutGlobalScopes()->findOrFail($lead->id);
    }

    public function test_a_received_attachment_is_stored_under_the_email_prefix_and_held_back_until_scanned(): void
    {
        $file = $this->receiveWithAttachment();

        $this->assertSame(FileScanStatus::Pending, $file->scan_status);
        $this->assertSame('plan.pdf', $file->filename);
        $this->assertSame(strlen(self::BYTES), $file->size_bytes);
        $this->assertStringStartsWith('email-attachments/', $file->storage_key);
        $this->assertArrayNotHasKey('storage_key', $file->toArray());
        $this->assertArrayNotHasKey('storage_url', $file->toArray());

        Http::assertSent(fn (Request $request) => $request->method() === 'POST'
            && str_contains($request->url(), 'targetFolder=email-attachments')
            && $request->hasHeader('X-Api-Key', 'gateway-key'));

        $this->signIn($this->owner);

        // Listed for its owner by name and state — never by where it is stored.
        $listed = $this->getJson('/email/review')->assertOk();

        $listed->assertJsonPath('items.0.files', [[
            'id' => $file->uuid,
            'filename' => 'plan.pdf',
            'mime_type' => 'application/pdf',
            'size_bytes' => strlen(self::BYTES),
            'inline' => false,
            'scan_status' => 'pending',
            'downloadable' => false,
        ]]);
        $this->assertStringNotContainsString('cdn.test', $listed->getContent());
        $this->assertStringNotContainsString('email-attachments/', $listed->getContent());

        // No scanner yet: an unscanned file is not handed out, even to its owner.
        $this->getJson("/email/files/{$file->uuid}/download")
            ->assertStatus(409)
            ->assertExactJson(['message' => 'file_unavailable', 'scan_status' => 'pending']);

        // The sandbox switch lets it through outside production only.
        config(['email.files.allow_unscanned' => true]);

        $download = $this->get("/email/files/{$file->uuid}/download")->assertOk();

        $this->assertSame(self::BYTES, $download->getContent());
        $download->assertHeader('Content-Disposition', 'attachment; filename="plan.pdf"');
        $download->assertHeader('Content-Type', 'application/octet-stream');
        $download->assertHeader('X-Content-Type-Options', 'nosniff');

        $this->app['env'] = 'production';

        $this->assertFalse(app(EmailFiles::class)->isUsable($file));
    }

    public function test_download_without_access_is_403(): void
    {
        config(['email.files.allow_unscanned' => true]);
        $file = $this->receiveWithAttachment();
        $copy = EmailMailboxCopy::withoutGlobalScopes()->sole();
        $uri = "/email/files/{$file->uuid}/download";

        $this->getJson($uri)->assertStatus(401);

        // Unlinked mail: nobody but its mailbox owner, however much of the CRM they can see.
        $manager = $this->user(['view_lead' => 'all', 'view_deals' => 'all']);

        foreach ([$manager, $this->leadOwner] as $other) {
            $this->signIn($other);
            $this->getJson($uri)->assertStatus(403);
        }

        // Linked to the lead: its owner may have the file, the manager still may not.
        app(ConversationLinker::class)->link($copy->message->conversation, $this->lead, $this->owner, $this->mailbox);

        $this->signIn($this->leadOwner);
        $this->assertSame(self::BYTES, $this->get($uri)->assertOk()->getContent());

        $this->signIn($manager);
        $this->getJson($uri)->assertStatus(403);

        // Unlinked again: gone for the lead owner at once, still there for the mailbox owner.
        app(ConversationLinker::class)->unlink($copy->message->conversation, $this->lead, $this->owner);

        $this->signIn($this->leadOwner);
        $this->getJson($uri)->assertStatus(403);

        $this->signIn($this->owner);
        $this->get($uri)->assertOk();
        $this->getJson('/email/files/'.Str::uuid().'/download')->assertStatus(404);

        $this->setFeatureFlag(EmailFeature::FLAG, false);
        $this->getJson($uri)->assertStatus(404);
    }

    public function test_email_files_never_become_lead_or_deal_files(): void
    {
        $file = $this->receiveWithAttachment();
        $copy = EmailMailboxCopy::withoutGlobalScopes()->sole();
        app(ConversationLinker::class)->link($copy->message->conversation, $this->lead, $this->owner, $this->mailbox);

        // Linked to a lead, the file is still only an email file, under the email prefix.
        $this->assertSame(1, EmailFile::withoutGlobalScopes()->count());
        $this->assertStringStartsWith('email-attachments/', $file->fresh()->storage_key);

        // And nothing in the module can put one on the CRM Files tab: it never touches those models or tables.
        $offenders = [];

        foreach (File::allFiles(app_path('Email')) as $source) {
            if (preg_match('/\b(LeadFile|DealFile|lead_files|deal_files)\b/', $source->getContents()) === 1) {
                $offenders[] = $source->getRelativePathname();
            }
        }

        $this->assertSame([], $offenders);
    }

    public function test_an_attachment_the_limits_refuse_is_unavailable_and_the_message_stays(): void
    {
        $this->fake->seedInbound($this->mailbox->toContext(), [
            'attachments' => [['filename' => 'setup.exe', 'bytes' => 'MZ']],
        ]);
        $this->sync();

        $file = EmailFile::withoutGlobalScopes()->sole();

        $this->assertSame(FileScanStatus::Unavailable, $file->scan_status);
        $this->assertSame('type_not_allowed', $file->error_code);
        $this->assertFalse($file->isStored());
        $this->assertSame(1, EmailMessage::withoutGlobalScopes()->count());
        $this->assertTrue(EmailMessage::withoutGlobalScopes()->sole()->has_attachments);

        config(['email.files.allow_unscanned' => true]);
        $this->signIn($this->owner);
        $this->getJson("/email/files/{$file->uuid}/download")
            ->assertStatus(409)
            ->assertJsonPath('scan_status', 'unavailable');
    }

    public function test_an_uploaded_file_that_may_not_go_out_blocks_the_whole_send(): void
    {
        $this->signIn($this->owner);

        $uploaded = $this->post('/email/files', [
            'connection_id' => $this->mailbox->uuid,
            'file' => UploadedFile::fake()->create('offer.pdf', 12, 'application/pdf'),
        ], ['Accept' => 'application/json'])->assertStatus(201);

        $uploaded->assertJsonPath('file.filename', 'offer.pdf')->assertJsonPath('file.scan_status', 'pending');
        $this->assertStringNotContainsString('email-attachments/', $uploaded->getContent());

        $file = EmailFile::withoutGlobalScopes()->where('uuid', $uploaded->json('file.id'))->sole();

        $this->assertNull($file->message_id);
        $this->assertSame((int) $this->owner->id, (int) $file->uploaded_by);
        $this->assertStringStartsWith('email-attachments/', $file->storage_key);

        $draft = new Draft(
            from: new EmailAddress($this->mailbox->from_email),
            to: ['lead@example.test'],
            subject: 'Offer',
            textBody: 'Attached.',
            attachments: [new DraftAttachment($file->storage_key, 'offer.pdf', 'application/pdf', 12)],
        );

        // Unscanned: the message is not sent without its file — it is not sent at all, and the draft is kept.
        $blocked = app(SendAttemptService::class)->send($this->mailbox, $draft, $this->owner)->fresh();

        $this->assertSame(SendAttemptStatus::Failed, $blocked->status);
        $this->assertSame(DraftValidator::ATTACHMENT_UNAVAILABLE, $blocked->error_code);
        $this->assertSame('Offer', $blocked->draft()->subject);
        $this->assertSame([], $this->fake->sendCalls($this->mailbox->uuid));

        config(['email.files.allow_unscanned' => true]);

        $sent = app(SendAttemptService::class)->send($this->mailbox, $draft, $this->owner)->fresh();

        $this->assertSame(SendAttemptStatus::Sent, $sent->status);
        $this->assertCount(1, $this->fake->sendCalls($this->mailbox->uuid));

        // A file uploaded to someone else's mailbox cannot be attached from this one.
        $colleague = $this->user([]);
        $theirMailbox = EmailConnection::factory()->forUser($colleague)->create();
        $file->forceFill(['connection_id' => $theirMailbox->id])->save();

        $this->assertSame(
            DraftValidator::ATTACHMENT_UNAVAILABLE,
            app(SendAttemptService::class)->send($this->mailbox, $draft, $this->owner)->fresh()->error_code,
        );

        // Uploading needs a mailbox of your own, and a file the limits allow.
        $this->post('/email/files', [
            'connection_id' => $theirMailbox->uuid,
            'file' => UploadedFile::fake()->create('offer.pdf', 12),
        ], ['Accept' => 'application/json'])->assertStatus(404);

        $this->post('/email/files', [
            'connection_id' => $this->mailbox->uuid,
            'file' => UploadedFile::fake()->create('run.bat', 1),
        ], ['Accept' => 'application/json'])->assertStatus(422)->assertJsonPath('message', 'type_not_allowed');
    }

    private function receiveWithAttachment(): EmailFile
    {
        $this->fake->seedInbound($this->mailbox->toContext(), [
            'from' => 'stranger@example.test',
            'attachments' => [['filename' => '../plans/plan.pdf', 'mime_type' => 'application/pdf', 'bytes' => self::BYTES]],
        ]);
        $this->sync();

        return EmailFile::withoutGlobalScopes()->sole();
    }

    private function sync(): void
    {
        $this->assertTrue((new SyncMailboxJob($this->mailbox->id))->handle(app(MailboxSynchronizer::class))->succeeded());
    }

    /**
     * @param  array<string, string>  $permissions
     */
    private function user(array $permissions): User
    {
        $user = $this->makeEmailUser($this->company);
        $this->app->instance('user.permission-map.'.$user->id, $permissions);

        return $user;
    }

    private function signIn(User $user): void
    {
        // The auth middleware's active-user lookup needs columns the hand-built users table lacks.
        cache()->forever('user_is_active_'.$user->id, true);
        session()->forget('user');

        $this->actingAs($user);
    }
}
