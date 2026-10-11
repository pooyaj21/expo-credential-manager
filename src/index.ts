export {
  getPasswordCredential,
  isCredentialManagerAvailable,
  isPasswordCredential,
  savePasswordCredential,
} from "./credentials";
export { useCredentialManager } from "./hooks";
export { CredentialResultEnums } from "./types";
export type {
  CredentialFailure,
  CredentialResult,
  GetCredentialOptions,
  PasswordCredential,
} from "./types";
