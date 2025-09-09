<?php 
return [
  'attendance-reminder' => '今日の出席をマークするのを忘れました。欠席扱いとならないよう、打刻をお願いいたします。',
  'follow-up-reminder' => 'リード番号 :leadId のフォローアップ リマインダー。次回のフォローアップ日: :followUpDate。備考：×3',
  'auto-task-reminder' => 'タスク番号 :taskId の自動タスクリマインダー。タスクの見出し: :heading。期限 : :dueDate',
  'contract-signed' => '契約番号 :contract に対して :client により契約が署名されました。',
  'estimate-declined' => '見積もりは拒否されました。見積番号 :estimateNumber をご確認ください。',
  'event-invite' => 'イベントの招待状。
イベント名： :eventName.イベント開始日： :eventStartDate。
イベント終了日: :eventEndDate。
イベント会場：×4',
  'event-reminder' => 'イベントリマインダー。
イベント名： :eventName.イベント開始日： :eventStartDate。
イベント終了日: :eventEndDate。
イベント会場：×4',
  'recurring-expense-status-updated' => '経常経費ステータスが更新されました。
経費名： :expenseName。経費ステータス: :expenseStatus。',
  'new-file-uploaded-to-project' => '新しいファイルがプロジェクト # :projectName にアップロードされました。
ファイル名：×2
日付: :date',
  'payment-received' => 'これは :paymentType 支払い # :number の確認メッセージです',
  'payment-reminder' => 'これは、次のプロジェクトの請求書の支払い期日 :invoiceNumber ( :dueDate) についてお知らせするためです。',
  'project-reminder' => '以下のプロジェクトの締切日が 1 日であることをお知らせします。',
  'proposal-approved' => '提案は受け入れられました!
新しい提案が受け入れられ、署名されました。
承認者: :name。
提案ステータス: :status。',
  'proposal-rejected' => 'プロポーズはリードによって断られました!
新しい提案は拒否されました。
拒否 : :comment。
提案ステータス: :status。',
  'recurring-invoice-status-updated' => '定期請求書のステータスが :status に更新されました。',
  'invoice-reminder' => '請求書リマインダー - :invoiceNumber
これは、次の請求書の期日が :dueDate であることをお知らせするためです。',
  'new-expense-added-by-admin' => ' :name によって提出された新しい経費。経費詳細: :itemName - :price',
  'new-expense-added-by-member' => '新しい経費が提出されました。経費詳細: :itemName - :price',
  'invoice-created' => '新しい請求書を受け取りました - 請求書番号は :invoiceNumber です',
  'invoice-updated' => '請求書が更新されました。請求書 :invoiceNumber をご確認ください。',
  'lead-notification' => '新しいリードを受け取りました。リードの詳細: :leadName',
  'new-leave-application' => '休暇申請が申請されました。
当日: :leaveDate',
  'new-leave-request' => ' :name が新しい休暇申請を受け取りました。
当日: :leaveDate
理由: ×3',
  'leave-approved' => '休暇申請が承認されました。
当日: :leaveDate',
  'leave-rejected' => '休暇申請が拒否されました。
当日: :leaveDate',
  'leave-updated' => 'A 休暇申請ステータスが更新されました。
ステータス:×1',
  'multiple-leave-application' => ' :name が複数の休暇申請を受け取りました。
理由: ×2',
  'new-multiple-leave-application' => '新しい複数休暇申請書を :name が受け取りました。
理由: ×2
リーブタイプ: :leaveType',
  'new-task' => 'あなたに割り当てられた新しいタスク。
タスクの詳細: :heading
タスクID: :taskId
期日: :dueDate',
  'new-order' => '新しい注文を受け取りました。
注文番号: :orderNumber
今すぐログインして注文を表示してください。',
  'order-updated' => '注文が更新されました。
注文番号: :orderNumber
今すぐログインして注文を表示してください。',
  'new-payment' => 'お支払い頂いた！
新たな支払いが完了しました。今すぐログインして支払いを表示してください。',
  'new-product-purchase' => '新製品の購入
新しい製品の購入が行われました。今すぐログインして購入内容を確認してください。',
  'new-project' => '新しいプロジェクトが追加されました
新しいプロジェクトが :projectName という名前で追加されました。今すぐログインしてプロジェクトを表示してください。',
  'new-proposal' => '新しい提案を受け取りました
新しい提案が届きました。今すぐログインして提案を表示してください。',
  'new-recurring-invoice' => '新しい定期請求書が送信されました。',
  'new-ticket-reply' => '新しいチケットの返信を受け取りました
チケット :ticketNumber に関する返信を受け取りました',
  'new-ticket-request' => '新しいサポート チケットが生成されました。チケットを表示するにはログインしてください。',
  'task-updated' => 'タスクが更新されました
タスクの詳細: :heading
タスクID: :taskId
期日: :dueDate',
  'task-completed-client' => '完了としてマークされたタスク。
タスクの詳細: :heading
タスクID: :taskId',
  'task-completed' => '完了としてマークされたタスク。
タスクの詳細: :heading
タスクID: :taskId
プロジェクト: :project',
  'new-client-task' => '新しいタスクが生成されました - タスクの見出しは :heading です',
  'task-update-client' => 'タスクが更新されました
タスクの詳細: :heading
タスクID: :taskId',
  'new-notice-published' => '新しい通知が公開されました - 通知は次のとおりです: :heading',
  'new-support-ticket-request' => '新しいサポートチケットがリクエストされました
チケットID:×1
チケット対象: :subject
チケットのリクエスト者: :ticketRequesterName',
  'agent-ticket' => 'チケットが割り当てられました
チケットID:×1
チケット対象: :subject',
  'employee-assign-to-project' => '新しいプロジェクトが割り当てられました
あなたはプロジェクトのメンバーとして追加されました - :projectName',
  'user-join-via-invitation' => '新しいユーザーがリンク経由で参加しました。
招待リンクを介して新しいアカウントが正常に作成されました。詳細は次のとおりです-
名前: :name
メール: :email
電話: :phone',
  'notice-updated' => 'お知らせが更新されました。通知を表示するにはログインしてください。
通知見出し: :heading',
  'removal-request-admin-notification' => '新たな削除リクエストを受け取りました',
  'removal-request-approved' => '削除リクエストが承認されました',
  'removal-request-reject' => 'あなたの削除リクエストは拒否されました',
  'removal-request-approved-lead' => 'リードの削除リクエストが承認されました',
  'removal-request-reject-lead' => '見込み客の削除リクエストは拒否されました',
  'sub-task-assignee-added' => 'あなたに割り当てられたサブタスク。
タスクの詳細: :title
プロジェクト: :project',
  'sub-task-completed' => '完了としてマークされたサブタスク。
タスクの詳細: :title
プロジェクト: :project',
  'task-comment' => 'タスクに関する新しいコメント。
タスクの詳細: :heading
タスクID: :taskId
プロジェクト: :project',
  'task-note' => 'タスクに新しいメモが追加されました - :heading
タスクID: :taskId
プロジェクト: :project',
  'task-reminder' => '割り当てられたタスクのリマインダー - :heading
タスクID: :taskId
日付: :date',
  'user-registrationadded-by-admin' => '新しいユーザーが追加されました。
招待リンクを介して新しいアカウントが正常に作成されました。詳細は次のとおりです-
名前: :name
メール: :email
パスワード：×3',
  'test-sms-notification' => 'これは :gateway テスト メッセージです',
  'two-factor-code' => 'あなたの 2 要素コードは :code です
このコードは 10 分で期限切れになります。
ログインを試みていない場合は、このメッセージを無視してください。',
  'removal-request-reject-user' => '削除リクエストは拒否されました
あなたの削除リクエストは拒否されました',
  'removal-request-approved-user' => '削除リクエストの承認
削除リクエストが承認されました',
];