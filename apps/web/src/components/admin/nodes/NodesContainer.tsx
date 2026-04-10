import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye, faEyeSlash, faLock, faUnlock, faWrench } from '@fortawesome/free-solid-svg-icons';
import tw from 'twin.macro';
import useSWR from 'swr';
import { getNodes, Node } from '@/api/admin/nodes';
import { PaginatedResult } from '@/api/http';
import Spinner from '@/components/elements/Spinner';
import Pagination from '@/components/elements/Pagination';
import useFlash from '@/plugins/useFlash';
import Button from '@/components/elements/Button';
import AdminLayout from '@/components/admin/AdminLayout';
import AdminBox from '@/components/admin/AdminBox';
import AdminStatusBadge from '@/components/admin/AdminStatusBadge';
import { AdminTable, AdminTableHead, AdminTableBody, AdminTableHeader, AdminTableRow, AdminTableCell } from '@/components/admin/AdminTable';
import NodeHeartbeat from '@/components/admin/nodes/NodeHeartbeat';

const NodesContainer = () => {
    const [page, setPage] = useState(1);
    const [filter, setFilter] = useState('');
    const { clearFlashes, clearAndAddHttpError } = useFlash();

    const { data: nodes, error } = useSWR<PaginatedResult<Node>>(
        ['/api/application/nodes', page, filter],
        () => getNodes(page, filter || undefined)
    );

    useEffect(() => {
        if (error) clearAndAddHttpError({ key: 'admin:nodes', error });
        if (!error) clearFlashes('admin:nodes');
    }, [error]);

    const tools = (
        <div css={tw`flex items-center gap-2`}>
            <input
                type={'text'}
                placeholder={'Filter nodes...'}
                value={filter}
                onChange={(e) => { setFilter(e.target.value); setPage(1); }}
                css={tw`bg-neutral-600 border border-neutral-500 rounded px-3 py-1.5 text-sm text-neutral-200 outline-none focus:border-primary-400`}
            />
            <Link to={'/admin/nodes/new'}>
                <Button color={'primary'} size={'xsmall'}>Create New</Button>
            </Link>
        </div>
    );

    return (
        <AdminLayout
            title={'Nodes'}
            subtitle={'All nodes available on the system.'}
            showFlashKey={'admin:nodes'}
            breadcrumbs={[
                { label: 'Admin', to: '/admin' },
                { label: 'Nodes' },
            ]}
        >
            {!nodes ? (
                <Spinner centered size={'large'} />
            ) : (
                <Pagination data={nodes} onPageSelect={setPage}>
                    {({ items }) => (
                        <AdminBox title={'Node List'} tools={tools} noPadding>
                            {items.length > 0 ? (
                                <AdminTable>
                                    <AdminTableHead>
                                        <tr>
                                            <AdminTableHeader className={'text-center'} css={tw`w-12`}></AdminTableHeader>
                                            <AdminTableHeader>Name</AdminTableHeader>
                                            <AdminTableHeader>Location</AdminTableHeader>
                                            <AdminTableHeader className={'text-center'}>Memory</AdminTableHeader>
                                            <AdminTableHeader className={'text-center'}>Disk</AdminTableHeader>
                                            <AdminTableHeader className={'text-center'}>Servers</AdminTableHeader>
                                            <AdminTableHeader className={'text-center'}>SSL</AdminTableHeader>
                                            <AdminTableHeader className={'text-center'}>Public</AdminTableHeader>
                                        </tr>
                                    </AdminTableHead>
                                    <AdminTableBody>
                                        {items.map((node) => (
                                            <AdminTableRow key={node.id}>
                                                <AdminTableCell className={'text-center'}>
                                                    <NodeHeartbeat nodeId={node.id} />
                                                </AdminTableCell>
                                                <AdminTableCell>
                                                    {node.maintenanceMode && (
                                                        <AdminStatusBadge $color={'yellow'} css={tw`mr-2`}>
                                                            <FontAwesomeIcon icon={faWrench} />
                                                        </AdminStatusBadge>
                                                    )}
                                                    <Link to={`/admin/nodes/${node.id}`}>{node.name}</Link>
                                                </AdminTableCell>
                                                <AdminTableCell>
                                                    {node.location?.short || `Location ${node.locationId}`}
                                                </AdminTableCell>
                                                <AdminTableCell className={'text-center'}>
                                                    {node.allocatedMemory ?? 0} / {node.memory} MiB
                                                </AdminTableCell>
                                                <AdminTableCell className={'text-center'}>
                                                    {node.allocatedDisk ?? 0} / {node.disk} MiB
                                                </AdminTableCell>
                                                <AdminTableCell className={'text-center'}>
                                                    {node.servers?.length ?? 0}
                                                </AdminTableCell>
                                                <AdminTableCell className={'text-center'}>
                                                    <FontAwesomeIcon
                                                        icon={node.scheme === 'https' ? faLock : faUnlock}
                                                        css={node.scheme === 'https' ? tw`text-green-500` : tw`text-red-500`}
                                                    />
                                                </AdminTableCell>
                                                <AdminTableCell className={'text-center'}>
                                                    <FontAwesomeIcon
                                                        icon={node.public ? faEye : faEyeSlash}
                                                        css={tw`text-neutral-400`}
                                                    />
                                                </AdminTableCell>
                                            </AdminTableRow>
                                        ))}
                                    </AdminTableBody>
                                </AdminTable>
                            ) : (
                                <p css={tw`text-center text-sm text-neutral-400 py-6`}>No nodes have been configured.</p>
                            )}
                        </AdminBox>
                    )}
                </Pagination>
            )}
        </AdminLayout>
    );
};

export default NodesContainer;
