import { Router } from 'express';
import { daemonAuthenticate } from '../middleware/index.js';
import * as SftpAuthenticationController from '../controllers/api/remote/sftpAuthenticationController.js';
import * as ActivityProcessingController from '../controllers/api/remote/activityProcessingController.js';
import * as RemoteServerDetailsController from '../controllers/api/remote/servers/serverDetailsController.js';
import * as ServerInstallController from '../controllers/api/remote/servers/serverInstallController.js';
import * as ServerTransferController from '../controllers/api/remote/servers/serverTransferController.js';
import { backupRemoteUploadController } from '../controllers/api/remote/backups/backupRemoteUploadController.js';
import { backupStatusController } from '../controllers/api/remote/backups/backupStatusController.js';

const wrapAsync = (fn: Function) => (req: any, res: any, next: any) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const router = Router();

// Daemon API middleware stack
router.use(daemonAuthenticate);

// ---- SFTP Authentication ----
router.post('/sftp/auth', SftpAuthenticationController.index);

// ---- Servers ----
router.get('/servers', RemoteServerDetailsController.list);
router.post('/servers/reset', RemoteServerDetailsController.resetState);
router.get('/servers/:uuid', RemoteServerDetailsController.view);
router.get('/servers/:uuid/install', ServerInstallController.index);
router.post('/servers/:uuid/install', ServerInstallController.store);
router.post('/servers/:uuid/transfer/failure', ServerTransferController.failure);
router.post('/servers/:uuid/transfer/success', ServerTransferController.success);

// ---- Backups ----
router.get('/backups/:backup', wrapAsync((req: any, res: any) => backupRemoteUploadController.handle(req, res)));
router.post('/backups/:backup', wrapAsync((req: any, res: any) => backupStatusController.index(req, res)));
router.post('/backups/:backup/restore', wrapAsync((req: any, res: any) => backupStatusController.restore(req, res)));

// ---- Activity ----
router.post('/activity', ActivityProcessingController.index);

export default router;
