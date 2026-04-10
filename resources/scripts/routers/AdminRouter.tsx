import React from 'react';
import { Route, Switch, Redirect } from 'react-router-dom';
import { useLocation } from 'react-router';
import { useStoreState } from 'easy-peasy';
import { ApplicationStore } from '@/state';
import AdminDashboard from '@/components/admin/AdminDashboard';
import SettingsContainer from '@/components/admin/settings/SettingsContainer';
import UsersContainer from '@/components/admin/users/UsersContainer';
import UserEditContainer from '@/components/admin/users/UserEditContainer';
import NewUserContainer from '@/components/admin/users/NewUserContainer';
import LocationsContainer from '@/components/admin/locations/LocationsContainer';
import LocationEditContainer from '@/components/admin/locations/LocationEditContainer';
import ServersContainer from '@/components/admin/servers/ServersContainer';
import NewServerContainer from '@/components/admin/servers/NewServerContainer';
import ServerRouter from '@/components/admin/servers/ServerRouter';
import NodesContainer from '@/components/admin/nodes/NodesContainer';
import NewNodeContainer from '@/components/admin/nodes/NewNodeContainer';
import NodeRouter from '@/components/admin/nodes/NodeRouter';
import NestsContainer from '@/components/admin/nests/NestsContainer';
import NestEditContainer from '@/components/admin/nests/NestEditContainer';
import EggEditContainer from '@/components/admin/nests/eggs/EggEditContainer';
import NewEggContainer from '@/components/admin/nests/eggs/NewEggContainer';
import DatabaseHostsContainer from '@/components/admin/databases/DatabaseHostsContainer';
import MountsContainer from '@/components/admin/mounts/MountsContainer';
import ApiKeysContainer from '@/components/admin/api/ApiKeysContainer';

export default () => {
    const location = useLocation();
    const rootAdmin = useStoreState((state: ApplicationStore) => state.user.data!.rootAdmin);

    if (!rootAdmin) {
        return <Redirect to={'/'} />;
    }

    return (
        <Switch location={location}>
                        <Route path={'/admin'} exact>
                            <AdminDashboard />
                        </Route>
                        <Route path={'/admin/settings'} exact>
                            <SettingsContainer />
                        </Route>
                        <Route path={'/admin/users'} exact>
                            <UsersContainer />
                        </Route>
                        <Route path={'/admin/users/new'} exact>
                            <NewUserContainer />
                        </Route>
                        <Route path={'/admin/users/:id'} exact>
                            <UserEditContainer />
                        </Route>
                        <Route path={'/admin/locations'} exact>
                            <LocationsContainer />
                        </Route>
                        <Route path={'/admin/locations/:id'} exact>
                            <LocationEditContainer />
                        </Route>
                        <Route path={'/admin/servers'} exact>
                            <ServersContainer />
                        </Route>
                        <Route path={'/admin/servers/new'} exact>
                            <NewServerContainer />
                        </Route>
                        <Route path={'/admin/servers/:id'}>
                            <ServerRouter />
                        </Route>
                        <Route path={'/admin/nodes'} exact>
                            <NodesContainer />
                        </Route>
                        <Route path={'/admin/nodes/new'} exact>
                            <NewNodeContainer />
                        </Route>
                        <Route path={'/admin/nodes/:id'}>
                            <NodeRouter />
                        </Route>
                        <Route path={'/admin/nests'} exact>
                            <NestsContainer />
                        </Route>
                        <Route path={'/admin/nests/egg/new'} exact>
                            <NewEggContainer />
                        </Route>
                        <Route path={'/admin/nests/:nestId'} exact>
                            <NestEditContainer />
                        </Route>
                        <Route path={'/admin/nests/:nestId/eggs/:eggId'}>
                            <EggEditContainer />
                        </Route>
                        <Route path={'/admin/databases'} exact>
                            <DatabaseHostsContainer />
                        </Route>
                        <Route path={'/admin/mounts'} exact>
                            <MountsContainer />
                        </Route>
                        <Route path={'/admin/api'} exact>
                            <ApiKeysContainer />
                        </Route>
        </Switch>
    );
};
