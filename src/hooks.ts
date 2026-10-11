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
  PasswordCredential,
} from "./types";

type UseCredentialManagerReturn = {
  /** `true` when the native module is in this binary. */
  isAvailable: boolean;
  /** `true` while the system sheet is open. */
  loading: boolean;
  /** Outcome of the last completed request, including the normal ones. */
  lastResult: CredentialResult | null;
  /** Opens the sheet; resolves `undefined` unless the user picked a credential. */
  requestCredential: () => Promise<PasswordCredential | undefined>;
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

  const requestCredential = useCallback(async () => {
    if (inFlight.current) return undefined;
    inFlight.current = true;
    if (isMounted.current) setLoading(true);

    try {
      const result = await getPasswordCredential();
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
