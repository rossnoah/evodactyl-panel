import React, { useContext, useEffect, useState } from 'react';
import { Form, Formik, FormikHelpers } from 'formik';
import * as Yup from 'yup';
import tw from 'twin.macro';
import useSWR from 'swr';
import http, { FractalResponseData } from '@/api/http';
import Spinner from '@/components/elements/Spinner';
import ConfirmationModal from '@/components/elements/ConfirmationModal';
import useFlash from '@/plugins/useFlash';
import { AdminServerContext } from '@/components/admin/servers/ServerRouter';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash, faSync } from '@fortawesome/free-solid-svg-icons';
import AdminBox from '@/components/admin/AdminBox';
import { AdminTable, AdminTableHead, AdminTableBody, AdminTableHeader, AdminTableRow, AdminTableCell } from '@/components/admin/AdminTable';
import FlashMessageRender from '@/components/FlashMessageRender';
import Field from '@/components/elements/Field';
import Label from '@/components/elements/Label';
import Select from '@/components/elements/Select';
import Button from '@/components/elements/Button';
import SpinnerOverlay from '@/components/elements/SpinnerOverlay';

interface ServerDatabase {
    id: number;
    serverId: number;
    hostId: number;
    database: string;
    username: string;
    remote: string;
    maxConnections: number;
    createdAt: string;
}

interface DatabaseHost {
    id: number;
    name: string;
    host: string;
    port: number;
}

interface CreateValues {
    databaseHostId: number;
    database: string;
    remote: string;
    maxConnections: string;
}

const createSchema = Yup.object().shape({
    databaseHostId: Yup.number().required('A database host is required.').min(1, 'Select a database host.'),
    database: Yup.string().required('A database name is required.'),
    remote: Yup.string().required().default('%'),
});

const rawDataToDatabase = (data: any): ServerDatabase => ({
    id: data.id, serverId: data.server_id, hostId: data.host_id || data.database_host_id,
    database: data.database, username: data.username, remote: data.remote,
    maxConnections: data.max_connections ?? 0, createdAt: data.created_at,
});

