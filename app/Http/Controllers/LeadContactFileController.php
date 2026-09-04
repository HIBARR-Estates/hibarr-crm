<?php

namespace App\Http\Controllers;

use App\Helper\Files;
use App\Helper\Reply;
use App\Models\Lead;
use App\Models\LeadContactFile;
use App\Services\FileStorageService;
use App\Services\PermissionService;
use Illuminate\Contracts\Cache\LockTimeoutException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

/**
 * Standalone multi-file uploads for lead contacts.
 * File-typed custom fields are updated via LeadContactController::patch.
 */
class LeadContactFileController extends AccountBaseController
{
    protected FileStorageService $fileStorageService;

    public function __construct(FileStorageService $fileStorageService)
    {
        parent::__construct();
        $this->fileStorageService = $fileStorageService;
    }

    public function index(Request $request, $leadId)
    {
        $lead = Lead::findOrFail($leadId);
        $this->assertLeadAccess($lead, 'view_lead');

        $files = $lead->files()->orderByDesc('created_at')->get();

        return response()->json(['status' => 'success', 'data' => $files]);
    }

    public function store(Request $request)
    {
        $request->validate([
            'lead_id' => 'required|integer|exists:leads,id',
            'file' => 'required',
            'file.*' => 'file',
        ]);

        $lead = Lead::findOrFail($request->lead_id);
        $this->assertLeadAccess($lead, 'edit_lead');

        $createdFiles = [];

        $uploaded = $request->file('file');
        if ($uploaded instanceof \Illuminate\Http\UploadedFile) {
            $uploaded = [$uploaded];
        }

        if (is_array($uploaded)) {
            foreach ($uploaded as $fileData) {
                if (!$fileData instanceof \Illuminate\Http\UploadedFile) {
                    continue;
                }

                $file = new LeadContactFile();
                $file->lead_id = $lead->id;
                $file->user_id = $this->user->id;
                $file->added_by = $this->user->id;
                $file->filename = $fileData->getClientOriginalName();
                $file->size = (string) $fileData->getSize();

                try {
                    $result = $this->fileStorageService->upload(
                        $fileData,
                        'lead-contact-files/' . $lead->id
                    );
                    $file->external_url = $result['downloadUrl'];
                    $file->object_path = $result['objectPath'];
                    $file->hashname = '';
                } catch (\Exception $e) {
                    Log::error('Lead contact file upload failed', [
                        'error' => $e->getMessage(),
                        'lead_id' => $lead->id,
                    ]);
                    $file->hashname = Files::uploadLocalOrS3(
                        $fileData,
                        LeadContactFile::FILE_PATH . '/' . $lead->id
                    );
                }

                $file->save();
                $createdFiles[] = $file;
            }
        }

        return Reply::successWithData(__('messages.fileUploaded'), [
            'data' => $createdFiles,
        ]);
    }

    /**
     * Renames a file's display label (`description`, shown in place of the
     * raw filename wherever one is set — see fileAdapter.ts) and/or replaces
     * its stored content in place, same row/id.
     */
    public function update(Request $request, $id)
    {
        $request->validate([
            'description' => 'nullable|string|max:255',
            'file' => 'nullable|file|mimes:pdf,jpg,jpeg,png,gif,webp,zip|max:204800',
        ]);

        $file = LeadContactFile::findOrFail($id);
        $lead = Lead::findOrFail($file->lead_id);
        $this->assertLeadAccess($lead, 'edit_lead');

        // Two replacements racing on the same row would each capture the same
        // "previous" descriptor and each delete it, orphaning whichever upload
        // lost the save. Serialize the whole read-replace-persist-cleanup cycle
        // per file so the descriptor we capture is the one actually persisted.
        $lock = Cache::lock('lead-contact-file-update:'.$file->id, 120);

        try {
            $file = $lock->block(10, function () use ($request, $id) {
                $file = LeadContactFile::findOrFail($id);

                $replacement = $request->hasFile('file')
                    ? $this->replaceStoredFile($file, $request->file('file'))
                    : null;

                if ($request->has('description')) {
                    $file->description = $request->description;
                }

                try {
                    $file->save();
                } catch (\Throwable $e) {
                    // The row still points at the previous object, so drop the
                    // replacement we just uploaded rather than orphaning it.
                    if ($replacement !== null) {
                        $this->discardStoredObject($replacement['new'], $file->lead_id);
                    }

                    throw $e;
                }

                // Only now that the new descriptor is persisted is the old object
                // genuinely unreferenced and safe to delete.
                if ($replacement !== null) {
                    $this->discardStoredObject($replacement['previous'], $file->lead_id);
                }

                return $file;
            });
        } catch (LockTimeoutException $e) {
            return Reply::error('This file is already being updated. Please try again.');
        }

        return Reply::successWithData(__('messages.updateSuccess'), ['data' => $file]);
    }

