import { requireOptionalNativeModule } from "expo";
import { CredentialResultEnums } from "./types";

export type NativeResult = {
  status: string;
  id?: string;
  password?: string;
};

export type CredentialManagerNativeModule = {
  getPasswordCredential(): Promise<NativeResult>;
  savePasswordCredential(id: string, password: string): Promise<NativeResult>;
};

/**
 * Optional on purpose: the app still boots in Expo Go, on web, and in any
 * development build made before this module was added.
 */
export const nativeModule =
  requireOptionalNativeModule<CredentialManagerNativeModule>(
    "ExpoCredentialManager",
  );

const STATUSES = Object.values(CredentialResultEnums);

export function toStatus(status: string): CredentialResultEnums {
  return STATUSES.includes(status as CredentialResultEnums)
    ? (status as CredentialResultEnums)
    : CredentialResultEnums.ERROR;
}
