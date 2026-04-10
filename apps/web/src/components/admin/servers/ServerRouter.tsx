import React, { useEffect, useState } from 'react';
import { NavLink, Route, Switch, useParams, useRouteMatch } from 'react-router-dom';
import tw from 'twin.macro';
import styled from 'styled-components';
import { AdminServer, getServer } from '@/api/admin/servers';
import Spinner from '@/components/elements/Spinner';
import { ServerError } from '@/components/elements/ScreenBlock';
import { httpErrorToHuman } from '@/api/http';
import ServerAbout from '@/components/admin/servers/ServerAbout';
import ServerDetailsEdit from '@/components/admin/servers/ServerDetailsEdit';
import ServerBuildEdit from '@/components/admin/servers/ServerBuildEdit';
import ServerStartupEdit from '@/components/admin/servers/ServerStartupEdit';
import ServerManage from '@/components/admin/servers/ServerManage';
import ServerDatabases from '@/components/admin/servers/ServerDatabases';
import ServerMounts from '@/components/admin/servers/ServerMounts';
import ServerDelete from '@/components/admin/servers/ServerDelete';
import AdminLayout from '@/components/admin/AdminLayout';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExternalLinkAlt } from '@fortawesome/free-solid-svg-icons';

export const AdminServerContext = React.createContext<{
    server: AdminServer;
    setServer: (server: AdminServer) => void;
}>({
    server: null as unknown as AdminServer,
    setServer: () => undefined,
});

const TabNav = styled.div`
    ${tw`flex border-b border-neutral-600 mb-4 flex-wrap`};

    & a {
        ${tw`px-4 py-2.5 text-sm font-medium no-underline transition-colors duration-100 border-b-2`};
        ${tw`text-neutral-400 border-transparent hover:text-neutral-200`};
    }

    & a.active {
        ${tw`text-neutral-100 border-cyan-500`};
    }
`;

const DangerTab = styled(NavLink)`
    && {
        ${tw`text-red-400 hover:text-red-300`};
    }
    &&.active {
        ${tw`text-red-300 border-red-500`};
    }
`;

const ExternalTab = styled.a`
    && {
        ${tw`px-4 py-2.5 text-sm font-medium no-underline transition-colors duration-100 border-b-2`};
        ${tw`text-green-400 border-transparent hover:text-green-300`};
    }
`;

const ServerRouter = () => {
    const { id } = useParams<{ id: string }>();
    const match = useRouteMatch();
    const [server, setServer] = useState<AdminServer | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        setError('');
        setServer(null);
        getServer(Number(id), ['user', 'node', 'allocations', 'nest', 'egg'])
            .then(setServer)
            .catch((err) => setError(httpErrorToHuman(err)));
    }, [id]);

    const isInstalled = server?.status === null;

    return (
        <AdminServerContext.Provider value={{ server: server!, setServer }}>
            <AdminLayout
                title={server?.name || 'Server'}
                subtitle={server ? `Manage server ${server.name}.` : 'Loading server...'}
                breadcrumbs={[
                    { label: 'Admin', to: '/admin' },
                    { label: 'Servers', to: '/admin/servers' },
                    { label: server?.name || '...' },
                ]}
            >
                {error ? <ServerError message={error} /> :
                !server ? <Spinner size={'large'} centered /> : (<>
                <TabNav>
                    <NavLink to={`${match.url}`} exact>About</NavLink>
                    {isInstalled && <NavLink to={`${match.url}/details`}>Details</NavLink>}
                    {isInstalled && <NavLink to={`${match.url}/build`}>Build Configuration</NavLink>}
                    {isInstalled && <NavLink to={`${match.url}/startup`}>Startup</NavLink>}
                    {isInstalled && <NavLink to={`${match.url}/databases`}>Database</NavLink>}
                    {isInstalled && <NavLink to={`${match.url}/mounts`}>Mounts</NavLink>}
                    <NavLink to={`${match.url}/manage`}>Manage</NavLink>
                    <DangerTab to={`${match.url}/delete`}>Delete</DangerTab>
                    <ExternalTab href={`/server/${server.identifier}`} target={'_blank'} rel={'noopener noreferrer'}>
                        <FontAwesomeIcon icon={faExternalLinkAlt} />
                    </ExternalTab>
                </TabNav>
                <Switch>
                    <Route path={`${match.path}`} exact><ServerAbout /></Route>
                    <Route path={`${match.path}/details`} exact><ServerDetailsEdit /></Route>
                    <Route path={`${match.path}/build`} exact><ServerBuildEdit /></Route>
                    <Route path={`${match.path}/startup`} exact><ServerStartupEdit /></Route>
                    <Route path={`${match.path}/databases`} exact><ServerDatabases /></Route>
                    <Route path={`${match.path}/mounts`} exact><ServerMounts /></Route>
                    <Route path={`${match.path}/manage`} exact><ServerManage /></Route>
                    <Route path={`${match.path}/delete`} exact><ServerDelete /></Route>
                </Switch>
                </>)}
            </AdminLayout>
        </AdminServerContext.Provider>
    );
};

export default ServerRouter;
