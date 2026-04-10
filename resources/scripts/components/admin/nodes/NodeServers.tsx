import React from 'react';
import { Link } from 'react-router-dom';
import tw from 'twin.macro';
import { Node } from '@/api/admin/nodes';
import AdminBox from '@/components/admin/AdminBox';
import { AdminTable, AdminTableHead, AdminTableBody, AdminTableHeader, AdminTableRow, AdminTableCell } from '@/components/admin/AdminTable';

interface Props {
    node: Node;
}

const NodeServers = ({ node }: Props) => {
    const servers = node.servers || [];

    return (
        <AdminBox title={'Server List'} noPadding>
            {servers.length > 0 ? (
                <AdminTable>
                    <AdminTableHead>
                        <tr>
                            <AdminTableHeader>ID</AdminTableHeader>
                            <AdminTableHeader>Server Name</AdminTableHeader>
                            <AdminTableHeader>Owner</AdminTableHeader>
                            <AdminTableHeader>Service</AdminTableHeader>
                        </tr>
                    </AdminTableHead>
                    <AdminTableBody>
                        {servers.map((server) => (
                            <AdminTableRow key={server.id}>
                                <AdminTableCell>
                                    <code css={tw`bg-neutral-800 px-2 py-0.5 rounded text-xs`}>
                                        {server.identifier || server.uuid.substring(0, 8)}
                                    </code>
                                </AdminTableCell>
                                <AdminTableCell>
                                    <Link to={`/admin/servers/${server.id}`} css={tw`text-primary-400 hover:text-primary-300`}>
                                        {server.name}
                                    </Link>
                                </AdminTableCell>
                                <AdminTableCell>
                                    {server.owner ? (
                                        <Link to={`/admin/users/${server.owner.id}`} css={tw`text-primary-400 hover:text-primary-300`}>
                                            {server.owner.username}
                                        </Link>
                                    ) : (
                                        <span css={tw`text-neutral-500`}>&mdash;</span>
                                    )}
                                </AdminTableCell>
                                <AdminTableCell>
                                    {server.nest && server.egg
                                        ? `${server.nest.name} (${server.egg.name})`
                                        : <span css={tw`text-neutral-500`}>&mdash;</span>
                                    }
                                </AdminTableCell>
                            </AdminTableRow>
                        ))}
                    </AdminTableBody>
                </AdminTable>
            ) : (
                <p css={tw`text-center text-sm text-neutral-400 py-6`}>
                    There are no servers on this node.
                </p>
            )}
        </AdminBox>
    );
};

export default NodeServers;
