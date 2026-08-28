// Sicherheits- & Privatsphaere-Modul (oeffentliche Schnittstelle).
export {
  toBase64,
  fromBase64,
  randomBytes,
  sha256Hex,
  deriveKey,
  encryptString,
  decryptString,
  isEncryptedPayload,
} from "./crypto";

export {
  isManuscriptUnlocked,
  setMasterSecret,
  clearMasterSecret,
  encryptChapterContent,
  decryptChapterContent,
} from "./manuscriptEncryption";

export {
  createAuthRecord,
  verifyPassword,
  autoLockMs,
  type AuthRecord,
  type AutoLockSetting,
} from "./auth";

export {
  isPrivacyMode,
  setPrivacyMode,
  assertCloudAllowed,
  requireCloudAllowed,
  isCloudProvider,
  CLOUD_PROVIDERS,
  type PrivacyDecision,
  type PrivacyReason,
} from "./privacy";

export {
  createEncryptedBackup,
  restoreEncryptedBackup,
  validateContainerShape,
  type BackupContainer,
  type BackupEntry,
  type BackupPayload,
  type RestoreResult,
} from "./secureBackup";
