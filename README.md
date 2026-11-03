# TripSplit

Split trip expenses equally among friends.

1. **Create a trip** (name, currency, optional dates)
2. **Add members**
3. **Add expenses**: who paid, how much, category and date
4. **Settle up**: see each member's equal share, who owes and who gets money back,
   and the fewest payments needed to settle. Share the summary on WhatsApp.

Everything is stored on the phone (works offline, no login).

## Install on Android

Every push builds an APK with GitHub Actions (`.github/workflows/android-apk.yml`).
Open the repository's **Releases → "TripSplit (latest build)"** on your phone, download
`TripSplit.apk` and install it. The APK is signed with a debug key, which is fine for
personal use. For the Play Store, set up a proper signing key or use EAS Build.

## Develop

```bash
npm install
npm start          # Expo dev server (Android, iOS, web)
npm test           # settlement and money unit tests (node:test)
npm run typecheck
```

## How the settlement works

- Amounts are stored as integers in the smallest unit (paise/cents), so there are no rounding errors.
- Total ÷ members gives each share. Leftover paise (e.g. ₹100 ÷ 3) go one each to the
  first members, so the shares always add up exactly to the total.
- Balance = paid − share. The person who owes the most pays the person owed the most,
  repeated until everyone is settled (`src/lib/settlement.ts`).

## Project structure

```
App.tsx                    navigation + providers
src/lib/settlement.ts      settlement logic (pure, unit tested)
src/lib/money.ts           parsing and formatting (Indian digit grouping for INR)
src/store/TripsContext.tsx state + AsyncStorage persistence
src/screens/               Trips list, trip form, trip detail (Expenses / Members / Settle up), expense form
```
