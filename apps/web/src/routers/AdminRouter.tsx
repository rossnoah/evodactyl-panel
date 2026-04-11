import { useStoreState } from 'easy-peasy';
import { useLocation } from 'react-router';
import { Redirect, Route, Switch } from 'react-router-dom';
import AdminDashboard from '@/components/admin/AdminDashboard';
import ApiKeysContainer from '@/components/admin/api/ApiKeysContainer';
import DatabaseHostsContainer from '@/components/admin/databases/DatabaseHostsContainer';
import LocationEditContainer from '@/components/admin/locations/LocationEditContainer';
import LocationsContainer from '@/components/admin/locations/LocationsContainer';
import MountsContainer from '@/components/admin/mounts/MountsContainer';
import EggEditContainer from '@/components/admin/nests/eggs/EggEditContainer';
import NewEggContainer from '@/components/admin/nests/eggs/NewEggContainer';
import NestEditContainer from '@/components/admin/nests/NestEditContainer';
import NestsContainer from '@/components/admin/nests/NestsContainer';
import NewNodeContainer from '@/components/admin/nodes/NewNodeContainer';
import NodeRouter from '@/components/admin/nodes/NodeRouter';
import NodesContainer from '@/components/admin/nodes/NodesContainer';
import NewServerContainer from '@/components/admin/servers/NewServerContainer';
import ServerRouter from '@/components/admin/servers/ServerRouter';
import ServersContainer from '@/components/admin/servers/ServersContainer';
import SettingsRouter from '@/components/admin/settings/SettingsRouter';
import NewUserContainer from '@/components/admin/users/NewUserContainer';
import UserEditContainer from '@/components/admin/users/UserEditContainer';
import UsersContainer from '@/components/admin/users/UsersContainer';
import type { ApplicationStore } from '@/state';

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
            <Route path={'/admin/settings'}>
                <SettingsRouter />
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
