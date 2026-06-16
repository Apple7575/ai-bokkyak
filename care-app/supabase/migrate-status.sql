update intake_records set status = 'completed' where status = '복용완료';
update intake_records set status = 'snoozed'   where status = '재알림';
update intake_records set status = 'skipped'   where status in ('미복용','복용예정');
