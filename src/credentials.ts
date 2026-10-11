import { nativeModule, toStatus } from "./nativeModule";
import {
  CredentialResult,
  CredentialResultEnums,
  GetCredentialOptions,
  PasswordCredential,
} from "./types";

/**
 * What the OS handed us this session. Re-saving it would make the system show
 * its "save this password?" prompt for a credential it already holds, which
 * reads as a bug right after a one-tap sign-in.
 */
let lastRetrieved: { id: string; password: string } | undefined;

/** `true` when the native module is in this binary. */
export function isCredentialManagerAvailable(): boolean {
  return nativeModule != null;
}

/**
 * Opens the system credential sheet and resolves with the chosen credential.
 *
 * Android: Credential Manager (`GetPasswordOption`). The account picker is
 * confirmed every time unless the caller passes `{ autoSelect: true }`. iOS:
 * `ASAuthorizationPasswordProvider`, gated on Face ID / Touch ID by the OS,
 * which ignores `autoSelect`.
 *
 * Never throws — every failure comes back as a status.
 */
export async function getPasswordCredential(
  options?: GetCredentialOptions,
): Promise<CredentialResult> {
  if (!nativeModule) return { status: CredentialResultEnums.UNAVAILABLE };

  try {
    const result = await nativeModule.getPasswordCredential(
      options?.autoSelect ?? false,
    );
    const status = toStatus(result.status);

    if (
      status === CredentialResultEnums.SUCCESS &&
      result.id &&
      result.password
    ) {
      lastRetrieved = { id: result.id, password: result.password };
      return {
        status: CredentialResultEnums.SUCCESS,
        id: result.id,
        password: result.password,
      };
    }

    return {
      status:
        status === CredentialResultEnums.SUCCESS
          ? CredentialResultEnums.NO_CREDENTIAL
          : status,
    };
  } catch {
    return { status: CredentialResultEnums.ERROR };
  }
}

/**
 * Offers the credential to the system password manager.
 *
 * Call it after a sign-in your backend accepted, not before. Returns
 * `UNCHANGED` when the OS already handed you this exact pair this session, and
 * `UNSUPPORTED` on iOS, which has no public API to write a password.
 */
export async function savePasswordCredential(
  id: string,
  password: string,
): Promise<CredentialResultEnums> {
  if (lastRetrieved?.id === id && lastRetrieved.password === password) {
    return CredentialResultEnums.UNCHANGED;
  }
  if (!nativeModule) return CredentialResultEnums.UNAVAILABLE;

  try {
    const result = await nativeModule.savePasswordCredential(id, password);
    return toStatus(result.status);
  } catch {
    return CredentialResultEnums.ERROR;
  }
}

/** Type guard for the success member of `CredentialResult`. */
export function isPasswordCredential(
  result: CredentialResult,
): result is PasswordCredential {
  return result.status === CredentialResultEnums.SUCCESS;
}
