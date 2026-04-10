import React, { useEffect, useState } from 'react';
import { Form, Formik, FormikHelpers, Field as FormikField, FieldProps } from 'formik';
import * as Yup from 'yup';
import tw from 'twin.macro';
import useSWR from 'swr';
import { getDatabaseHosts, createDatabaseHost, updateDatabaseHost, deleteDatabaseHost, DatabaseHost } from '@/api/admin/databases';
import { getNodes, Node } from '@/api/admin/nodes';
import { PaginatedResult } from '@/api/http';
import Spinner from '@/components/elements/Spinner';
import Button from '@/components/elements/Button';
import Field from '@/components/elements/Field';
import Label from '@/components/elements/Label';
import Select from '@/components/elements/Select';
import SpinnerOverlay from '@/components/elements/SpinnerOverlay';
import ConfirmationModal from '@/components/elements/ConfirmationModal';
import useFlash from '@/plugins/useFlash';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash, faPen } from '@fortawesome/free-solid-svg-icons';
import AdminLayout from '@/components/admin/AdminLayout';
import AdminBox from '@/components/admin/AdminBox';
import AdminStatusBadge from '@/components/admin/AdminStatusBadge';
import { AdminTable, AdminTableHead, AdminTableBody, AdminTableHeader, AdminTableRow, AdminTableCell } from '@/components/admin/AdminTable';

interface FormValues {
    name: string;
    host: string;
    port: number;
    username: string;
    password: string;
    nodeId: number;
    maxDatabases: number;
}

const formSchema = Yup.object().shape({
    name: Yup.string().required('A name is required.').max(255),
    host: Yup.string().required('A host address is required.'),
    port: Yup.number().required().min(1).max(65535),
    username: Yup.string().required('A username is required.'),
    password: Yup.string().when('$isCreating', {
        is: true,
        then: Yup.string().required('A password is required when creating.'),
    }),
});

