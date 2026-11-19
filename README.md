# AttendEase

AttendEase is an Expo attendance app for teachers and students. The student dashboard shows today's attendance below the QR code. The Wi-Fi demo shares real attendance, simulated check-ins, and the class schedule between devices. Test-clock settings stay in device storage.

## Local login

- Teacher: `teacher@gmail.com` / `teacher123`
- Student: use a listed student ID as both the username and password.

## Run the app

Install dependencies with `npm install`, then start Expo with `npm start`.

## Demo attendance on two devices

1. Connect the computer and both phones to the same Wi-Fi. On the computer, run `npm run attendance-server` in the project folder using Node.js 22.13 or newer. In Windows PowerShell, use `npm.cmd` if script execution is disabled.
2. In a second terminal, run `npm start`. Expo forwards attendance requests to the server on the same computer.
3. Open the Expo project in Expo Go on both phones. Sign in as the teacher on one phone and as a student on the other.
4. On the teacher's phone, save the **Class Schedule** and tap **Scan Student**. Check that the scanner says **Shared attendance**. Scan the student's on-screen QR code and tap **View Records** on the confirmation to open that date. Within a few seconds, the student's **Today's Attendance** card shows the same status, date, and check-in time.

QR scans use real attendance. **Simulate check-in** uses the test clock and appears in **View Records** when the test records switch is on. On the student dashboard it appears under **Test Attendance**. To share a previous simulation from device storage, reopen **View Records** with the test records switch on and select its date.

Open **Profile → Attendance History** to browse records by month. Students see their own entries and teachers see the class. Use **Official** or **Test** to choose which records to display.

The server uses the host computer's local clock and stores its schedule and records in `.attendance-data/`. To sync a check-in saved in device mode, reopen **View Records** on the original teacher device and select its date. Set `EXPO_PUBLIC_ATTENDANCE_SERVER_URL=off` in `.env.local` and restart Expo to use device mode. Set a full URL there to connect to a separately configured attendance server. The demo uses HTTP and the bundled demo accounts on a trusted local network.
