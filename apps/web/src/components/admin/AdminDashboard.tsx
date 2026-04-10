import React from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import AdminBox from '@/components/admin/AdminBox';
import tw from 'twin.macro';
import styled from 'styled-components';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faServer, faUsers, faMapMarkerAlt, faNetworkWired } from '@fortawesome/free-solid-svg-icons';
import useSWR from 'swr';
import http from '@/api/http';

const StatBox = styled.div<{ $bg: string }>`
    ${tw`rounded shadow-md p-5 flex items-center justify-between`};
    background: ${(props) => props.$bg};
`;

const StatIcon = styled.div`
    ${tw`text-4xl text-white opacity-40`};
`;

const StatValue = styled.div`
    ${tw`text-3xl font-bold text-white`};
`;

const StatLabel = styled.div`
    ${tw`text-sm text-white opacity-80 uppercase`};
`;

const fetchCount = (url: string): Promise<number> =>
    http.get(url, { params: { per_page: 1 } })
        .then(({ data }) => data.meta?.pagination?.total ?? data.data?.length ?? 0)
        .catch(() => 0);

export default () => {
    const { data: serverCount } = useSWR('admin:count:servers', () => fetchCount('/api/application/servers'));
    const { data: userCount } = useSWR('admin:count:users', () => fetchCount('/api/application/users'));
    const { data: locationCount } = useSWR('admin:count:locations', () => fetchCount('/api/application/locations'));
    const { data: nodeCount } = useSWR('admin:count:nodes', () => fetchCount('/api/application/nodes'));
    const { data: systemInfo } = useSWR<{ version: string; runtime: string; environment: string }>(
        'admin:system-info',
        () => http.get('/api/application/system-info').then(({ data }) => data),
    );

    return (
        <AdminLayout
            title={'Administration'}
            subtitle={'Quick overview of your system.'}
            breadcrumbs={[
                { label: 'Admin', to: '/admin' },
                { label: 'Overview' },
            ]}
        >
            <div css={tw`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6`}>
                <StatBox $bg={'#00a65a'}>
                    <div>
                        <StatValue>{serverCount ?? 0}</StatValue>
                        <StatLabel>Servers</StatLabel>
                    </div>
                    <StatIcon><FontAwesomeIcon icon={faServer} /></StatIcon>
                </StatBox>
                <StatBox $bg={'#0073b7'}>
                    <div>
                        <StatValue>{userCount ?? 0}</StatValue>
                        <StatLabel>Users</StatLabel>
                    </div>
                    <StatIcon><FontAwesomeIcon icon={faUsers} /></StatIcon>
                </StatBox>
                <StatBox $bg={'#f39c12'}>
                    <div>
                        <StatValue>{locationCount ?? 0}</StatValue>
                        <StatLabel>Locations</StatLabel>
                    </div>
                    <StatIcon><FontAwesomeIcon icon={faMapMarkerAlt} /></StatIcon>
                </StatBox>
                <StatBox $bg={'#dd4b39'}>
                    <div>
                        <StatValue>{nodeCount ?? 0}</StatValue>
                        <StatLabel>Nodes</StatLabel>
                    </div>
                    <StatIcon><FontAwesomeIcon icon={faNetworkWired} /></StatIcon>
                </StatBox>
            </div>

            <div css={tw`grid grid-cols-1 lg:grid-cols-2 gap-4`}>
                <AdminBox title={'System Information'}>
                    <div css={tw`text-sm text-neutral-300`}>
                        <div css={tw`flex justify-between py-2 border-b border-neutral-600`}>
                            <span>Panel Version</span>
                            <span css={tw`text-neutral-100`}>{systemInfo?.version ?? '...'}</span>
                        </div>
                        <div css={tw`flex justify-between py-2 border-b border-neutral-600`}>
                            <span>Runtime</span>
                            <span css={tw`text-neutral-100`}>{systemInfo?.runtime ?? '...'}</span>
                        </div>
                        <div css={tw`flex justify-between py-2`}>
                            <span>Environment</span>
                            <span css={tw`text-neutral-100`}>{systemInfo?.environment ?? '...'}</span>
                        </div>
                    </div>
                </AdminBox>
                <AdminBox title={'Quick Links'}>
                    <div css={tw`flex flex-col gap-3`}>
                        <a
                            href={'https://pterodactyl.io/panel/1.0/getting_started.html'}
                            target={'_blank'}
                            rel={'noopener noreferrer'}
                            css={tw`text-sm text-primary-400 hover:text-primary-300 no-underline`}
                        >
                            Documentation
                        </a>
                        <a
                            href={'https://github.com/pterodactyl/panel'}
                            target={'_blank'}
                            rel={'noopener noreferrer'}
                            css={tw`text-sm text-primary-400 hover:text-primary-300 no-underline`}
                        >
                            GitHub Repository
                        </a>
                        <a
                            href={'https://discord.gg/pterodactyl'}
                            target={'_blank'}
                            rel={'noopener noreferrer'}
                            css={tw`text-sm text-primary-400 hover:text-primary-300 no-underline`}
                        >
                            Discord Community
                        </a>
                    </div>
                </AdminBox>
            </div>
        </AdminLayout>
    );
};