const DatabaseHostsContainer = () => {
    const { addFlash, clearFlashes, clearAndAddHttpError } = useFlash();
    const [editingHost, setEditingHost] = useState<DatabaseHost | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [deleteId, setDeleteId] = useState<number | null>(null);

    const { data: hosts, error, mutate } = useSWR<DatabaseHost[]>('/api/application/databases', getDatabaseHosts);
    const { data: nodesData } = useSWR<PaginatedResult<Node>>('/api/application/nodes:all', () => getNodes(1));

    useEffect(() => {
        if (error) clearAndAddHttpError({ key: 'admin:databases', error });
        if (!error) clearFlashes('admin:databases');
    }, [error]);

    const submit = (values: FormValues, { setSubmitting, resetForm }: FormikHelpers<FormValues>) => {
        clearFlashes('admin:databases');
        const payload: Record<string, any> = {
            name: values.name, host: values.host, port: values.port,
            username: values.username, node_id: values.nodeId || null,
        };
        if (values.password) payload.password = values.password;

        const request = editingHost ? updateDatabaseHost(editingHost.id, payload) : createDatabaseHost(payload);
        request
            .then(() => {
                addFlash({ key: 'admin:databases', type: 'success', message: editingHost ? 'Database host updated.' : 'Database host created.' });
                resetForm(); setShowForm(false); setEditingHost(null); mutate();
            })
            .catch((error) => clearAndAddHttpError({ key: 'admin:databases', error }))
            .finally(() => setSubmitting(false));
    };

    const handleDelete = () => {
        if (!deleteId) return;
        clearFlashes('admin:databases');
        deleteDatabaseHost(deleteId)
            .then(() => { addFlash({ key: 'admin:databases', type: 'success', message: 'Database host deleted.' }); setDeleteId(null); mutate(); })
            .catch((error) => { setDeleteId(null); clearAndAddHttpError({ key: 'admin:databases', error }); });
    };

    const nodes = nodesData?.items || [];

    const tools = (
        <Button color={'primary'} size={'xsmall'} onClick={() => { setEditingHost(null); setShowForm(!showForm); }}>
            {showForm ? 'Cancel' : 'Create New'}
        </Button>
    );

    return (
        <AdminLayout
            title={'Database Hosts'}
            subtitle={'Database hosts that servers can have databases created on.'}
            showFlashKey={'admin:databases'}
            breadcrumbs={[{ label: 'Admin', to: '/admin' }, { label: 'Databases' }]}
        >
            <ConfirmationModal visible={!!deleteId} title={'Delete Database Host'} buttonText={'Yes, Delete'} onConfirmed={handleDelete} onModalDismissed={() => setDeleteId(null)}>
                Are you sure you want to delete this database host?
            </ConfirmationModal>

            {showForm && (
                <AdminBox title={editingHost ? 'Edit Database Host' : 'Create Database Host'} css={tw`mb-4`}>
                    <Formik<FormValues>
                        initialValues={{
                            name: editingHost?.name || '', host: editingHost?.host || '',
                            port: editingHost?.port || 3306, username: editingHost?.username || '',
                            password: '', nodeId: editingHost?.nodeId || 0, maxDatabases: editingHost?.maxDatabases || 0,
                        }}
                        validationSchema={formSchema} onSubmit={submit} enableReinitialize
                    >
                        {({ isSubmitting }) => (
                            <Form>
                                <SpinnerOverlay visible={isSubmitting} />
                                <div css={tw`grid grid-cols-1 md:grid-cols-2 gap-4`}>
                                    <Field name={'name'} label={'Name'} />
                                    <Field name={'host'} label={'Host'} placeholder={'127.0.0.1'} />
                                    <Field name={'port'} label={'Port'} type={'number'} />
                                    <Field name={'username'} label={'Username'} />
                                    <Field name={'password'} label={'Password'} type={'password'} description={editingHost ? 'Leave blank to keep current password.' : undefined} />
                                    <FormikField name={'nodeId'}>
                                        {({ field, form }: FieldProps) => (
                                            <div>
                                                <Label>Linked Node</Label>
                                                <Select {...field} onChange={(e) => form.setFieldValue('nodeId', Number(e.target.value))}>
                                                    <option value={0}>None</option>
                                                    {nodes.map((node) => <option key={node.id} value={node.id}>{node.name}</option>)}
                                                </Select>
                                            </div>
                                        )}
                                    </FormikField>
                                </div>
                                <div css={tw`mt-4 flex justify-end`}>
                                    <Button type={'submit'} color={'green'} size={'xsmall'}>{editingHost ? 'Update' : 'Create'}</Button>
                                </div>
                            </Form>
                        )}
                    </Formik>
                </AdminBox>
            )}

            {!hosts ? (
                <Spinner centered size={'large'} />
            ) : (
                <AdminBox title={'Configured Hosts'} tools={tools} noPadding>
                    {hosts.length > 0 ? (
                        <AdminTable>
                            <AdminTableHead>
                                <tr>
                                    <AdminTableHeader>ID</AdminTableHeader>
                                    <AdminTableHeader>Name</AdminTableHeader>
                                    <AdminTableHeader>Host</AdminTableHeader>
                                    <AdminTableHeader className={'text-center'}>Port</AdminTableHeader>
                                    <AdminTableHeader>Username</AdminTableHeader>
                                    <AdminTableHeader className={'text-center'}>Databases</AdminTableHeader>
                                    <AdminTableHeader className={'text-center'}>Node</AdminTableHeader>
                                    <AdminTableHeader></AdminTableHeader>
                                </tr>
                            </AdminTableHead>
                            <AdminTableBody>
                                {hosts.map((host) => (
                                    <AdminTableRow key={host.id}>
                                        <AdminTableCell><code>{host.id}</code></AdminTableCell>
                                        <AdminTableCell>{host.name}</AdminTableCell>
                                        <AdminTableCell><code>{host.host}</code></AdminTableCell>
                                        <AdminTableCell className={'text-center'}>{host.port}</AdminTableCell>
                                        <AdminTableCell>{host.username}</AdminTableCell>
                                        <AdminTableCell className={'text-center'}>{host.databasesCount ?? '?'}</AdminTableCell>
                                        <AdminTableCell className={'text-center'}>
                                            {host.nodeId ? `#${host.nodeId}` : <AdminStatusBadge $color={'default'}>None</AdminStatusBadge>}
                                        </AdminTableCell>
                                        <AdminTableCell className={'text-center'}>
                                            <button onClick={() => { setEditingHost(host); setShowForm(true); }} css={tw`text-neutral-400 hover:text-neutral-200 mr-3`}>
                                                <FontAwesomeIcon icon={faPen} />
                                            </button>
                                            <button onClick={() => setDeleteId(host.id)} css={tw`text-neutral-400 hover:text-red-400`}>
                                                <FontAwesomeIcon icon={faTrash} />
                                            </button>
                                        </AdminTableCell>
                                    </AdminTableRow>
                                ))}
                            </AdminTableBody>
                        </AdminTable>
                    ) : (
                        <p css={tw`text-center text-sm text-neutral-400 py-6`}>No database hosts have been configured.</p>
                    )}
                </AdminBox>
            )}
        </AdminLayout>
    );
};

export default DatabaseHostsContainer;
