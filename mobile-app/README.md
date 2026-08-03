# UT Reserve

Mobile app for UT Austin students to book RecSports courts and LibCal study rooms — see `../context.md` for the full project writeup (architecture, key decisions, gotchas).

## Get started

```bash
npm install
npx expo start --dev-client
```

Requires a dev build, not Expo Go — `expo-notifications` doesn't work properly in Expo Go.

If Metro (port 8081) is blocked by Windows Firewall, run as administrator:

```bash
netsh advfirewall firewall add rule name="Expo Metro" dir=in action=allow protocol=TCP localport=8081
```

Fallback: `npx expo start --dev-client --tunnel` (requires `@expo/ngrok`).
