// AI Writer Studio — Update-Service (oeffentliche Schnittstelle).
export {
  checkForUpdates,
  installUpdate,
  relaunchApp,
  onUpdateProgress,
  onUpdateInstalled,
} from './updateService';
export type { UpdateInfo, UpdateProgress } from './updateService';
