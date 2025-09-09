<?php

namespace Modules\Webhooks\Observers;

use App\Models\GlobalSetting;
use App\Models\Invoice;
use Illuminate\Support\Facades\Log;
use Modules\Webhooks\Jobs\SendWebhook;

class InvoiceObserver
{

    public function created(Invoice $invoice)
    {

//        $this->sendQueue($invoice);

    }

//    public function updated(Invoice $invoice)
//    {
//        logger($invoice->toArray());
//        // Check if the 'status' attribute has been changed during the update
//        if ($invoice->isDirty('status')) {
//            // Call the sendQueue method to handle further processing if the status was modified
//            $this->sendQueue($invoice);
//        }
//    }

    public function saved(Invoice $invoice)
    {
        if ($invoice->wasChanged('status') || $invoice->wasChanged('send_status')) {
            // This code will run if the 'status' was changed in any save operation (either create or update)
            $this->sendQueue($invoice);
        }
    }


    public function sendQueue($invoice)
    {

        $invoice = Invoice::find($invoice->id);

        if ($invoice->send_status !== 1) {
            return true;
        }

        $status = $invoice->status;
        // Fetch the client related to the invoice
        $client = $invoice->clientdetails;
        $data = $client->toArray();

        $invalidVariables = \Modules\Webhooks\Enums\ClientVariable::class::invalidVariables();

        foreach ($data as $key => $value) {
            if (in_array($key, $invalidVariables)) {
                unset($data[$key]);
            }
        }

        $data['email'] = $client->user->email;
        $data['name'] = $client->user->name;
        $data['phone'] = $client->user->mobile_with_phonecode;

        // Merge client data with the invoice data
        $invoiceData = array_merge($invoice->toArray(), [
            'client' => $data, // Attach client info if available
        ]);

        unset($invoiceData['clientdetails']);
        unset($invoiceData['currency']);

        $invoiceData['url'] = url()->temporarySignedRoute('front.invoice', now()->addDays(GlobalSetting::SIGNED_ROUTE_EXPIRY), $invoice->hash);
        $invoiceData['status'] = $status;

        SendWebhook::dispatch($invoiceData, 'Invoice', $invoice->company_id)
            ->delay(5)
            ->onQueue('default');
    }

}
