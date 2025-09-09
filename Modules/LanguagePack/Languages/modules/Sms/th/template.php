<?php 
return [
  'attendance-reminder' => 'คุณลืมทำเครื่องหมายการเข้าร่วมของคุณในวันนี้ กรุณาตอกบัตรเข้าระบบเพื่อหลีกเลี่ยงการถูกทำเครื่องหมายว่าไม่อยู่',
  'follow-up-reminder' => 'ติดตามการแจ้งเตือนสำหรับ Lead # :leadId วันที่ติดตามผลครั้งถัดไป : :followUpDate. หมายเหตุ : :remark',
  'auto-task-reminder' => 'การแจ้งเตือนงานอัตโนมัติสำหรับงาน # :taskId หัวข้องาน : :heading. วันครบกำหนด : :dueDate',
  'contract-signed' => 'สัญญาที่ลงนามในสัญญา # :contract โดย :client',
  'estimate-declined' => 'การประมาณการถูกปฏิเสธ กรุณาตรวจสอบประมาณการ # :estimateNumber.',
  'event-invite' => 'คำเชิญเข้าร่วมกิจกรรม
ชื่อกิจกรรม : :eventName. วันที่เริ่มกิจกรรม : :eventStartDate.
วันที่สิ้นสุดกิจกรรม : :eventEndDate.
สถานที่จัดงาน : :eventLocation',
  'event-reminder' => 'การแจ้งเตือนกิจกรรม
ชื่อกิจกรรม : :eventName. วันที่เริ่มกิจกรรม : :eventStartDate.
วันที่สิ้นสุดกิจกรรม : :eventEndDate.
สถานที่จัดงาน : :eventLocation',
  'recurring-expense-status-updated' => 'อัปเดตสถานะค่าใช้จ่ายที่เกิดซ้ำแล้ว
ชื่อค่าใช้จ่าย : :expenseName. สถานะค่าใช้จ่าย : :expenseStatus.',
  'new-file-uploaded-to-project' => 'อัปโหลดไฟล์ใหม่ไปยังโครงการ # :projectName
ชื่อไฟล์ : :fileName
วันที่ : :date',
  'payment-received' => 'นี่เป็นข้อความยืนยันการชำระเงิน :paymentType # :number',
  'payment-reminder' => 'นี่เป็นการเตือนคุณเกี่ยวกับวันครบกำหนดของการชำระเงินตามใบแจ้งหนี้โครงการต่อไปนี้ :invoiceNumber ซึ่งก็คือ :dueDate',
  'project-reminder' => 'นี่เป็นการเตือนคุณเกี่ยวกับวันครบกำหนดของโครงการต่อไปนี้ซึ่งก็คือ :dueDate',
  'proposal-approved' => 'ข้อเสนอได้รับการยอมรับแล้ว!
ข้อเสนอใหม่ได้รับการยอมรับและลงนามแล้ว
อนุมัติโดย : :name.
สถานะข้อเสนอ : :status',
  'proposal-rejected' => 'ข้อเสนอถูกปฏิเสธโดยผู้นำ!
ข้อเสนอใหม่ถูกปฏิเสธ
ปฏิเสธ: :comment.
สถานะข้อเสนอ : :status',
  'recurring-invoice-status-updated' => 'สถานะใบแจ้งหนี้ที่เกิดซ้ำของคุณได้รับการอัปเดตเป็น :status',
  'invoice-reminder' => 'การแจ้งเตือนใบแจ้งหนี้ - :invoiceNumber
นี่เป็นการเตือนคุณเกี่ยวกับวันครบกำหนดของใบแจ้งหนี้ต่อไปนี้ซึ่งก็คือ :dueDate',
  'new-expense-added-by-admin' => 'ค่าใช้จ่ายใหม่ส่งโดย :name รายละเอียดค่าใช้จ่าย: :itemName - :price',
  'new-expense-added-by-member' => 'ส่งค่าใช้จ่ายใหม่แล้ว รายละเอียดค่าใช้จ่าย: :itemName - :price',
  'invoice-created' => 'ได้รับใบแจ้งหนี้ใหม่ - หมายเลขใบแจ้งหนี้คือ :invoiceNumber',
  'invoice-updated' => 'ใบแจ้งหนี้ได้รับการปรับปรุงแล้ว กรุณาตรวจสอบใบแจ้งหนี้ :invoiceNumber',
  'lead-notification' => 'ได้รับโอกาสในการขายใหม่แล้ว รายละเอียดตะกั่ว: :leadName',
  'new-leave-application' => 'ใช้แอปพลิเคชันลา
วันที่: :leaveDate',
  'new-leave-request' => 'ได้รับคำขอลาใหม่โดย :name
วันที่: :leaveDate
เหตุผล: :reason',
  'leave-approved' => 'อนุมัติใบสมัครลาแล้ว
วันที่: :leaveDate',
  'leave-rejected' => 'ใบสมัครลาถูกปฏิเสธ
วันที่: :leaveDate',
  'leave-updated' => 'อัปเดตสถานะการสมัครทิ้งไว้
สถานะ: :status',
  'multiple-leave-application' => 'ได้รับใบสมัครลาหลายครั้งโดย :name
เหตุผล: :reason',
  'new-multiple-leave-application' => 'ใหม่ได้รับใบสมัครลาหลายครั้งโดย :name
เหตุผล: :reason
ประเภทการลา: :leaveType',
  'new-task' => 'งานใหม่ที่ได้รับมอบหมายให้กับคุณ
รายละเอียดงาน: :heading
รหัสงาน: :taskId
วันครบกำหนด: :dueDate',
  'new-order' => 'ได้รับคำสั่งซื้อใหม่แล้ว
หมายเลขคำสั่งซื้อ: :orderNumber
เข้าสู่ระบบทันทีเพื่อดูคำสั่งซื้อ',
  'order-updated' => 'อัปเดตคำสั่งซื้อแล้ว
หมายเลขคำสั่งซื้อ: :orderNumber
เข้าสู่ระบบทันทีเพื่อดูคำสั่งซื้อ',
  'new-payment' => 'ได้รับการชำระเงินแล้ว!
ได้ทำการชำระเงินใหม่แล้ว เข้าสู่ระบบตอนนี้เพื่อดูการชำระเงิน',
  'new-product-purchase' => 'การซื้อสินค้าใหม่
มีการซื้อผลิตภัณฑ์ใหม่แล้ว เข้าสู่ระบบทันทีเพื่อดูการซื้อ',
  'new-project' => 'เพิ่มโครงการใหม่แล้ว
โครงการใหม่ที่เพิ่มเข้ามาด้วยชื่อ - :projectName เข้าสู่ระบบทันทีเพื่อดูโครงการ',
  'new-proposal' => 'ได้รับข้อเสนอใหม่แล้ว
ได้รับข้อเสนอใหม่แล้ว เข้าสู่ระบบทันทีเพื่อดูข้อเสนอ',
  'new-recurring-invoice' => 'มีการส่งใบแจ้งหนี้ที่เกิดซ้ำใหม่แล้ว',
  'new-ticket-reply' => 'ได้รับการตอบกลับตั๋วใหม่แล้ว
คุณได้รับคำตอบเกี่ยวกับ Ticket :ticketNumber',
  'new-ticket-request' => 'มีการสร้างตั๋วสนับสนุนใหม่สำหรับคุณแล้ว เข้าสู่ระบบเพื่อดูตั๋ว',
  'task-updated' => 'อัปเดตงานแล้ว
รายละเอียดงาน: :heading
รหัสงาน: :taskId
วันครบกำหนด: :dueDate',
  'task-completed-client' => 'งานทำเครื่องหมายว่าเสร็จสมบูรณ์
รายละเอียดงาน: :heading
รหัสงาน: :taskId',
  'task-completed' => 'งานทำเครื่องหมายว่าเสร็จสมบูรณ์
รายละเอียดงาน: :heading
รหัสงาน: :taskId
โครงการ: :project',
  'new-client-task' => 'สร้างงานใหม่แล้ว - หัวข้องานคือ :heading',
  'task-update-client' => 'อัปเดตงานแล้ว
รายละเอียดงาน: :heading
รหัสงาน: :taskId',
  'new-notice-published' => 'ประกาศใหม่เผยแพร่แล้ว - ประกาศคือ: :heading',
  'new-support-ticket-request' => 'ร้องขอตั๋วสนับสนุนใหม่
รหัสตั๋ว: :ticketId
หัวเรื่องตั๋ว: :subject
ขอตั๋วโดย: :ticketRequesterName',
  'agent-ticket' => 'คุณได้รับมอบหมายตั๋ว
รหัสตั๋ว: :ticketId
หัวเรื่องตั๋ว: :subject',
  'employee-assign-to-project' => 'ได้รับมอบหมายโครงการใหม่แล้ว
คุณได้รับการเพิ่มเป็นสมาชิกในโครงการ - :projectName',
  'user-join-via-invitation' => 'ผู้ใช้ใหม่เข้าร่วมผ่านลิงก์
สร้างบัญชีใหม่สำเร็จแล้วผ่านลิงก์คำเชิญ ต่อไปนี้เป็นรายละเอียด-
ชื่อ: :name
อีเมล์: :email
โทรศัพท์: :phone',
  'notice-updated' => 'ประกาศได้รับการปรับปรุงแล้ว เข้าสู่ระบบเพื่อดูประกาศ
หัวข้อประกาศ: :heading',
  'removal-request-admin-notification' => 'ได้รับคำขอลบใหม่แล้ว',
  'removal-request-approved' => 'คำขอลบของคุณได้รับการอนุมัติแล้ว',
  'removal-request-reject' => 'คำขอลบของคุณถูกปฏิเสธ',
  'removal-request-approved-lead' => 'คำขอลบโอกาสในการขายของคุณได้รับการอนุมัติแล้ว',
  'removal-request-reject-lead' => 'คำขอลบโอกาสในการขายของคุณถูกปฏิเสธ',
  'sub-task-assignee-added' => 'งานย่อยที่ได้รับมอบหมายให้กับคุณ
รายละเอียดงาน: :title
โครงการ: :project',
  'sub-task-completed' => 'งานย่อยทำเครื่องหมายว่าเสร็จสมบูรณ์
รายละเอียดงาน: :title
โครงการ: :project',
  'task-comment' => 'ความคิดเห็นใหม่เกี่ยวกับงาน
รายละเอียดงาน: :heading
รหัสงาน: :taskId
โครงการ: :project',
  'task-note' => 'เพิ่มบันทึกใหม่สำหรับงาน - :heading
รหัสงาน: :taskId
โครงการ: :project',
  'task-reminder' => 'คำเตือนสำหรับงานที่ได้รับมอบหมาย - :heading
รหัสงาน: :taskId
วันที่: :date',
  'user-registrationadded-by-admin' => 'เพิ่มผู้ใช้ใหม่แล้ว
สร้างบัญชีใหม่สำเร็จแล้วผ่านลิงก์คำเชิญ ต่อไปนี้เป็นรายละเอียด-
ชื่อ: :name
อีเมล์: :email
รหัสผ่าน: :password',
  'test-sms-notification' => 'นี่คือข้อความทดสอบ :gateway',
  'two-factor-code' => 'รหัสตัวประกอบสองตัวของคุณคือ :code
รหัสนี้จะหมดอายุใน 10 นาที
หากคุณยังไม่ได้พยายามเข้าสู่ระบบ ไม่ต้องสนใจข้อความนี้',
  'removal-request-reject-user' => 'คำขอลบถูกปฏิเสธ
คำขอลบของคุณถูกปฏิเสธ',
  'removal-request-approved-user' => 'การอนุมัติคำขอลบ
คำขอลบของคุณได้รับการอนุมัติแล้ว',
];