const ServerDatabases = () => {
    const { server } = useContext(AdminServerContext);
    const { addFlash, clearFlashes, clearAndAddHttpError } = useFlash();
    const [deleteId, setDeleteId] = useState<number | null>(null);
    const [dbHosts, setDbHosts] = useState<DatabaseHost[]>([]);

    const { data: databases, error, mutate } = useSWR(
        `/api/application/servers/${server.id}/databases`,
        () => http.get(`/api/application/servers/${server.id}/databases`)
            .then(({ data }) => (data.data || []).map((d: FractalResponseData) => rawDataToDatabase(d.attributes)))
    );

    // Load database hosts
    useEffect(() => {
        http.get('/api/application/databases')
            .then(({ data }) => {
                setDbHosts((data.data || []).map((d: FractalResponseData) => ({
                    id: d.attributes.id,
                    name: d.attributes.name,
                    host: d.attributes.host,
                    port: d.attributes.port,
                })));
            })
            .catch(() => {});
    }, []);

    useEffect(() => {
        if (error) clearAndAddHttpError({ key: 'admin:server:databases', error });
        if (!error) clearFlashes('admin:server:databases');
    }, [error]);

    const handleDelete = () => {
        if (!deleteId) return;
        http.delete(`/api/application/servers/${server.id}/databases/${deleteId}`)
            .then(() => { addFlash({ key: 'admin:server:databases', type: 'success', message: 'Database deleted.' }); setDeleteId(null); mutate(); })
            .catch((error) => { setDeleteId(null); clearAndAddHttpError({ key: 'admin:server:databases', error }); });
    };

    const handleResetPassword = (databaseId: number) => {
        clearFlashes('admin:server:databases');
        http.post(`/api/application/servers/${server.id}/databases/${databaseId}/reset-password`)
            .then(() => addFlash({ key: 'admin:server:databases', type: 'success', message: 'Database password has been reset.' }))
            .catch((error) => clearAndAddHttpError({ key: 'admin:server:databases', error }));
    };

    const handleCreate = (values: CreateValues, { setSubmitting, resetForm }: FormikHelpers<CreateValues>) => {
        clearFlashes('admin:server:databases');

        http.post(`/api/application/servers/${server.id}/databases`, {
            database: values.database,
            database_host_id: values.databaseHostId,
            remote: values.remote,
            max_connections: values.maxConnections ? Number(values.maxConnections) : null,
        })
            .then(() => {
                addFlash({ key: 'admin:server:databases', type: 'success', message: 'Database created successfully.' });
                resetForm();
                mutate();
            })
            .catch((error) => clearAndAddHttpError({ key: 'admin:server:databases', error }))
            .finally(() => setSubmitting(false));
    };

    // Build a host lookup map
    const hostMap = new Map(dbHosts.map(h => [h.id, h]));

    return (
        <>
            <FlashMessageRender byKey={'admin:server:databases'} css={tw`mb-4`} />
            <ConfirmationModal visible={!!deleteId} title={'Delete Database'} buttonText={'Yes, Delete'} onConfirmed={handleDelete} onModalDismissed={() => setDeleteId(null)}>
                Are you sure you want to delete this database?
            </ConfirmationModal>

            <div css={tw`grid grid-cols-1 lg:grid-cols-3 gap-6`}>
                {/* Left column — Active Databases */}
                <div css={tw`lg:col-span-2`}>
                    <div css={tw`bg-cyan-800 bg-opacity-50 rounded p-3 mb-4 text-sm text-neutral-200`}>
                        Database passwords can be viewed when visiting this server on the front-end.
                    </div>

                    {!databases ? (
                        <Spinner centered size={'large'} />
                    ) : (
                        <AdminBox title={'Active Databases'} noPadding>
                            {databases.length > 0 ? (
                                <AdminTable>
                                    <AdminTableHead>
                                        <tr>
                                            <AdminTableHeader>Database</AdminTableHeader>
                                            <AdminTableHeader>Username</AdminTableHeader>
                                            <AdminTableHeader>Connections</AdminTableHeader>
                                            <AdminTableHeader>Host</AdminTableHeader>
                                            <AdminTableHeader className={'text-center'}>Max Conn.</AdminTableHeader>
                                            <AdminTableHeader></AdminTableHeader>
                                        </tr>
                                    </AdminTableHead>
                                    <AdminTableBody>
                                        {databases.map((db: ServerDatabase) => {
                                            const host = hostMap.get(db.hostId);
                                            return (
                                                <AdminTableRow key={db.id}>
                                                    <AdminTableCell><code>{db.database}</code></AdminTableCell>
                                                    <AdminTableCell><code>{db.username}</code></AdminTableCell>
                                                    <AdminTableCell><code>{db.remote}</code></AdminTableCell>
                                                    <AdminTableCell>
                                                        <code>{host ? `${host.host}:${host.port}` : `Host #${db.hostId}`}</code>
                                                    </AdminTableCell>
                                                    <AdminTableCell className={'text-center'}>
                                                        {db.maxConnections === 0 ? 'Unlimited' : db.maxConnections}
                                                    </AdminTableCell>
                                                    <AdminTableCell className={'text-center'}>
                                                        <button onClick={() => handleResetPassword(db.id)} css={tw`text-neutral-400 hover:text-neutral-200 mr-3`} title={'Reset Password'}>
                                                            <FontAwesomeIcon icon={faSync} />
                                                        </button>
                                                        <button onClick={() => setDeleteId(db.id)} css={tw`text-neutral-400 hover:text-red-400`} title={'Delete'}>
                                                            <FontAwesomeIcon icon={faTrash} />
                                                        </button>
                                                    </AdminTableCell>
                                                </AdminTableRow>
                                            );
                                        })}
                                    </AdminTableBody>
                                </AdminTable>
                            ) : (
                                <p css={tw`text-center text-sm text-neutral-400 py-6`}>This server has no databases.</p>
                            )}
                        </AdminBox>
                    )}
                </div>

                {/* Right column — Create New Database */}
                <div>
                    <AdminBox title={'Create New Database'}>
                        <Formik<CreateValues>
                            initialValues={{ databaseHostId: 0, database: '', remote: '%', maxConnections: '' }}
                            validationSchema={createSchema}
                            onSubmit={handleCreate}
                        >
                            {({ isSubmitting, values, setFieldValue }) => (
                                <Form>
                                    <SpinnerOverlay visible={isSubmitting} />
                                    <div css={tw`mb-4`}>
                                        <Label>Database Host</Label>
                                        <Select
                                            value={values.databaseHostId}
                                            onChange={(e) => setFieldValue('databaseHostId', Number(e.target.value))}
                                        >
                                            <option value={0}>Select a host...</option>
                                            {dbHosts.map(h => (
                                                <option key={h.id} value={h.id}>{h.name}</option>
                                            ))}
                                        </Select>
                                    </div>
                                    <div css={tw`mb-4`}>
                                        <Label>Database</Label>
                                        <div css={tw`flex items-center`}>
                                            <span css={tw`bg-neutral-800 border border-neutral-500 border-r-0 rounded-l px-3 py-2 text-sm text-neutral-400`}>
                                                s{server.id}_
                                            </span>
                                            <input
                                                type={'text'}
                                                value={values.database}
                                                onChange={(e) => setFieldValue('database', e.target.value)}
                                                placeholder={'database'}
                                                css={tw`flex-1 bg-neutral-600 border border-neutral-500 rounded-r px-3 py-2 text-sm text-neutral-200 outline-none focus:border-primary-400`}
                                            />
                                        </div>
                                    </div>
                                    <div css={tw`mb-4`}>
                                        <Field name={'remote'} label={'Connections From'} description={'Where connections should be allowed from. Use % for wildcard.'} />
                                    </div>
                                    <div css={tw`mb-4`}>
                                        <Field name={'maxConnections'} label={'Max Connections'} type={'number'} description={'Leave empty for unlimited.'} />
                                    </div>
                                    <p css={tw`text-xs text-neutral-500 mb-4`}>
                                        A username and password for this database will be randomly generated after form submission.
                                    </p>
                                    <div css={tw`flex justify-end`}>
                                        <Button type={'submit'} color={'green'} size={'small'}>
                                            Create Database
                                        </Button>
                                    </div>
                                </Form>
                            )}
                        </Formik>
                    </AdminBox>
                </div>
            </div>
        </>
    );
};

export default ServerDatabases;
