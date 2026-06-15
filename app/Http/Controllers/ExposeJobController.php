<?php

namespace App\Http\Controllers;

use App\Helper\Reply;
use App\Jobs\GenerateExposeJob;
use App\Models\ExposeJob;
use Illuminate\Http\Request;

class ExposeJobController extends AccountBaseController
{
    /**
     * Get the status (and download URL when ready) of an expose generation job.
     * Scoped to the authenticated user's company for security.
     */
    public function show(int $id)
    {
        $exposeJob = ExposeJob::where('company_id', user()->company_id)
            ->where('user_id', user()->id)
            ->findOrFail($id);

        if (
            $exposeJob->status === ExposeJob::STATUS_PROCESSING
            && $exposeJob->updated_at?->lt(now()->subMinutes(12))
        ) {
            $exposeJob->update([
                'status'        => ExposeJob::STATUS_FAILED,
                'error_message' => 'PDF generation timed out. Please try again.',
            ]);
            $exposeJob->refresh();
        }

        $data = [
            'id'           => $exposeJob->id,
            'status'       => $exposeJob->status,
            'filename'     => $exposeJob->filename,
            'download_url' => $exposeJob->isReady() && !$exposeJob->isExpired()
                ? $exposeJob->download_url
                : null,
            'error_message' => $exposeJob->hasFailed()
                ? $exposeJob->error_message
                : null,
            'expires_at'   => $exposeJob->expires_at?->toISOString(),
        ];

        return Reply::successWithData('Expose job status', ['data' => $data]);
    }
}
