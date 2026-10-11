/**
 * Outcome of a credential request or save.
 *
 * `cancelled`, `noCredential` and `unavailable` are *normal* outcomes — the
 * user dismissed the sheet, nothing is saved for this app yet, or the device
 * has no credential provider. Never surface them as errors.
 */
export enum CredentialResultEnums {
  /** A credential was returned, or the save completed. */
  SUCCESS = "success",
  /** The user dismissed the system sheet. */
  CANCELLED = "cancelled",
  /** No credential is stored for this app's associated domains. */
  NO_CREDENTIAL = "noCredential",
  /** No credential provider, no foreground activity, or no native module. */
  UNAVAILABLE = "unavailable",
  /** Save skipped — the OS already holds exactly this credential. */
  UNCHANGED = "unchanged",
  /** The platform has no API for this operation (saving, on iOS). */
  UNSUPPORTED = "unsupported",
  /** The provider failed for a reason worth logging. */
  ERROR = "error",
}

/** A credential the OS handed back. `id` is whatever was saved as the username. */
export type PasswordCredential = {
  status: CredentialResultEnums.SUCCESS;
  id: string;
  password: string;
};

export type CredentialFailure = {
  status: Exclude<CredentialResultEnums, CredentialResultEnums.SUCCESS>;
};

/** Narrow on `status === CredentialResultEnums.SUCCESS` to reach `id` / `password`. */
export type CredentialResult = PasswordCredential | CredentialFailure;

/** Options for `getPasswordCredential` / `requestCredential`. */
export type GetCredentialOptions = {
  /**
   * Android only. `true` lets the system skip the account picker and return a
   * stored credential with no sheet and no tap, when exactly one matches —
   * fastest, but it means anyone holding the unlocked phone is signed in.
   * `false` (the default) always shows the picker, so every sign-in is
   * confirmed. iOS ignores this: `ASAuthorizationPasswordProvider` always
   * raises its own Face ID / Touch ID gated sheet.
   *
   * @default false
   */
  autoSelect?: boolean;
};
