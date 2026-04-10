import React, { useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import tw from 'twin.macro';
import useSWR from 'swr';
import { Node, deleteNode, getNodeSystemInfo, DaemonInfo } from '@/api/admin/nodes';
import FlashMessageRender from '@/components/FlashMessageRender';
import AdminBox from '@/components/admin/AdminBox';
import Button from '@/components/elements/Button';
import ConfirmationModal from '@/components/elements/ConfirmationModal';
import useFlash from '@/plugins/useFlash';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faWrench } from '@fortawesome/free-solid-svg-icons';

interface Props {
    node: Node;
}

const ProgressBar = ({ label, current, max, overallocate }: { label: string; current: number; max: number; overallocate: number }) => {
    const effectiveMax = overallocate === -1 ? Infinity : overallocate > 0 ? max * (1 + overallocate / 100) : max;
    const percentage = effectiveMax === Infinity ? 0 : effectiveMax > 0 ? Math.min((current / effectiveMax) * 100, 100) : 0;
    const color = percentage > 90 ? 'bg-red-500' : percentage > 75 ? 'bg-yellow-500' : 'bg-green-500';

    return (
        <div css={tw`mb-4`}>
            <div css={tw`flex justify-between text-sm mb-1`}>
                <span>{label}</span>
                <span css={tw`text-neutral-400`}>
                    {current.toLocaleString()} / {effectiveMax === Infinity ? '\u221E' : effectiveMax.toLocaleString()} MiB
                    {effectiveMax !== Infinity && ` (${percentage.toFixed(1)}%)`}
                </span>
            </div>
            <div css={tw`w-full bg-neutral-600 rounded-full h-3`}>
                <div
                    className={color}
                    css={tw`h-3 rounded-full transition-all duration-300`}
                    style={{ width: `${percentage}%` }}
                />
            </div>
        </div>
    );
};

const InfoRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <tr css={tw`border-b border-neutral-600 last:border-b-0`}>
        <td css={tw`py-2 pr-4 text-neutral-400 whitespace-nowrap`}>{label}</td>
        <td css={tw`py-2`}>{children}</td>
    </tr>
);

