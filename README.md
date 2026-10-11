# @pj21/expo-credential-manager

One-tap password sign-in for **Expo / React Native**, on the modern native APIs: **Android Credential Manager** (`androidx.credentials`) and **iOS AuthenticationServices** (`ASAuthorizationPasswordProvider`).

- ✅ Opens the real system sheet — the same one the OS shows a native app, with Face ID / Touch ID / biometric confirmation
- ✅ One typed, discriminated result — no try/catch, every failure is a status
- ✅ Replaces the deprecated **Smart Lock for Passwords**; no Google Play Services sign-in SDK, no Firebase
- ✅ Autolinked, no native code to write — safe in Expo Go and on web, where it reports `unavailable` instead of crashing
- ✅ Ships a config plugin for the iOS `webcredentials:` entitlement

## Why this exists

React Native gives you `autoComplete` / `textContentType` hints, and that is all. The keyboard's inline suggestion strip only appears once the OS already recognises the field, which is why on most RN apps you type the whole email before any suggestion shows up. This library asks the OS directly, so a single focus — or a button press — can open the sheet, authenticate, and hand back both fields.

## Installation

```sh
npx expo install @pj21/expo-credential-manager
```

Requires a [development build](https://docs.expo.dev/develop/development-builds/introduction/) (`npx expo run:android` / `run:ios`). It does **not** work in Expo Go — there, every call returns `unavailable`.

| | Minimum |
| --- | --- |
| Expo SDK | 52+ |
| Android | minSdk 24 (Credential Manager + `credentials-play-services-auth` cover API 24–33) |
| iOS | 15.1 |

## Setup

Both platforms gate credentials on an **app ↔ website association**. The library cannot do this for you: the association is two files served from your domain. Without them the sheet opens and reports `noCredential` — correctly, because the OS will not reveal a credential to an app it cannot prove owns the site.

### Android — `assetlinks.json`

Serve `https://yourdomain.com/.well-known/assetlinks.json` with the `get_login_creds` relation. A file that only has `handle_all_urls` (the usual deep-link setup) is **not enough**:

```json
[
  {
    "relation": [
      "delegate_permission/common.handle_all_urls",
      "delegate_permission/common.get_login_creds"
    ],
    "target": {
      "namespace": "android_app",
      "package_name": "com.yourcompany.yourapp",
      "sha256_cert_fingerprints": ["AA:BB:…"]
    }
  }
]
```

List every signing certificate you ship with — debug, upload, and Play App Signing.

### iOS — Associated Domains + AASA

1. Enable the **Associated Domains** capability for your App ID in the Apple Developer portal.
2. Add the `webcredentials:` entitlement, either through this library's config plugin:

   ```json
   {
     "expo": {
       "plugins": [
         ["@pj21/expo-credential-manager", { "associatedDomains": ["yourdomain.com"] }]
       ]
     }
   }
   ```

   …or by listing it yourself in `ios.associatedDomains` (`"webcredentials:yourdomain.com"`). The plugin merges with whatever is already there, so existing `applinks:` entries survive.
3. Serve `https://yourdomain.com/.well-known/apple-app-site-association` (JSON, **no** `.json` extension, `Content-Type: application/json`, no redirects) with a `webcredentials` block:

   ```json
   {
     "applinks": { "details": [] },
     "webcredentials": { "apps": ["TEAMID.com.yourcompany.yourapp"] }
   }
   ```

> Both files are fetched by the OS, not by your app. Changing them needs no new build — but iOS caches AASA, so reinstall the app when testing.

## Usage

### With the hook

```tsx
import { useCredentialManager } from "@pj21/expo-credential-manager";

const LoginScreen = () => {
  const { requestCredential, saveCredential } = useCredentialManager();
  const hasAsked = useRef(false);

  // Open the sheet the moment the user reaches the form, once, and only while
  // the form is still untouched.
  const onEmailFocus = async () => {
    if (hasAsked.current || email || password) return;
    hasAsked.current = true;

    const credential = await requestCredential();
    if (!credential) return;

    setEmail(credential.id);
    setPassword(credential.password);
    Keyboard.dismiss();
    login(credential.id, credential.password);
  };

  // After the backend accepted the sign-in — never before.
  const onLoginSuccess = () => saveCredential(email, password);

  return <TextInput value={email} onFocus={onEmailFocus} autoComplete="username" />;
};
```

### Without the hook

```ts
import {
  CredentialResultEnums,
  getPasswordCredential,
  savePasswordCredential,
} from "@pj21/expo-credential-manager";

const result = await getPasswordCredential();
if (result.status === CredentialResultEnums.SUCCESS) {
  // `id` and `password` are `string` here — the union narrows on status.
  await login(result.id, result.password);
}

await savePasswordCredential(email, password);
```

### Still add the autofill hints

This library is the *one-tap* path, not a replacement for field hints. Keep them on your inputs so the keyboard strip and the iOS save prompt keep working:

```tsx
<TextInput autoComplete="username" textContentType="username" importantForAutofill="yes" />
<TextInput autoComplete="current-password" textContentType="password" secureTextEntry />
```

On Android, never set `keyboardType="visible-password"` for a show/hide toggle — it changes the `inputType` and the field drops out of autofill classification. Toggle `secureTextEntry` alone.

## API

| Export | Description |
| --- | --- |
| `useCredentialManager()` | React hook: `isAvailable`, `loading`, `lastResult`, `requestCredential()`, `saveCredential()` |
| `getPasswordCredential()` | Opens the sheet → `Promise<CredentialResult>`. Never throws. |
| `savePasswordCredential(id, password)` | Offers the credential to the password manager → `Promise<CredentialResultEnums>` |
| `isCredentialManagerAvailable()` | `true` when the native module is in this binary |
| `isPasswordCredential(result)` | Type guard narrowing `CredentialResult` to its success member |

### `CredentialResult`

```ts
type CredentialResult =
  | { status: CredentialResultEnums.SUCCESS; id: string; password: string }
  | { status: Exclude<CredentialResultEnums, CredentialResultEnums.SUCCESS> };
```

### `CredentialResultEnums`

| Value | Meaning | Treat as |
| --- | --- | --- |
| `SUCCESS` | A credential came back, or the save completed | Act on it |
| `CANCELLED` | The user dismissed the sheet | Normal — stay silent |
| `NO_CREDENTIAL` | Nothing saved for this app's associated domains | Normal — stay silent |
| `UNAVAILABLE` | No provider, no foreground activity, or no native module (Expo Go, web) | Normal — stay silent |
| `UNCHANGED` | Save skipped: the OS already handed you this exact pair this session | Normal — stay silent |
| `UNSUPPORTED` | iOS save — the platform has no public API for it | Expected, see below |
| `ERROR` | The provider failed | Worth logging |

Only `ERROR` deserves a log. The other four non-success statuses are ordinary user behaviour — toasting them produces an app that complains every time someone taps outside a sheet.

## Platform differences

| | Android | iOS |
| --- | --- | --- |
| Read a credential | Credential Manager sheet | Password AutoFill sheet (Face ID / Touch ID) |
| Save a credential | `CreatePasswordRequest` — a real system prompt | **`unsupported`** |
| Association file | `.well-known/assetlinks.json` | `.well-known/apple-app-site-association` |

iOS has no public API to write a password. `SecAddSharedWebCredential` is deprecated and `ASAuthorizationPasswordProvider` is read-only, so `savePasswordCredential` reports `unsupported` instead of pretending to succeed. Saving on iOS happens through Password AutoFill's own "Save Password?" prompt, which the OS raises on its own when your fields carry the right `textContentType` hints.

### Double-save protection

The library remembers the last credential the OS handed it. Calling `savePasswordCredential` with that same pair returns `UNCHANGED` without touching the system, so a user who just signed in with one tap is not immediately asked to save a password the OS already holds.

## Gotchas

- **Do not add `prepareGetCredential` or `setPreferImmediatelyAvailableCredentials`** as an "is anything saved?" pre-check. Both were tried on a real device: they silently suppressed the sheet entirely. The only smoothing applied is `GetPasswordOption(isAutoSelectAllowed = true)`, which skips the account picker when exactly one credential matches.
- **Credential Manager does not replace Digital Asset Links.** A password the user saved on your website in Chrome only reaches the sheet once the live `assetlinks.json` grants `get_login_creds`.
- **Save after the backend says yes**, not on submit. Saving a rejected password poisons the password manager.
- **R8**: `credentials-play-services-auth` emits a handful of "invalid stack map table" warnings against `play-services-auth`. The build succeeds and the classes are retained; they are warnings, not errors.
- Changing native modules means rebuilding — `npx expo prebuild` then `run:android` / `run:ios`. A JS reload is not enough.

## License

MIT
