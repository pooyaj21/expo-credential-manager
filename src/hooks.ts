import { useCallback, useEffect, useRef, useState } from "react";
import {
  getPasswordCredential,
  isCredentialManagerAvailable,
  isPasswordCredential,
  savePasswordCredential,
} from "./credentials";
import {
  CredentialResult,
  CredentialResultEnums,
  GetCredentialOptions,
  PasswordCredential,
} from "./types";

type UseCredentialManagerReturn = {
  /** `true` when the native module is in this binary. */
  isAvailable: boolean;
  /** `true` while the system sheet is open. */
  loading: boolean;
  /** Outcome of the last completed request, including the normal ones. */
  lastResult: CredentialResult | null;
  /**
   * Opens the sheet; resolves `undefined` unless the user picked a credential.
   * Pass `{ autoSelect: true }` to let Android skip the picker when exactly one
   * credential matches.
   */
  requestCredential: (
    options?: GetCredentialOptions,
  ) => Promise<PasswordCredential | undefined>;
  /** Offers a credential to the system password manager after a successful sign-in. */
  saveCredential: (
    id: string,
    password: string,
  ) => Promise<CredentialResultEnums>;
};

/**
 * One-tap sign-in with the system password sheet.
 *
 * ```tsx
 * const { requestCredential, saveCredential } = useCredentialManager();
 *
 * const onEmailFocus = async () => {
 *   const credential = await requestCredential();
 *   if (credential) login(credential.id, credential.password);
 * };
 * ```
 *
 * The account picker is confirmed on every call. To let Android return a lone
 * stored credential with no sheet and no tap:
 *
 * ```tsx
 * const credential = await requestCredential({ autoSelect: true });
 * ```
 */
export function useCredentialManager(): UseCredentialManagerReturn {
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState<CredentialResult | null>(null);
  // The auth screen usually unmounts the moment sign-in succeeds, so the sheet
  // can resolve after this hook is gone.
  const isMounted = useRef(true);
  const inFlight = useRef(false);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const requestCredential = useCallback(async (options?: GetCredentialOptions) => {
    if (inFlight.current) return undefined;
    inFlight.current = true;
    if (isMounted.current) setLoading(true);

    try {
      const result = await getPasswordCredential(options);
      if (isMounted.current) setLastResult(result);
      return isPasswordCredential(result) ? result : undefined;
    } finally {
      inFlight.current = false;
      if (isMounted.current) setLoading(false);
    }
  }, []);

  const saveCredential = useCallback(
    (id: string, password: string) => savePasswordCredential(id, password),
    [],
  );

  return {
    isAvailable: isCredentialManagerAvailable(),
    loading,
    lastResult,
    requestCredential,
    saveCredential,
  };
}
