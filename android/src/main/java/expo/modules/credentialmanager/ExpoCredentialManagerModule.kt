package expo.modules.credentialmanager

import android.app.Activity
import androidx.credentials.CreatePasswordRequest
import androidx.credentials.CredentialManager
import androidx.credentials.GetCredentialRequest
import androidx.credentials.GetPasswordOption
import androidx.credentials.PasswordCredential
import androidx.credentials.exceptions.CreateCredentialCancellationException
import androidx.credentials.exceptions.CreateCredentialException
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialException
import androidx.credentials.exceptions.GetCredentialProviderConfigurationException
import androidx.credentials.exceptions.NoCredentialException
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

private const val STATUS_SUCCESS = "success"
private const val STATUS_CANCELLED = "cancelled"
private const val STATUS_NO_CREDENTIAL = "noCredential"
private const val STATUS_UNAVAILABLE = "unavailable"
private const val STATUS_ERROR = "error"

// Replaces the deprecated Smart Lock for Passwords API. Note that Credential
// Manager does NOT replace Digital Asset Links: a credential the user saved on
// the website in a browser only reaches this sheet once the live
// assetlinks.json grants delegate_permission/common.get_login_creds.
class ExpoCredentialManagerModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ExpoCredentialManager")

    AsyncFunction("getPasswordCredential") Coroutine { autoSelect: Boolean ->
      getPasswordCredential(autoSelect)
    }

    AsyncFunction("savePasswordCredential") Coroutine { id: String, password: String ->
      savePasswordCredential(id, password)
    }
  }

  private val currentActivity: Activity?
    get() = appContext.activityProvider?.currentActivity

  private suspend fun getPasswordCredential(autoSelect: Boolean): Map<String, Any?> {
    val activity = currentActivity ?: return status(STATUS_UNAVAILABLE)
    // autoSelect is the caller's call, and defaults to false in JS: with it on,
    // a single stored credential comes back with no sheet and no tap, so
    // whoever holds the unlocked phone is signed in. prepareGetCredential and
    // preferImmediatelyAvailableCredentials were both tried on a real device
    // and suppressed the sheet entirely — do not reintroduce them.
    val request = GetCredentialRequest(
      listOf(GetPasswordOption(isAutoSelectAllowed = autoSelect)),
    )

    return try {
      val response = withContext(Dispatchers.Main) {
        CredentialManager.create(activity).getCredential(activity, request)
      }
      when (val credential = response.credential) {
        is PasswordCredential -> mapOf(
          "status" to STATUS_SUCCESS,
          "id" to credential.id,
          "password" to credential.password,
        )
        else -> status(STATUS_NO_CREDENTIAL)
      }
    } catch (e: GetCredentialCancellationException) {
      status(STATUS_CANCELLED)
    } catch (e: NoCredentialException) {
      status(STATUS_NO_CREDENTIAL)
    } catch (e: GetCredentialProviderConfigurationException) {
      status(STATUS_UNAVAILABLE)
    } catch (e: GetCredentialException) {
      status(STATUS_ERROR)
    }
  }

  private suspend fun savePasswordCredential(
    id: String,
    password: String,
  ): Map<String, Any?> {
    val activity = currentActivity ?: return status(STATUS_UNAVAILABLE)
    val request = CreatePasswordRequest(id = id, password = password)

    return try {
      withContext(Dispatchers.Main) {
        CredentialManager.create(activity).createCredential(activity, request)
      }
      status(STATUS_SUCCESS)
    } catch (e: CreateCredentialCancellationException) {
      status(STATUS_CANCELLED)
    } catch (e: CreateCredentialException) {
      status(STATUS_ERROR)
    }
  }

  private fun status(value: String): Map<String, Any?> = mapOf("status" to value)
}
