# Kontri

Split trip expenses equally among friends.

1. **Create a trip** (name, currency, optional dates)
2. **Add members**
3. **Add expenses**: who paid, how much, category and date. Split equally by default, or type a
   custom amount for some members (0 = not included); the rest is split equally among the others
4. **Advance fund (kitty)**: record money collected in advance (one member, or "everyone gives ₹X"),
   choose who holds the cash, and pay expenses from the fund
5. **Settle up**: see each member's equal share, who owes and who gets money back,
   and the fewest payments needed to settle. Share it on WhatsApp as a bill / receipt
   (expenses, totals, each person's share, and amounts due grouped by who receives them).

Everything is stored on the phone (works offline, no login).

## Install on Android

Every push builds an APK with GitHub Actions (`.github/workflows/android-apk.yml`).
Open the repository's **Releases → "Kontri (latest build)"** on your phone, download
`Kontri.apk` and install it. That APK is for 64-bit phones (almost all phones from the last
several years). For phones running 32-bit Android, run the workflow manually
(Actions → Android APK → Run workflow, tick "older phones"); the APK appears in the
"Kontri for older phones" release.
Each APK contains one CPU architecture, with resource shrinking and compressed native
libraries, to keep the download small. The APK is signed with a debug key, which is fine for
personal use. For the Play Store, set up a proper signing key or use EAS Build.

## Develop

```bash
npm install
npm start          # Expo dev server (Android, iOS, web)
npm test           # settlement and money unit tests (node:test)
npm run typecheck
npm run lint
```

## How the settlement works

- Amounts are stored as integers in the smallest unit (paise/cents), so there are no rounding errors.
- Each expense is split equally, except members with a custom amount for that expense, who pay
  exactly that; the remainder is split equally among the rest (`src/lib/split.ts`).
- Equal parts are rounded to the paisa. Leftover paise (e.g. ₹100 ÷ 3) go one each to the
  first members, so the shares always add up exactly to the total.
- Advance contributions count as money the member paid. Fund expenses are shared equally like
  any other expense. Money left in the fund is cash the holder has, so it is subtracted from the
  holder's balance (an overspent fund is added instead, since the holder covered it).
- Balance = paid + advance − fund cash held − share. The person who owes the most pays the person owed the most,
  repeated until everyone is settled (`src/lib/settlement.ts`).

## Project structure

```
App.tsx                    navigation + providers
src/lib/settlement.ts      settlement logic (pure, unit tested)
src/lib/money.ts           parsing and formatting (Indian digit grouping for INR)
src/store/TripsContext.tsx state + AsyncStorage persistence
src/screens/               Trips list, trip form, trip detail (Expenses / Members / Settle up), expense form
```
