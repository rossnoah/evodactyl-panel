import { Router } from 'express';
import { sanctumAuth, authenticateIPAccess, authenticateApplicationUser, applicationRateLimit } from '../middleware/index.js';
import {
  index as userIndex,
  view as userView,
  store as userStore,
  update as userUpdate,
  destroy as userDelete,
  viewExternal as userViewExternal,
} from '../controllers/api/application/userController.js';
import * as NodeController from '../controllers/api/application/nodeController.js';
import { getConfiguration as NodeConfigurationController } from '../controllers/api/application/nodeConfigurationController.js';
import { getDeployableNodes as NodeDeploymentController } from '../controllers/api/application/nodeDeploymentController.js';
import { getSystemInformation as NodeSystemInformationController } from '../controllers/api/application/nodeSystemInformationController.js';
import { generateDeployToken as NodeAutoDeployController } from '../controllers/api/application/nodeAutoDeployController.js';
import * as AllocationController from '../controllers/api/application/allocationController.js';
import * as LocationController from '../controllers/api/application/locationController.js';
import { nestController } from '../controllers/api/application/nestController.js';
import { eggController } from '../controllers/api/application/eggController.js';
import { databaseController } from '../controllers/api/application/databaseController.js';
import * as DatabaseHostController from '../controllers/api/application/databaseHostController.js';
import * as SettingsController from '../controllers/api/application/settingsController.js';
import * as MountController from '../controllers/api/application/mountController.js';
import * as AppServerController from '../controllers/api/application/serverController.js';
import * as AppServerDetailsController from '../controllers/api/application/serverDetailsController.js';
import * as AppServerManagementController from '../controllers/api/application/serverManagementController.js';
import * as AppStartupController from '../controllers/api/application/startupController.js';
import * as ApiKeyController from '../controllers/api/application/apiKeyController.js';
import { transfer as serverTransfer } from '../controllers/api/application/serverTransferController.js';

const router = Router();

// Application API middleware stack (matches RouteServiceProvider)
router.use(sanctumAuth);
router.use(authenticateIPAccess);
router.use(authenticateApplicationUser);
router.use(applicationRateLimit);

// ---- System Information ----
router.get('/system-info', async (_req, res) => {
  const { config } = await import('../config/index.js');
  const pkg = await import('../../package.json');
  const isBun = typeof globalThis.Bun !== 'undefined';
  res.json({
    version: `${pkg.version}-${config.app.version}`,
    runtime: isBun ? `Bun ${Bun.version}` : `Node.js ${process.version}`,
    environment: config.app.env,
  });
});

// ---- Users ----
router.get('/users', userIndex);
router.get('/users/external/:externalId', userViewExternal);
router.get('/users/:id', userView);
router.post('/users', userStore);
router.patch('/users/:id', userUpdate);
router.delete('/users/:id', userDelete);

// ---- Nodes ----
router.get('/nodes/deployable', NodeDeploymentController);
router.get('/nodes', NodeController.index);
router.get('/nodes/:id', NodeController.view);
router.get('/nodes/:id/configuration', NodeConfigurationController);
router.get('/nodes/:id/system-information', NodeSystemInformationController);
router.post('/nodes/:id/deploy-token', NodeAutoDeployController);
router.post('/nodes', NodeController.store);
router.patch('/nodes/:id', NodeController.update);
router.delete('/nodes/:id', NodeController.remove);

// ---- Allocations (nested under nodes) ----
router.get('/nodes/:nodeId/allocations', AllocationController.index);
router.post('/nodes/:nodeId/allocations', AllocationController.store);
router.patch('/nodes/:nodeId/allocations/:id', AllocationController.updateAlias);
router.delete('/nodes/:nodeId/allocations', AllocationController.bulkRemove);
router.delete('/nodes/:nodeId/allocations/:id', AllocationController.remove);

// ---- Locations ----
router.get('/locations', LocationController.index);
router.get('/locations/:id', LocationController.view);
router.post('/locations', LocationController.store);
router.patch('/locations/:id', LocationController.update);
router.delete('/locations/:id', LocationController.remove);

// ---- Nodes (comments removed - wired above) ----
// GET    /nodes                          -> NodeController.index
// GET    /nodes/:id                      -> NodeController.view
// GET    /nodes/deployable               -> NodeDeploymentController
// GET    /nodes/:id/configuration        -> NodeConfigurationController
// POST   /nodes                          -> NodeController.store
// PATCH  /nodes/:id                      -> NodeController.update
// DELETE /nodes/:id                      -> NodeController.delete

// ---- Allocations (nested under nodes) ----
// GET    /nodes/:nodeId/allocations/:id  -> AllocationController.index
// POST   /nodes/:nodeId/allocations      -> AllocationController.store
// DELETE /nodes/:nodeId/allocations/:id  -> AllocationController.delete

// ---- Locations ----
// GET    /locations                      -> LocationController.index
// GET    /locations/:id                  -> LocationController.view
// POST   /locations                      -> LocationController.store
// PATCH  /locations/:id                  -> LocationController.update
// DELETE /locations/:id                  -> LocationController.delete

