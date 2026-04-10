import React, { useContext, useState } from 'react';
import { useHistory } from 'react-router-dom';
import tw from 'twin.macro';
import FlashMessageRender from '@/components/FlashMessageRender';
import Button from '@/components/elements/Button';
import SpinnerOverlay from '@/components/elements/SpinnerOverlay';
import ConfirmationModal from '@/components/elements/ConfirmationModal';
import useFlash from '@/plugins/useFlash';
import { deleteServer } from '@/api/admin/servers';
import { AdminServerContext } from '@/components/admin/servers/ServerRouter';

const ServerDelete = () => {
    const history = useHistory();
    const { server } = useContext(AdminServerContext);
    const { addFlash, clearFlashes, clearAndAddHttpError } = useFlash();

    const [showSafeModal, setShowSafeModal] = useState(false);
    const [showForceModal, setShowForceModal] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const handleDelete = (force: boolean) => {
        setDeleting(true);
        clearFlashes('admin:server:delete');

        deleteServer(server.id, force)
            .then(() => {
                addFlash({ key: 'admin:servers', type: 'success', message: 'Server has been deleted.' });
                history.push('/admin/servers');
            })
            .catch((error) => {
                setDeleting(false);
                setShowSafeModal(false);
                setShowForceModal(false);
                clearAndAddHttpError({ key: 'admin:server:delete', error });
            });
    };

    return (
        <>
            <FlashMessageRender byKey={'admin:server:delete'} css={tw`mb-4`} />

            <ConfirmationModal
                visible={showSafeModal}
                title={'Delete Server'}
                buttonText={'Delete'}
                onConfirmed={() => handleDelete(false)}
                showSpinnerOverlay={deleting}
                onModalDismissed={() => setShowSafeModal(false)}
            >
                Are you sure that you want to delete this server? There is no going back, all data will immediately be removed.
            </ConfirmationModal>

            <ConfirmationModal
                visible={showForceModal}
                title={'Force Delete Server'}
                buttonText={'Force Delete'}
                onConfirmed={() => handleDelete(true)}
                showSpinnerOverlay={deleting}
                onModalDismissed={() => setShowForceModal(false)}
            >
                Are you sure that you want to force delete this server? If the daemon reports an error, the deletion will continue anyway.
                This may leave orphaned files on the node.
            </ConfirmationModal>

            <div css={tw`grid grid-cols-1 md:grid-cols-2 gap-6`}>
                {/* Safe Delete */}
                <div css={tw`bg-neutral-700 rounded shadow-md relative`}>
                    <SpinnerOverlay visible={deleting} />
                    <div css={tw`px-6 py-4 border-b border-neutral-600`}>
                        <h3 css={tw`text-lg font-medium`}>Safely Delete Server</h3>
                    </div>
                    <div css={tw`px-6 py-4`}>
                        <p css={tw`text-sm text-neutral-300 mb-3`}>
                            This action will attempt to delete the server from both the panel and daemon.
                            If either one reports an error the action will be cancelled.
                        </p>
                        <p css={tw`text-sm text-red-400`}>
                            Deleting a server is an irreversible action. <strong>All server data</strong> (including files and users)
                            will be removed from the system.
                        </p>
                    </div>
                    <div css={tw`px-6 py-3 flex justify-end`}>
                        <Button color={'red'} onClick={() => setShowSafeModal(true)}>
                            Safely Delete This Server
                        </Button>
                    </div>
                </div>

                {/* Force Delete */}
                <div css={tw`bg-neutral-700 rounded shadow-md border-t-4 border-red-500 relative`}>
                    <SpinnerOverlay visible={deleting} />
                    <div css={tw`px-6 py-4 border-b border-neutral-600`}>
                        <h3 css={tw`text-lg font-medium`}>Force Delete Server</h3>
                    </div>
                    <div css={tw`px-6 py-4`}>
                        <p css={tw`text-sm text-neutral-300 mb-3`}>
                            This action will attempt to delete the server from both the panel and daemon.
                            If the daemon does not respond, or reports an error the deletion will continue.
                        </p>
                        <p css={tw`text-sm text-red-400`}>
                            Deleting a server is an irreversible action. <strong>All server data</strong> (including files and users)
                            will be removed from the system. This method may leave dangling files on your daemon if it reports an error.
                        </p>
                    </div>
                    <div css={tw`px-6 py-3 flex justify-end`}>
                        <Button color={'red'} onClick={() => setShowForceModal(true)}>
                            Forcibly Delete This Server
                        </Button>
                    </div>
                </div>
            </div>
        </>
    );
};

export default ServerDelete;