const NodeAbout = ({ node }: Props) => {
    const history = useHistory();
    const { addFlash, clearFlashes, clearAndAddHttpError } = useFlash();
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const { data: daemonInfo, error: daemonError } = useSWR<DaemonInfo>(
        `/api/application/nodes/${node.id}/system-information`,
        () => getNodeSystemInfo(node.id),
        { refreshInterval: 10000, revalidateOnFocus: false, shouldRetryOnError: false }
    );

    const handleDelete = () => {
        setDeleting(true);
        clearFlashes('admin:node');

        deleteNode(node.id)
            .then(() => {
                addFlash({ key: 'admin:nodes', type: 'success', message: 'Node has been deleted.' });
                history.push('/admin/nodes');
            })
            .catch((error) => {
                setDeleting(false);
                setShowDeleteModal(false);
                clearAndAddHttpError({ key: 'admin:node', error });
            });
    };

    const serverCount = node.servers?.length ?? 0;

    return (
        <>
            <FlashMessageRender byKey={'admin:node'} css={tw`mb-4`} />
            <ConfirmationModal
                visible={showDeleteModal}
                title={'Delete Node'}
                buttonText={'Yes, Delete'}
                onConfirmed={handleDelete}
                showSpinnerOverlay={deleting}
                onModalDismissed={() => setShowDeleteModal(false)}
            >
                Are you sure you want to delete this node? This action cannot be undone and any servers on this node must
                be removed first.
            </ConfirmationModal>

            <div css={tw`grid grid-cols-1 lg:grid-cols-3 gap-6`}>
                {/* Left column */}
                <div css={tw`lg:col-span-2`}>
                    {/* Daemon Information */}
                    <AdminBox title={'Information'} css={tw`mb-6`}>
                        <table css={tw`w-full text-sm`}>
                            <tbody>
                                <InfoRow label={'Daemon Version'}>
                                    {daemonError ? (
                                        <span css={tw`text-red-400`}>Error connecting to daemon</span>
                                    ) : !daemonInfo ? (
                                        <FontAwesomeIcon icon={faSpinner} spin css={tw`text-neutral-400`} />
                                    ) : (
                                        <code css={tw`bg-neutral-800 px-2 py-0.5 rounded text-sm`}>{daemonInfo.version}</code>
                                    )}
                                </InfoRow>
                                <InfoRow label={'System Information'}>
                                    {daemonError ? (
                                        <span css={tw`text-neutral-500`}>&mdash;</span>
                                    ) : !daemonInfo ? (
                                        <FontAwesomeIcon icon={faSpinner} spin css={tw`text-neutral-400`} />
                                    ) : (
                                        <>
                                            {daemonInfo.system.type} ({daemonInfo.system.arch}){' '}
                                            <code css={tw`bg-neutral-800 px-2 py-0.5 rounded text-sm`}>{daemonInfo.system.release}</code>
                                        </>
                                    )}
                                </InfoRow>
                                <InfoRow label={'Total CPU Threads'}>
                                    {daemonError ? (
                                        <span css={tw`text-neutral-500`}>&mdash;</span>
                                    ) : !daemonInfo ? (
                                        <FontAwesomeIcon icon={faSpinner} spin css={tw`text-neutral-400`} />
                                    ) : (
                                        daemonInfo.system.cpus
                                    )}
                                </InfoRow>
                            </tbody>
                        </table>
                    </AdminBox>

                    {/* Description */}
                    {node.description && (
                        <AdminBox title={'Description'} css={tw`mb-6`}>
                            <pre css={tw`text-sm text-neutral-300 whitespace-pre-wrap`}>{node.description}</pre>
                        </AdminBox>
                    )}

                    {/* Delete Node */}
                    <div css={tw`bg-neutral-700 rounded shadow-md border-t-4 border-red-500`}>
                        <div css={tw`px-6 py-4 border-b border-neutral-600`}>
                            <h3 css={tw`text-lg font-medium`}>Delete Node</h3>
                        </div>
                        <div css={tw`px-6 py-4`}>
                            <p css={tw`text-sm text-neutral-300`}>
                                Deleting a node is an irreversible action and will immediately remove this node from the panel.
                                There must be no servers associated with this node in order to continue.
                            </p>
                        </div>
                        <div css={tw`px-6 py-3 bg-neutral-700 flex justify-end`}>
                            <Button
                                color={'red'}
                                size={'small'}
                                disabled={serverCount > 0}
                                onClick={() => setShowDeleteModal(true)}
                            >
                                Yes, Delete This Node
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Right sidebar — At-a-Glance */}
                <div>
                    <AdminBox title={'At-a-Glance'}>
                        {/* Maintenance mode warning */}
                        {node.maintenanceMode && (
                            <div css={tw`bg-yellow-600 rounded p-4 mb-4 flex items-center`}>
                                <FontAwesomeIcon icon={faWrench} css={tw`mr-3 text-lg`} />
                                <div>
                                    <p css={tw`text-sm`}>This node is under</p>
                                    <p css={tw`text-lg font-bold`}>Maintenance</p>
                                </div>
                            </div>
                        )}

                        {/* Disk Space */}
                        <ProgressBar
                            label={'Disk Space Allocated'}
                            current={node.allocatedDisk ?? 0}
                            max={node.disk}
                            overallocate={node.diskOverallocate}
                        />

                        {/* Memory */}
                        <ProgressBar
                            label={'Memory Allocated'}
                            current={node.allocatedMemory ?? 0}
                            max={node.memory}
                            overallocate={node.memoryOverallocate}
                        />

                        {/* Total Servers */}
                        <div css={tw`bg-cyan-700 rounded p-4 flex items-center`}>
                            <div css={tw`mr-3 text-2xl`}>{serverCount}</div>
                            <div css={tw`text-sm`}>Total Servers</div>
                        </div>
                    </AdminBox>
                </div>
            </div>
        </>
    );
};

export default NodeAbout;
