import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import useSWR from 'swr';
import tw from 'twin.macro';
import { AdminServer, getServers } from '@/api/admin/servers';
import { PaginatedResult } from '@/api/http';
import Spinner from '@/components/elements/Spinner';
import Pagination from '@/components/elements/Pagination';
import useFlash from '@/plugins/useFlash';
import Button from '@/components/elements/Button';
import AdminLayout from '@/components/admin/AdminLayout';
import AdminBox from '@/components/admin/AdminBox';
import AdminStatusBadge from '@/components/admin/AdminStatusBadge';
import { AdminTable, AdminTableHead, AdminTableBody, AdminTableHeader, AdminTableRow, AdminTableCell } from '@/components/admin/AdminTable';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExternalLinkAlt } from '@fortawesome/free-solid-svg-icons';

function getStatusBadge(server: AdminServer) {
    if (server.suspended) {
        return <AdminStatusBadge $color={'maroon'}>Suspended</AdminStatusBadge>;
    }
    if (server.status === 'installing') {
        return <AdminStatusBadge $color={'yellow'}>Installing</AdminStatusBadge>;
    }
    return <AdminStatusBadge $color={'green'}>Active</AdminStatusBadge>;
}

const ServersContainer = () => {
    const { search } = useLocation();
    const defaultPage = Number(new URLSearchParams(search).get('page') || '1');
    const [page, setPage] = useState(!isNaN(defaultPage) && defaultPage > 0 ? defaultPage : 1);
    const [searchFilter, setSearchFilter] = useState('');
    const { clearFlashes, clearAndAddHttpError } = useFlash();

    const { data: servers, error } = useSWR<PaginatedResult<AdminServer>>(
        ['/api/application/servers', page, searchFilter],
        () => getServers(
            { page, filters: searchFilter ? { name: searchFilter } : undefined },
            ['user', 'node', 'allocations']
        )
    );

    useEffect(() => {
        if (!servers) return;
        if (servers.pagination.currentPage > 1 && !servers.items.length) setPage(1);
    }, [servers?.pagination.currentPage]);

    useEffect(() => {
        window.history.replaceState(null, document.title, `/admin/servers${page <= 1 ? '' : `?page=${page}`}`);
    }, [page]);

    useEffect(() => {
        if (error) clearAndAddHttpError({ key: 'admin:servers', error });
        if (!error) clearFlashes('admin:servers');
    }, [error]);

    const searchTools = (
        <div css={tw`flex items-center gap-2`}>
            <input
                type={'text'}
                placeholder={'Search Servers'}
                value={searchFilter}
                onChange={(e) => { setSearchFilter(e.target.value); setPage(1); }}
                css={tw`bg-neutral-600 border border-neutral-500 rounded px-3 py-1.5 text-sm text-neutral-200 outline-none focus:border-primary-400`}
            />
            <Link to={'/admin/servers/new'}>
                <Button color={'primary'} size={'xsmall'}>Create New</Button>
            </Link>
        </div>
    );

    return (
        <AdminLayout
            title={'Servers'}
            subtitle={'All servers available on the system.'}
            showFlashKey={'admin:servers'}
            breadcrumbs={[
                { label: 'Admin', to: '/admin' },
                { label: 'Servers' },
            ]}
        >
            {!servers ? (
                <Spinner centered size={'large'} />
            ) : (
                <Pagination data={servers} onPageSelect={setPage}>
                    {({ items }) => (
                        <AdminBox title={'Server List'} tools={searchTools} noPadding>
                            {items.length > 0 ? (
                                <AdminTable>
                                    <AdminTableHead>
                                        <tr>
                                            <AdminTableHeader>Server Name</AdminTableHeader>
                                            <AdminTableHeader>UUID</AdminTableHeader>
                                            <AdminTableHeader>Owner</AdminTableHeader>
                                            <AdminTableHeader>Node</AdminTableHeader>
                                            <AdminTableHeader>Connection</AdminTableHeader>
                                            <AdminTableHeader className={'text-center'}>Status</AdminTableHeader>
                                            <AdminTableHeader></AdminTableHeader>
                                        </tr>
                                    </AdminTableHead>
                                    <AdminTableBody>
                                        {items.map((server) => (
                                            <AdminTableRow key={server.id}>
                                                <AdminTableCell>
                                                    <Link to={`/admin/servers/${server.id}`}>{server.name}</Link>
                                                </AdminTableCell>
                                                <AdminTableCell><code>{server.identifier}</code></AdminTableCell>
                                                <AdminTableCell>
                                                    {server.user ? (
                                                        <Link to={`/admin/users/${server.userId}`}>{server.user.username}</Link>
                                                    ) : `User #${server.userId}`}
                                                </AdminTableCell>
                                                <AdminTableCell>
                                                    {server.node ? (
                                                        <Link to={`/admin/nodes/${server.nodeId}`}>{server.node.name}</Link>
                                                    ) : `Node #${server.nodeId}`}
                                                </AdminTableCell>
                                                <AdminTableCell>
                                                    <code>
                                                        {server.allocation
                                                            ? `${server.allocation.alias || server.allocation.ip}:${server.allocation.port}`
                                                            : 'N/A'}
                                                    </code>
                                                </AdminTableCell>
                                                <AdminTableCell className={'text-center'}>
                                                    {getStatusBadge(server)}
                                                </AdminTableCell>
                                                <AdminTableCell className={'text-center'}>
                                                    <a
                                                        href={`/server/${server.identifier}`}
                                                        target={'_blank'}
                                                        rel={'noopener noreferrer'}
                                                        css={tw`text-neutral-400 hover:text-neutral-200`}
                                                        title={'Open server console'}
                                                    >
                                                        <FontAwesomeIcon icon={faExternalLinkAlt} />
                                                    </a>
                                                </AdminTableCell>
                                            </AdminTableRow>
                                        ))}
                                    </AdminTableBody>
                                </AdminTable>
                            ) : (
                                <p css={tw`text-center text-sm text-neutral-400 py-6`}>No servers were found.</p>
                            )}
                        </AdminBox>
                    )}
                </Pagination>
            )}
        </AdminLayout>
    );
};

export default ServersContainer;
