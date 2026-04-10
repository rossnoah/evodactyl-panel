import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faHome, faWrench, faGamepad,
    faDatabase, faGlobe, faSitemap, faServer, faUsers,
    faMagic, faThLarge,
    faSignOutAlt, faArrowLeft,
} from '@fortawesome/free-solid-svg-icons';
import tw from 'twin.macro';
import styled from 'styled-components';
import http from '@/api/http';

interface MenuItem {
    path: string;
    label: string;
    icon: any;
    exact?: boolean;
}

const sidebarSections: { header: string; items: MenuItem[] }[] = [
    {
        header: 'BASIC ADMINISTRATION',
        items: [
            { path: '/admin', label: 'Overview', icon: faHome, exact: true },
            { path: '/admin/settings', label: 'Settings', icon: faWrench },
            { path: '/admin/api', label: 'Application API', icon: faGamepad },
        ],
    },
    {
        header: 'MANAGEMENT',
        items: [
            { path: '/admin/databases', label: 'Databases', icon: faDatabase },
            { path: '/admin/locations', label: 'Locations', icon: faGlobe },
            { path: '/admin/nodes', label: 'Nodes', icon: faSitemap },
            { path: '/admin/servers', label: 'Servers', icon: faServer },
            { path: '/admin/users', label: 'Users', icon: faUsers },
        ],
    },
    {
        header: 'SERVICE MANAGEMENT',
        items: [
            { path: '/admin/mounts', label: 'Mounts', icon: faMagic },
            { path: '/admin/nests', label: 'Nests', icon: faThLarge },
        ],
    },
];

const SidebarContainer = styled.aside`
    ${tw`fixed left-0 bg-neutral-900 flex flex-col z-30`};
    width: 230px;
    top: 3.5rem;
    height: calc(100vh - 3.5rem);
`;

const SidebarMenu = styled.nav`
    ${tw`flex-1 overflow-y-auto py-2`};
`;

const SectionHeader = styled.li`
    ${tw`px-4 py-2 text-xs font-bold uppercase text-neutral-500 tracking-wider mt-2`};
    &:first-of-type {
        ${tw`mt-0`};
    }
`;

const MenuLink = styled(Link)<{ $active?: boolean }>`
    ${tw`flex items-center px-4 py-2.5 text-sm no-underline transition-colors duration-100`};
    ${(props) =>
        props.$active
            ? tw`text-neutral-100 bg-neutral-800 border-l-2 border-cyan-500`
            : tw`text-neutral-400 border-l-2 border-transparent hover:text-neutral-200 hover:bg-neutral-800`};

    & svg {
        ${tw`w-4 mr-3 text-center`};
    }
`;

const SidebarFooter = styled.div`
    ${tw`border-t border-neutral-800 flex-shrink-0`};
`;

const AdminSidebar: React.FC = () => {
    const location = useLocation();

    const isActive = (path: string, exact?: boolean) => {
        if (exact) return location.pathname === path;
        return location.pathname.startsWith(path);
    };

    const onLogout = () => {
        http.post('/auth/logout').finally(() => {
            // @ts-expect-error
            window.location = '/';
        });
    };

    return (
        <SidebarContainer>
            <SidebarMenu>
                <ul css={tw`list-none p-0 m-0`}>
                    {sidebarSections.map((section) => (
                        <React.Fragment key={section.header}>
                            <SectionHeader>{section.header}</SectionHeader>
                            {section.items.map((item) => (
                                <li key={item.path}>
                                    <MenuLink to={item.path} $active={isActive(item.path, item.exact)}>
                                        <FontAwesomeIcon icon={item.icon} fixedWidth />
                                        <span>{item.label}</span>
                                    </MenuLink>
                                </li>
                            ))}
                        </React.Fragment>
                    ))}
                </ul>
            </SidebarMenu>
            <SidebarFooter>
                <Link
                    to={'/'}
                    css={tw`flex items-center px-4 py-3 text-sm text-neutral-400 no-underline hover:text-neutral-200 hover:bg-neutral-800 transition-colors duration-100`}
                >
                    <FontAwesomeIcon icon={faArrowLeft} fixedWidth css={tw`mr-3`} />
                    Exit Admin
                </Link>
                <button
                    onClick={onLogout}
                    css={tw`flex items-center w-full px-4 py-3 text-sm text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors duration-100 border-0 bg-transparent cursor-pointer`}
                >
                    <FontAwesomeIcon icon={faSignOutAlt} fixedWidth css={tw`mr-3`} />
                    Sign Out
                </button>
            </SidebarFooter>
        </SidebarContainer>
    );
};

export default AdminSidebar;
