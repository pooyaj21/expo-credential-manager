import ExpoModulesCore
import AuthenticationServices

private let statusSuccess = "success"
private let statusCancelled = "cancelled"
private let statusNoCredential = "noCredential"
private let statusUnavailable = "unavailable"
private let statusUnsupported = "unsupported"

// ASAuthorizationPasswordProvider reads credentials the OS holds for this app's
// `webcredentials:` associated domains, so it stays inert until the AASA is
// live. There is no public API to WRITE a password (SecAddSharedWebCredential
// is deprecated), which is why savePasswordCredential reports `unsupported`
// rather than pretending to succeed — saving on iOS is handled by Password
// AutoFill's own prompt, driven by the textContentType hints on the fields.
public class ExpoCredentialManagerModule: Module {
  private var requestController: PasswordRequestController?

  public func definition() -> ModuleDefinition {
    Name("ExpoCredentialManager")

    AsyncFunction("getPasswordCredential") { (promise: Promise) in
      let controller = PasswordRequestController { [weak self] result in
        self?.requestController = nil
        promise.resolve(result)
      }
      self.requestController = controller
      controller.start()
    }
    .runOnQueue(.main)

    AsyncFunction("savePasswordCredential") { (_: String, _: String) -> [String: Any] in
      ["status": statusUnsupported]
    }
  }
}

private final class PasswordRequestController: NSObject,
  ASAuthorizationControllerDelegate,
  ASAuthorizationControllerPresentationContextProviding
{
  private let completion: ([String: Any]) -> Void
  private var hasCompleted = false

  init(completion: @escaping ([String: Any]) -> Void) {
    self.completion = completion
  }

  func start() {
    let request = ASAuthorizationPasswordProvider().createRequest()
    let controller = ASAuthorizationController(authorizationRequests: [request])
    controller.delegate = self
    controller.presentationContextProvider = self
    controller.performRequests()
  }

  private func finish(_ result: [String: Any]) {
    guard !hasCompleted else { return }
    hasCompleted = true
    completion(result)
  }

  func authorizationController(
    controller: ASAuthorizationController,
    didCompleteWithAuthorization authorization: ASAuthorization
  ) {
    guard let credential = authorization.credential as? ASPasswordCredential else {
      finish(["status": statusNoCredential])
      return
    }
    finish([
      "status": statusSuccess,
      "id": credential.user,
      "password": credential.password,
    ])
  }

  func authorizationController(
    controller: ASAuthorizationController,
    didCompleteWithError error: Error
  ) {
    guard let authorizationError = error as? ASAuthorizationError else {
      finish(["status": statusNoCredential])
      return
    }
    switch authorizationError.code {
    case .canceled:
      finish(["status": statusCancelled])
    case .notHandled, .failed, .invalidResponse:
      finish(["status": statusNoCredential])
    default:
      finish(["status": statusUnavailable])
    }
  }

  func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
    let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
    let window = scenes
      .first { $0.activationState == .foregroundActive }?
      .windows.first { $0.isKeyWindow }
    return window ?? scenes.first?.windows.first ?? ASPresentationAnchor()
  }
}
