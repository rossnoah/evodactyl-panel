import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faShieldAlt, faLock, faUnlock } from '@fortawesome/free-solid-svg-icons';
import tw from 'twin.macro';
import useSWR from 'swr';
import { PaginatedResult } from '@/api/http';
import { AdminUser, getUsers } from '@/api/admin/users';
import Pagination from '@/components/elements/Pagination';
import Spinner from '@/components/elements/Spinner';
import useFlash from '@/plugins/useFlash';
import Button from '@/components/elements/Button';
import AdminLayout from '@/components/admin/AdminLayout';
import AdminBox from '@/components/admin/AdminBox';
import { AdminTable, AdminTableHead, AdminTableBody, AdminTableHeader, AdminTableRow, AdminTableCell } from '@/components/admin/AdminTable';

export default () => {
    const { search } = useLocation();
    const defaultPage = Number(new URLSearchParams(search).get('page') || '1');
    const [page, setPage] = useState(!isNaN(defaultPage) && defaultPage > 0 ? defaultPage : 1);
    const [filterEmail, setFilterEmail] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const { clearFlashes, clearAndAddHttpError } = useFlash();

    const { data: users, error } = useSWR<PaginatedResult<AdminUser>>(
        ['/api/application/users', page, filterEmail],
        () => getUsers({ page, filterEmail: filterEmail || undefined })
    );

    useEffect(() => {
        if (!users) return;
        if (users.pagination.currentPage > 1 && !users.items.length) setPage(1);
    }, [users?.pagination.currentPage]);

    useEffect(() => {
        window.history.replaceState(null, document.title, `/admin/users${page <= 1 ? '' : `?page=${page}`}`);
    }, [page]);

    useEffect(() => {
        if (error) clearAndAddHttpError({ key: 'admin:users', error });
        if (!error) clearFlashes('admin:users');
    }, [error]);

    const handleSearch = () => { setPage(1); setFilterEmail(searchInput); };

    const tools = (
        <div css={tw`flex items-center gap-2`}>
            <input
                type={'text'}
                placeholder={'Filter by email address...'}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                css={tw`bg-neutral-600 border border-neutral-500 rounded px-3 py-1.5 text-sm text-neutral-200 outline-none focus:border-primary-400`}
            />
            <Button color={'grey'} size={'xsmall'} onClick={handleSearch}>Search</Button>
            <Link to={'/admin/users/new'}>
                <Button color={'primary'} size={'xsmall'}>Create New</Button>
            </Link>
        </div>
    );

    return (
        <AdminLayout
            title={'Users'}
            subtitle={'All registered users on the system.'}
            showFlashKey={'admin:users'}
            breadcrumbs={[
                { label: 'Admin', to: '/admin' },
                { label: 'Users' },
            ]}
        >
            {!users ? (
                <Spinner centered size={'large'} />
            ) : (
                <Pagination data={users} onPageSelect={setPage}>
                    {({ items }) => (
                        <AdminBox title={'User List'} tools={tools} noPadding>
                            {items.length > 0 ? (
                                <AdminTable>
                                    <AdminTableHead>
                                        <tr>
                                            <AdminTableHeader>ID</AdminTableHeader>
                                            <AdminTableHeader>Email</AdminTableHeader>
                                            <AdminTableHeader>Username</AdminTableHeader>
                                            <AdminTableHeader>Name</AdminTableHeader>
                                            <AdminTableHeader className={'text-center'}>Admin</AdminTableHeader>
                                            <AdminTableHeader className={'text-center'}>2FA</AdminTableHeader>
                                        </tr>
                                    </AdminTableHead>
                                    <AdminTableBody>
                                        {items.map((user) => (
                                            <AdminTableRow key={user.id}>
                                                <AdminTableCell><code>{user.id}</code></AdminTableCell>
                                                <AdminTableCell>
                                                    <Link to={`/admin/users/${user.id}`}>{user.email}</Link>
                                                </AdminTableCell>
                                                <AdminTableCell>{user.username}</AdminTableCell>
                                                <AdminTableCell>{user.firstName} {user.lastName}</AdminTableCell>
                                                <AdminTableCell className={'text-center'}>
                                                    {user.rootAdmin && (
                                                        <FontAwesomeIcon icon={faShieldAlt} css={tw`text-green-500`} />
                                                    )}
                                                </AdminTableCell>
                                                <AdminTableCell className={'text-center'}>
                                                    <FontAwesomeIcon
                                                        icon={user.twoFactorEnabled ? faLock : faUnlock}
                                                        css={user.twoFactorEnabled ? tw`text-green-500` : tw`text-neutral-500`}
                                                    />
                                                </AdminTableCell>
                                            </AdminTableRow>
                                        ))}
                                    </AdminTableBody>
                                </AdminTable>
                            ) : (
                                <p css={tw`text-center text-sm text-neutral-400 py-6`}>No users found.</p>
                            )}
                        </AdminBox>
                    )}
                </Pagination>
            )}
        </AdminLayout>
    );
};
