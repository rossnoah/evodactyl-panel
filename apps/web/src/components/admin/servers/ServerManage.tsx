import React, { useContext, useEffect, useState } from 'react';
import tw from 'twin.macro';
import FlashMessageRender from '@/components/FlashMessageRender';
import TitledGreyBox from '@/components/elements/TitledGreyBox';
import Button from '@/components/elements/Button';
import Label from '@/components/elements/Label';
import Select from '@/components/elements/Select';
import SpinnerOverlay from '@/components/elements/SpinnerOverlay';
import ConfirmationModal from '@/components/elements/ConfirmationModal';
import useFlash from '@/plugins/useFlash';
import {
    suspendServer, unsuspendServer, reinstallServer, toggleInstallStatus,
    transferServer, getNodes, getNodeAllocations,
    AdminNode, AdminAllocation,
} from '@/api/admin/servers';
import { AdminServerContext } from '@/components/admin/servers/ServerRouter';

const ServerManage = () => {
    const { server, setServer } = useContext(AdminServerContext);
    const { addFlash, clearFlashes, clearAndAddHttpError } = useFlash();

    const [suspendLoading, setSuspendLoading] = useState(false);
    const [reinstallLoading, setReinstallLoading] = useState(false);
    const [toggleLoading, setToggleLoading] = useState(false);
    const [showReinstallModal, setShowReinstallModal] = useState(false);

    // Transfer state
    const [showTransferModal, setShowTransferModal] = useState(false);
    const [transferLoading, setTransferLoading] = useState(false);
    const [nodes, setNodes] = useState<AdminNode[]>([]);
    const [selectedNode, setSelectedNode] = useState(0);
    const [nodeAllocations, setNodeAllocations] = useState<AdminAllocation[]>([]);
    const [selectedAllocation, setSelectedAllocation] = useState(0);

    const isInstalled = server.status === null;

    useEffect(() => {
        getNodes().then(setNodes).catch(() => {});
    }, []);

    useEffect(() => {
        if (selectedNode > 0) {
            getNodeAllocations(selectedNode).then((allocs) => {
                const unassigned = allocs.filter(a => !a.assigned);
                setNodeAllocations(unassigned);
                setSelectedAllocation(unassigned[0]?.id || 0);
            }).catch(() => setNodeAllocations([]));
        } else {
            setNodeAllocations([]);
            setSelectedAllocation(0);
        }
    }, [selectedNode]);

    const handleSuspendToggle = () => {
        clearFlashes('admin:server:manage');
        setSuspendLoading(true);

        const action = server.suspended ? unsuspendServer : suspendServer;
        action(server.id)
            .then(() => {
                setServer({ ...server, suspended: !server.suspended });
                addFlash({
                    key: 'admin:server:manage', type: 'success',
                    message: server.suspended ? 'Server has been unsuspended.' : 'Server has been suspended.',
                });
            })
            .catch((error) => clearAndAddHttpError({ key: 'admin:server:manage', error }))
            .finally(() => setSuspendLoading(false));
    };

    const handleReinstall = () => {
        clearFlashes('admin:server:manage');
        setReinstallLoading(true);
        setShowReinstallModal(false);

        reinstallServer(server.id)
            .then(() => addFlash({ key: 'admin:server:manage', type: 'success', message: 'Server reinstallation has been initiated.' }))
            .catch((error) => clearAndAddHttpError({ key: 'admin:server:manage', error }))
            .finally(() => setReinstallLoading(false));
    };

    const handleToggleInstall = () => {
        clearFlashes('admin:server:manage');
        setToggleLoading(true);

        toggleInstallStatus(server.id)
            .then(() => {
                const newStatus = server.status === null ? 'installing' : null;
                setServer({ ...server, status: newStatus });
                addFlash({ key: 'admin:server:manage', type: 'success', message: 'Server install status has been toggled.' });
            })
            .catch((error) => clearAndAddHttpError({ key: 'admin:server:manage', error }))
            .finally(() => setToggleLoading(false));
    };

    const handleTransfer = () => {
        if (!selectedNode || !selectedAllocation) return;
        clearFlashes('admin:server:manage');
        setTransferLoading(true);

        transferServer(server.id, {
            node_id: selectedNode,
            allocation_id: selectedAllocation,
        })
            .then(() => {
                addFlash({ key: 'admin:server:manage', type: 'success', message: 'Server transfer has been initiated.' });
                setShowTransferModal(false);
            })
            .catch((error) => clearAndAddHttpError({ key: 'admin:server:manage', error }))
            .finally(() => setTransferLoading(false));
    };

    const otherNodes = nodes.filter(n => n.id !== server.nodeId);

    return (
        <>
            <FlashMessageRender byKey={'admin:server:manage'} css={tw`mb-4`} />

            <ConfirmationModal
                visible={showReinstallModal}
                title={'Confirm Reinstallation'}
                buttonText={'Reinstall'}
                onConfirmed={handleReinstall}
                showSpinnerOverlay={reinstallLoading}
                onModalDismissed={() => setShowReinstallModal(false)}
            >
                This will reinstall the server with the assigned service scripts. This could overwrite server data.
            </ConfirmationModal>

            {/* Transfer Modal */}
            <ConfirmationModal
                visible={showTransferModal}
                title={'Transfer Server'}
                buttonText={'Transfer Server'}
                onConfirmed={handleTransfer}
                showSpinnerOverlay={transferLoading}
                onModalDismissed={() => setShowTransferModal(false)}
            >
                <div css={tw`mb-4`}>
                    <Label>Node</Label>
                    <Select
                        value={selectedNode}
                        onChange={(e) => setSelectedNode(Number(e.target.value))}
                    >
                        <option value={0}>Select a node...</option>
                        {otherNodes.map(n => (
                            <option key={n.id} value={n.id}>{n.name}</option>
                        ))}
                    </Select>
                </div>
                {selectedNode > 0 && (
                    <div css={tw`mb-4`}>
                        <Label>Default Allocation</Label>
                        <Select
                            value={selectedAllocation}
                            onChange={(e) => setSelectedAllocation(Number(e.target.value))}
                        >
                            <option value={0}>Select an allocation...</option>
                            {nodeAllocations.map(a => (
                                <option key={a.id} value={a.id}>
                                    {a.alias ? `${a.alias}:${a.port}` : `${a.ip}:${a.port}`}
                                </option>
                            ))}
                        </Select>
                    </div>
                )}
            </ConfirmationModal>

            <div css={tw`grid gap-6 md:grid-cols-3`}>
                {/* Reinstall Server */}
                <TitledGreyBox title={'Reinstall Server'} css={tw`relative`}>
                    <SpinnerOverlay visible={reinstallLoading} />
                    <p css={tw`text-sm text-neutral-300 mb-4`}>
                        This will reinstall the server with the assigned service scripts.
                        Danger! This could overwrite server data.
                    </p>
                    <Button
                        color={'red'}
                        size={'small'}
                        onClick={() => setShowReinstallModal(true)}
                        disabled={!isInstalled || reinstallLoading}
                    >
                        {isInstalled ? 'Reinstall Server' : 'Server Must Install Properly to Reinstall'}
                    </Button>
                </TitledGreyBox>

                {/* Toggle Install Status */}
                <TitledGreyBox title={'Install Status'} css={tw`relative`}>
                    <SpinnerOverlay visible={toggleLoading} />
                    <p css={tw`text-sm text-neutral-300 mb-4`}>
                        If you need to change the install status from uninstalled to installed, or vice versa,
                        you may do so with the button below.
                    </p>
                    <Button
                        color={'primary'}
                        size={'small'}
                        onClick={handleToggleInstall}
                        disabled={toggleLoading || server.status === 'install_failed'}
                    >
                        Toggle Install Status
                    </Button>
                </TitledGreyBox>

                {/* Suspend / Unsuspend */}
                <TitledGreyBox title={server.suspended ? 'Unsuspend Server' : 'Suspend Server'} css={tw`relative`}>
                    <SpinnerOverlay visible={suspendLoading} />
                    <p css={tw`text-sm text-neutral-300 mb-4`}>
                        {server.suspended
                            ? 'This will unsuspend the server and restore normal user access.'
                            : 'This will suspend the server, stop any running processes, and immediately block the user from being able to access their files or otherwise manage the server through the panel or API.'}
                    </p>
                    <Button
                        color={server.suspended ? 'green' : 'red'}
                        size={'small'}
                        onClick={handleSuspendToggle}
                        disabled={suspendLoading}
                    >
                        {server.suspended ? 'Unsuspend Server' : 'Suspend Server'}
                    </Button>
                </TitledGreyBox>
            </div>

            {/* Transfer Server */}
            <div css={tw`mt-6`}>
                <TitledGreyBox title={'Transfer Server'} css={tw`relative`}>
                    <p css={tw`text-sm text-neutral-300 mb-4`}>
                        Transfer this server to another node connected to this panel.
                        <span css={tw`text-yellow-400`}> Warning!</span> This feature has not been fully tested and may have bugs.
                    </p>
                    {otherNodes.length > 0 ? (
                        <Button
                            color={'green'}
                            size={'small'}
                            onClick={() => { setSelectedNode(0); setShowTransferModal(true); }}
                        >
                            Transfer Server
                        </Button>
                    ) : (
                        <Button color={'green'} size={'small'} disabled>
                            Transferring a server requires more than one node to be configured.
                        </Button>
                    )}
                </TitledGreyBox>
            </div>
        </>
    );
};

export default ServerManage;