    /**
     * Swaps a LeadContactFile's stored content in place - same row/id, new
     * filename/size/storage fields. Uploads the replacement first, and hands
     * back both storage descriptors rather than deleting anything itself:
     * the caller deletes the previous object only once the new descriptor is
     * persisted (and drops the new one if that persistence fails), so neither
     * a failed upload nor a failed save can leave the row pointing at content
     * that's already gone.
     *
     * @return array{previous: array{external: bool, object_path: ?string, hashname: ?string}, new: array{external: bool, object_path: ?string, hashname: ?string}}
     */
    private function replaceStoredFile(LeadContactFile $file, \Illuminate\Http\UploadedFile $newFile): array
    {
        $previous = [
            'external' => $file->isExternallyStored(),
            'object_path' => $file->object_path,
            'hashname' => $file->hashname,
        ];

        $file->filename = $newFile->getClientOriginalName();
        $file->size = (string) $newFile->getSize();

        try {
            $result = $this->fileStorageService->upload($newFile, 'lead-contact-files/'.$file->lead_id);
            $file->external_url = $result['downloadUrl'];
            $file->object_path = $result['objectPath'];
            $file->hashname = '';
        } catch (\Exception $e) {
            Log::error('Lead contact file replace upload failed', [
                'error' => $e->getMessage(),
                'file_id' => $file->id,
            ]);
            $file->external_url = null;
            $file->object_path = null;
            $file->hashname = Files::uploadLocalOrS3($newFile, LeadContactFile::FILE_PATH.'/'.$file->lead_id);
        }

        return [
            'previous' => $previous,
            'new' => [
                'external' => ! empty($file->object_path),
                'object_path' => $file->object_path,
                'hashname' => $file->hashname,
            ],
        ];
    }

    /**
     * Deletes one stored object described by a replaceStoredFile() descriptor.
     * Never throws - a cleanup failure is logged, not surfaced, since by the
     * time it runs the authoritative row has already been written.
     *
     * @param  array{external: bool, object_path: ?string, hashname: ?string}  $descriptor
     */
    private function discardStoredObject(array $descriptor, int $leadId): void
    {
        if ($descriptor['external'] && ! empty($descriptor['object_path'])) {
            try {
                $this->fileStorageService->delete($descriptor['object_path']);
            } catch (\Exception $e) {
                Log::warning('Failed to delete lead contact file from external storage during replace', [
                    'lead_id' => $leadId,
                    'object_path' => $descriptor['object_path'],
                    'error' => $e->getMessage(),
                ]);
            }

            return;
        }

        if (! empty($descriptor['hashname'])) {
            Files::deleteFile($descriptor['hashname'], LeadContactFile::FILE_PATH.'/'.$leadId);
        }
    }

    public function destroy(Request $request, $id)
    {
        $file = LeadContactFile::findOrFail($id);
        $lead = Lead::findOrFail($file->lead_id);
        $this->assertLeadAccess($lead, 'edit_lead');

        if ($file->isExternallyStored() && ! empty($file->object_path)) {
            try {
                $this->fileStorageService->delete($file->object_path);
            } catch (\Exception $e) {
                Log::warning('Failed to delete lead contact file from external storage', [
                    'file_id' => $file->id,
                    'object_path' => $file->object_path,
                    'error' => $e->getMessage(),
                ]);
            }
        } elseif (! empty($file->hashname)) {
            Files::deleteFile(
                $file->hashname,
                LeadContactFile::FILE_PATH.'/'.$file->lead_id
            );
        }

        LeadContactFile::destroy($id);

        return Reply::success(__('messages.deleteSuccess'));
    }

    public function download($id)
    {
        $file = LeadContactFile::findOrFail($id);
        $lead = Lead::findOrFail($file->lead_id);
        $this->assertLeadAccess($lead, 'view_lead');

        if ($file->isExternallyStored()) {
            return redirect()->away($file->external_url);
        }

        return download_local_s3(
            $file,
            LeadContactFile::FILE_PATH.'/'.$file->lead_id.'/'.$file->hashname
        );
    }

    /**
     * @param  'view_lead'|'edit_lead'  $permission
     */
    protected function assertLeadAccess(Lead $lead, string $permission): void
    {
        $access = PermissionService::checkAccess(user(), $permission, $lead, [
            'added' => 'added_by',
            'owned' => 'lead_owner',
        ]);
        abort_403(! $access['canAccess']);
    }
}
