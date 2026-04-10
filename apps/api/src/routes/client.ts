import { Router } from 'express';
import {
  sanctumAuth,
  authenticateIPAccess,
  requireTwoFactor,
  clientRateLimit,
  authenticateServerAccess,
  resourceBelongsToServer,
} from '../middleware/index.js';

// Account controllers
import {
  index as accountIndex,
  updateEmail,
  updatePassword,
} from '../controllers/api/client/accountController.js';
import {
  index as twoFactorIndex,
  store as twoFactorStore,
  destroy as twoFactorDestroy,
} from '../controllers/api/client/twoFactorController.js';
import {
  index as apiKeyIndex,
  store as apiKeyStore,
  destroy as apiKeyDestroy,
} from '../controllers/api/client/apiKeyController.js';
import {
  index as sshKeyIndex,
  store as sshKeyStore,
  destroy as sshKeyDestroy,
} from '../controllers/api/client/sshKeyController.js';
import { accountActivityLog } from '../controllers/api/client/activityLogController.js';
import { serverActivityLog } from '../controllers/api/client/servers/activityLogController.js';
import * as NetworkAllocationController from '../controllers/api/client/servers/networkAllocationController.js';
import { clientDatabaseController } from '../controllers/api/client/servers/databaseController.js';
import * as ClientController from '../controllers/api/client/clientController.js';
import * as ClientServerController from '../controllers/api/client/servers/serverController.js';
import * as PowerController from '../controllers/api/client/servers/powerController.js';
import * as CommandController from '../controllers/api/client/servers/commandController.js';
import * as ResourceUtilizationController from '../controllers/api/client/servers/resourceUtilizationController.js';
import * as ClientStartupController from '../controllers/api/client/servers/startupController.js';
import * as SettingsController from '../controllers/api/client/servers/settingsController.js';
import * as WebsocketController from '../controllers/api/client/servers/websocketController.js';
import { backupController } from '../controllers/api/client/servers/backupController.js';
import { fileController } from '../controllers/api/client/servers/fileController.js';
import { fileUploadController } from '../controllers/api/client/servers/fileUploadController.js';
import { scheduleController } from '../controllers/api/client/servers/scheduleController.js';
import { scheduleTaskController } from '../controllers/api/client/servers/scheduleTaskController.js';
import { subuserController } from '../controllers/api/client/servers/subuserController.js';

const wrapAsync = (fn: Function) => (req: any, res: any, next: any) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const router = Router();

// Client API middleware stack (matches RouteServiceProvider)
router.use(sanctumAuth);
router.use(authenticateIPAccess);
router.use(requireTwoFactor);
router.use(clientRateLimit);

// ---- Account routes (no server context) ----
router.get('/', ClientController.index);
router.get('/permissions', ClientController.permissions);

// Account info
router.get('/account', accountIndex);

// Two-factor authentication
router.get('/account/two-factor', twoFactorIndex);
router.post('/account/two-factor', twoFactorStore);
router.post('/account/two-factor/disable', twoFactorDestroy);

// Account updates
router.put('/account/email', updateEmail);
router.put('/account/password', updatePassword);

// API keys
router.get('/account/api-keys', apiKeyIndex);
router.post('/account/api-keys', apiKeyStore);
router.delete('/account/api-keys/:identifier', apiKeyDestroy);

// SSH keys
router.get('/account/ssh-keys', sshKeyIndex);
router.post('/account/ssh-keys', sshKeyStore);
router.post('/account/ssh-keys/remove', sshKeyDestroy);

router.get('/account/activity', accountActivityLog);

// ---- Server routes (with server context) ----
const serverRouter = Router({ mergeParams: true });
serverRouter.use(authenticateServerAccess);
serverRouter.use(resourceBelongsToServer);

// Server details & info
serverRouter.get('/', ClientServerController.index);
serverRouter.get('/websocket', WebsocketController.index);
serverRouter.get('/resources', ResourceUtilizationController.index);
serverRouter.get('/activity', serverActivityLog);
serverRouter.post('/command', CommandController.index);
serverRouter.post('/power', PowerController.index);

// Server databases
serverRouter.get('/databases', clientDatabaseController.index);
serverRouter.post('/databases', clientDatabaseController.store);
serverRouter.post('/databases/:database/rotate-password', clientDatabaseController.rotatePassword);
serverRouter.delete('/databases/:database', clientDatabaseController.delete);

