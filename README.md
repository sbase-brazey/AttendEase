# AttendEase

AttendEase is an Expo attendance app for teachers and students. Supabase Auth manages sign-in, Postgres stores class schedules and attendance, and Supabase Realtime keeps dashboards and teacher records current across devices.

## Supabase setup

1. Create a Supabase project and copy `.env.example` to `.env`.
2. Set `EXPO_PUBLIC_SUPABASE_URL` and either `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` or `EXPO_PUBLIC_SUPABASE_ANON_KEY` from the project’s API settings. Never put a `service_role` or secret key in the app. Expo only exposes variables prefixed with `EXPO_PUBLIC_`.
3. Run [`supabase/schema.sql`](./supabase/schema.sql) in the Supabase SQL Editor. It creates the tables, row-level security policies, attendance RPCs, Realtime publication entries, and a one-minute scheduled job that creates overdue absences.
4. Create teacher and student users in Supabase **Authentication → Users**. For each user, add a matching `public.profiles` row with the Auth user ID, `role` (`teacher` or `student`), `full_name`, and a unique `student_number` for students. The student number is encoded in the attendance QR code.
5. Restart Expo after setting environment variables: `npx expo start -c`.

Teachers can create multiple subject schedules for the same date from **Class schedule**, including a start and end time. Each subject has its own QR scanning flow and attendance records page; the teacher dashboard, date calendar, and student dashboard show attendance separately by subject. Students are Present through the first 15 minutes after the subject starts, Late after that through the scheduled end, and Absent after the subject ends. The database job inserts Absent records for students without a scan after class end; a scan after class end is still recorded but remains Absent.

If you already applied an earlier version of the schema, run the updated SQL in [`supabase/migrations/20261126_fix_record_attendance_ambiguous_student_id.sql`](./supabase/migrations/20261126_fix_record_attendance_ambiguous_student_id.sql) in the Supabase SQL Editor. It removes the one-schedule-per-date restriction, adds class end times (existing schedules are given a one-hour end time that you can edit), updates the attendance boundaries and overdue-absence job, and fixes QR scans failing with `column reference "student_id" is ambiguous`. It also recalculates scanned records under the updated policy and removes premature auto-generated absences for classes that have not ended. This is safe to rerun and does not delete scanned attendance records.

Existing local AsyncStorage attendance and demo accounts are not imported into Supabase. Existing records remain on the device but are no longer used by the app.

## Run and validate

Install dependencies with `npm install`, then start Expo with `npm start`. Run `npm run lint`, `npx tsc --noEmit`, and `npm test` for local checks.