// ---- Servers ----
router.get('/servers', AppServerController.index);
router.get('/servers/external/:externalId', AppServerController.viewByExternalId);
router.get('/servers/:id', AppServerController.view);
router.post('/servers', AppServerController.store);
router.patch('/servers/:id/details', AppServerDetailsController.details);
router.patch('/servers/:id/build', AppServerDetailsController.build);
router.patch('/servers/:id/startup', AppStartupController.index);
router.post('/servers/:id/suspend', AppServerManagementController.suspend);
router.post('/servers/:id/unsuspend', AppServerManagementController.unsuspend);
router.post('/servers/:id/reinstall', AppServerManagementController.reinstall);
router.post('/servers/:id/toggle-install', AppServerManagementController.toggleInstall);
router.post('/servers/:id/transfer', serverTransfer);
router.delete('/servers/:id/force', AppServerController.deleteServer);
router.delete('/servers/:id', AppServerController.deleteServer);

// ---- Server Databases ----
router.get('/servers/:serverId/databases', databaseController.index);
router.get('/servers/:serverId/databases/:databaseId', databaseController.view);
router.post('/servers/:serverId/databases', databaseController.store);
router.post('/servers/:serverId/databases/:databaseId/reset-password', databaseController.resetPassword);
router.delete('/servers/:serverId/databases/:databaseId', databaseController.delete);

// ---- Application API Keys ----
router.get('/api-keys', ApiKeyController.index);
router.post('/api-keys', ApiKeyController.store);
router.delete('/api-keys/:identifier', ApiKeyController.remove);

// ---- Nests ----
router.get('/nests', nestController.index);
router.get('/nests/:id', nestController.view);
router.post('/nests', nestController.store);
router.patch('/nests/:id', nestController.update);
router.delete('/nests/:id', nestController.destroy);

// ---- Eggs (nested under nests) ----
router.get('/nests/:nestId/eggs', eggController.index);
router.get('/nests/:nestId/eggs/:eggId', eggController.view);
router.post('/nests/:nestId/eggs', eggController.store);
router.patch('/nests/:nestId/eggs/:eggId', eggController.update);
router.patch('/nests/:nestId/eggs/:eggId/script', eggController.updateScript);
router.delete('/nests/:nestId/eggs/:eggId', eggController.destroy);

// ---- Egg Import/Export ----
router.post('/nests/:nestId/eggs/import', eggController.importEgg);
router.put('/nests/:nestId/eggs/:eggId/import', eggController.updateImport);
router.get('/nests/:nestId/eggs/:eggId/export', eggController.exportEgg);

// ---- Database Hosts ----
router.get('/databases', DatabaseHostController.index);
router.get('/databases/:id', DatabaseHostController.view);
router.post('/databases', DatabaseHostController.store);
router.patch('/databases/:id', DatabaseHostController.update);
router.delete('/databases/:id', DatabaseHostController.remove);

// ---- Server Mounts ----
router.get('/servers/:serverId/mounts', async (req, res, next) => {
  try {
    const serverId = parseInt(req.params.serverId, 10);
    const { prisma } = await import('../prisma/client.js');
    const { fractal } = await import('../serializers/fractal.js');
    const { MountTransformer } = await import('../transformers/application/mountTransformer.js');

    const pivots = await prisma.mount_server.findMany({
      where: { server_id: serverId },
      include: { mounts: true },
    });

    const mounts = pivots.map((p: any) => p.mounts);
    const transformer = MountTransformer.fromRequest(req);
    const response = await fractal(req)
      .collection(mounts)
      .transformWith(transformer)
      .toArray();

    res.json(response);
  } catch (err) {
    next(err);
  }
});

router.post('/servers/:serverId/mounts/:mountId', async (req, res, next) => {
  try {
    const serverId = parseInt(req.params.serverId, 10);
    const mountId = parseInt(req.params.mountId, 10);
    const { prisma } = await import('../prisma/client.js');

    await prisma.mount_server.create({
      data: { server_id: serverId, mount_id: mountId },
    });

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.delete('/servers/:serverId/mounts/:mountId', async (req, res, next) => {
  try {
    const serverId = parseInt(req.params.serverId, 10);
    const mountId = parseInt(req.params.mountId, 10);
    const { prisma } = await import('../prisma/client.js');

    await prisma.mount_server.delete({
      where: {
        server_id_mount_id: { server_id: serverId, mount_id: mountId },
      },
    });

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ---- Settings ----
router.get('/settings', SettingsController.index);
router.patch('/settings', SettingsController.update);

// ---- Mounts ----
router.get('/mounts', MountController.index);
router.get('/mounts/:id', MountController.view);
router.post('/mounts', MountController.store);
router.patch('/mounts/:id', MountController.update);
router.delete('/mounts/:id', MountController.remove);
router.post('/mounts/:id/eggs', MountController.addEggs);
router.post('/mounts/:id/nodes', MountController.addNodes);
router.delete('/mounts/:id/eggs/:eggId', MountController.removeEgg);
router.delete('/mounts/:id/nodes/:nodeId', MountController.removeNode);

export default router;