// File management
serverRouter.get('/files/list', wrapAsync((req: any, res: any) => fileController.directory(req, res)));
serverRouter.get('/files/contents', wrapAsync((req: any, res: any) => fileController.contents(req, res)));
serverRouter.get('/files/download', wrapAsync((req: any, res: any) => fileController.download(req, res)));
serverRouter.get('/files/upload', wrapAsync((req: any, res: any) => fileUploadController.handle(req, res)));
serverRouter.put('/files/rename', wrapAsync((req: any, res: any) => fileController.rename(req, res)));
serverRouter.post('/files/copy', wrapAsync((req: any, res: any) => fileController.copy(req, res)));
serverRouter.post('/files/write', wrapAsync((req: any, res: any) => fileController.write(req, res)));
serverRouter.post('/files/compress', wrapAsync((req: any, res: any) => fileController.compress(req, res)));
serverRouter.post('/files/decompress', wrapAsync((req: any, res: any) => fileController.decompress(req, res)));
serverRouter.post('/files/delete', wrapAsync((req: any, res: any) => fileController.deleteFiles(req, res)));
serverRouter.post('/files/create-folder', wrapAsync((req: any, res: any) => fileController.create(req, res)));
serverRouter.post('/files/chmod', wrapAsync((req: any, res: any) => fileController.chmod(req, res)));
serverRouter.post('/files/pull', wrapAsync((req: any, res: any) => fileController.pull(req, res)));

// Schedules
serverRouter.get('/schedules', wrapAsync((req: any, res: any) => scheduleController.index(req, res)));
serverRouter.post('/schedules', wrapAsync((req: any, res: any) => scheduleController.store(req, res)));
serverRouter.get('/schedules/:schedule', wrapAsync((req: any, res: any) => scheduleController.view(req, res)));
serverRouter.post('/schedules/:schedule', wrapAsync((req: any, res: any) => scheduleController.update(req, res)));
serverRouter.post('/schedules/:schedule/execute', wrapAsync((req: any, res: any) => scheduleController.execute(req, res)));
serverRouter.delete('/schedules/:schedule', wrapAsync((req: any, res: any) => scheduleController.delete(req, res)));

// Schedule tasks
serverRouter.post('/schedules/:schedule/tasks', wrapAsync((req: any, res: any) => scheduleTaskController.store(req, res)));
serverRouter.post('/schedules/:schedule/tasks/:task', wrapAsync((req: any, res: any) => scheduleTaskController.update(req, res)));
serverRouter.delete('/schedules/:schedule/tasks/:task', wrapAsync((req: any, res: any) => scheduleTaskController.delete(req, res)));

// Network allocations
serverRouter.get('/network/allocations', NetworkAllocationController.index);
serverRouter.post('/network/allocations', NetworkAllocationController.store);
serverRouter.post('/network/allocations/:allocation', NetworkAllocationController.update);
serverRouter.post('/network/allocations/:allocation/primary', NetworkAllocationController.setPrimary);
serverRouter.delete('/network/allocations/:allocation', NetworkAllocationController.remove);

// Subusers
serverRouter.get('/users', wrapAsync((req: any, res: any) => subuserController.index(req, res)));
serverRouter.post('/users', wrapAsync((req: any, res: any) => subuserController.store(req, res)));
serverRouter.get('/users/:user', wrapAsync((req: any, res: any) => subuserController.view(req, res)));
serverRouter.post('/users/:user', wrapAsync((req: any, res: any) => subuserController.update(req, res)));
serverRouter.delete('/users/:user', wrapAsync((req: any, res: any) => subuserController.delete(req, res)));

// Backups
serverRouter.get('/backups', wrapAsync((req: any, res: any) => backupController.index(req, res)));
serverRouter.post('/backups', wrapAsync((req: any, res: any) => backupController.store(req, res)));
serverRouter.get('/backups/:backup', wrapAsync((req: any, res: any) => backupController.view(req, res)));
serverRouter.get('/backups/:backup/download', wrapAsync((req: any, res: any) => backupController.download(req, res)));
serverRouter.post('/backups/:backup/lock', wrapAsync((req: any, res: any) => backupController.toggleLock(req, res)));
serverRouter.post('/backups/:backup/restore', wrapAsync((req: any, res: any) => backupController.restore(req, res)));
serverRouter.delete('/backups/:backup', wrapAsync((req: any, res: any) => backupController.delete(req, res)));

// Startup
serverRouter.get('/startup', ClientStartupController.index);
serverRouter.put('/startup/variable', ClientStartupController.update);

// Settings
serverRouter.post('/settings/rename', SettingsController.rename);
serverRouter.post('/settings/reinstall', SettingsController.reinstall);
serverRouter.put('/settings/docker-image', SettingsController.dockerImage);

router.use('/servers/:server', serverRouter);

export default router;
