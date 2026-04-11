import { useLocation } from 'react-router';
import { NavLink, Route, Switch, useRouteMatch } from 'react-router-dom';
import styled from 'styled-components';
import tw from 'twin.macro';
import AdminLayout from '@/components/admin/AdminLayout';
import AdvancedSettingsForm from '@/components/admin/settings/AdvancedSettingsForm';
import GeneralSettingsForm from '@/components/admin/settings/GeneralSettingsForm';
import MailSettingsForm from '@/components/admin/settings/MailSettingsForm';

const TabNav = styled.div`
    ${tw`flex border-b border-neutral-600 mb-4`};

    & a {
        ${tw`px-4 py-2.5 text-sm font-medium no-underline transition-colors duration-100 border-b-2`};
        ${tw`text-neutral-400 border-transparent hover:text-neutral-200`};
    }

    & a.active {
        ${tw`text-neutral-100 border-cyan-500`};
    }
`;

const SETTINGS_TAB_LABELS: Record<string, { title: string; subtitle: string; crumb: string }> = {
    '/admin/settings': {
        title: 'General Settings',
        subtitle: 'Configure general panel settings.',
        crumb: 'General',
    },
    '/admin/settings/mail': {
        title: 'Mail Settings',
        subtitle: 'Configure how the panel sends email.',
        crumb: 'Mail',
    },
    '/admin/settings/advanced': {
        title: 'Advanced Settings',
        subtitle: 'Configure advanced panel settings.',
        crumb: 'Advanced',
    },
};

const SettingsRouter = () => {
    const match = useRouteMatch();
    const location = useLocation();

    const tab = SETTINGS_TAB_LABELS[location.pathname] ?? SETTINGS_TAB_LABELS['/admin/settings'];

    return (
        <AdminLayout
            title={tab.title}
            subtitle={tab.subtitle}
            showFlashKey={'admin:settings'}
            breadcrumbs={[{ label: 'Admin', to: '/admin' }, { label: 'Settings', to: '/admin/settings' }, { label: tab.crumb }]}
        >
            <TabNav>
                <NavLink to={`${match.url}`} exact>
                    General
                </NavLink>
                <NavLink to={`${match.url}/mail`}>Mail</NavLink>
                <NavLink to={`${match.url}/advanced`}>Advanced</NavLink>
            </TabNav>
            <Switch>
                <Route path={`${match.path}`} exact>
                    <GeneralSettingsForm />
                </Route>
                <Route path={`${match.path}/mail`} exact>
                    <MailSettingsForm />
                </Route>
                <Route path={`${match.path}/advanced`} exact>
                    <AdvancedSettingsForm />
                </Route>
            </Switch>
        </AdminLayout>
    );
};

export default SettingsRouter;
