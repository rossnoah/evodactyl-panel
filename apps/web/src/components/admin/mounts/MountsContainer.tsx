import React, { useEffect, useState } from 'react';
import { Form, Formik, FormikHelpers } from 'formik';
import * as Yup from 'yup';
import tw from 'twin.macro';
import useSWR from 'swr';
import { getMounts, createMount, updateMount, deleteMount, Mount } from '@/api/admin/mounts';
import Spinner from '@/components/elements/Spinner';
import Button from '@/components/elements/Button';
import Field from '@/components/elements/Field';
import SpinnerOverlay from '@/components/elements/SpinnerOverlay';
import ConfirmationModal from '@/components/elements/ConfirmationModal';
import useFlash from '@/plugins/useFlash';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash, faPen } from '@fortawesome/free-solid-svg-icons';
import AdminLayout from '@/components/admin/AdminLayout';
import AdminBox from '@/components/admin/AdminBox';
import { AdminTable, AdminTableHead, AdminTableBody, AdminTableHeader, AdminTableRow, AdminTableCell } from '@/components/admin/AdminTable';

interface FormValues {
    name: string;
    description: string;
    source: string;
    target: string;
    readOnly: boolean;
    userMountable: boolean;
}

const formSchema = Yup.object().shape({
    name: Yup.string().required('A name is required.').max(191),
    source: Yup.string().required('A source path is required.').max(191),
    target: Yup.string().required('A target path is required.').max(191),
});

const MountsContainer = () => {
    const { addFlash, clearFlashes, clearAndAddHttpError } = useFlash();
    const [editingMount, setEditingMount] = useState<Mount | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [deleteId, setDeleteId] = useState<number | null>(null);

    const { data: mounts, error, mutate } = useSWR<Mount[]>('/api/application/mounts', getMounts);

    useEffect(() => {
        if (error) clearAndAddHttpError({ key: 'admin:mounts', error });
        if (!error) clearFlashes('admin:mounts');
    }, [error]);

    const submit = (values: FormValues, { setSubmitting, resetForm }: FormikHelpers<FormValues>) => {
        clearFlashes('admin:mounts');
        const payload: Record<string, any> = {
            name: values.name, description: values.description || null,
            source: values.source, target: values.target,
            read_only: values.readOnly, user_mountable: values.userMountable,
        };

        const request = editingMount ? updateMount(editingMount.id, payload) : createMount(payload);
        request
            .then(() => {
                addFlash({ key: 'admin:mounts', type: 'success', message: editingMount ? 'Mount updated.' : 'Mount created.' });
                resetForm(); setShowForm(false); setEditingMount(null); mutate();
            })
            .catch((error) => clearAndAddHttpError({ key: 'admin:mounts', error }))
            .finally(() => setSubmitting(false));
    };

    const handleDelete = () => {
        if (!deleteId) return;
        clearFlashes('admin:mounts');
        deleteMount(deleteId)
            .then(() => { addFlash({ key: 'admin:mounts', type: 'success', message: 'Mount deleted.' }); setDeleteId(null); mutate(); })
            .catch((error) => { setDeleteId(null); clearAndAddHttpError({ key: 'admin:mounts', error }); });
    };

    const tools = (
        <Button color={'primary'} size={'xsmall'} onClick={() => { setEditingMount(null); setShowForm(!showForm); }}>
            {showForm ? 'Cancel' : 'Create New'}
        </Button>
    );

    return (
        <AdminLayout
            title={'Mounts'}
            subtitle={'Configure shared storage mounts for server containers.'}
            showFlashKey={'admin:mounts'}
            breadcrumbs={[{ label: 'Admin', to: '/admin' }, { label: 'Mounts' }]}
        >
            <ConfirmationModal visible={!!deleteId} title={'Delete Mount'} buttonText={'Yes, Delete'} onConfirmed={handleDelete} onModalDismissed={() => setDeleteId(null)}>
                Are you sure you want to delete this mount?
            </ConfirmationModal>

            {showForm && (
                <AdminBox title={editingMount ? 'Edit Mount' : 'Create Mount'} css={tw`mb-4`}>
                    <Formik<FormValues>
                        initialValues={{
                            name: editingMount?.name || '', description: editingMount?.description || '',
                            source: editingMount?.source || '', target: editingMount?.target || '',
                            readOnly: editingMount?.readOnly || false, userMountable: editingMount?.userMountable || false,
                        }}
                        validationSchema={formSchema} onSubmit={submit} enableReinitialize
                    >
                        {({ isSubmitting, values, setFieldValue }) => (
                            <Form>
                                <SpinnerOverlay visible={isSubmitting} />
                                <div css={tw`grid grid-cols-1 md:grid-cols-2 gap-4`}>
                                    <Field name={'name'} label={'Name'} />
                                    <Field name={'description'} label={'Description'} />
                                    <Field name={'source'} label={'Source'} description={'File path on the host system.'} placeholder={'/mnt/data'} />
                                    <Field name={'target'} label={'Target'} description={'Path inside the container.'} placeholder={'/data'} />
                                    <div>
                                        <label css={tw`flex items-center gap-2 text-sm text-neutral-300 cursor-pointer`}>
                                            <input type={'checkbox'} checked={values.readOnly} onChange={(e) => setFieldValue('readOnly', e.target.checked)} />
                                            Read Only
                                        </label>
                                    </div>
                                    <div>
                                        <label css={tw`flex items-center gap-2 text-sm text-neutral-300 cursor-pointer`}>
                                            <input type={'checkbox'} checked={values.userMountable} onChange={(e) => setFieldValue('userMountable', e.target.checked)} />
                                            User Mountable
                                        </label>
                                    </div>
                                </div>
                                <div css={tw`mt-4 flex justify-end`}>
                                    <Button type={'submit'} color={'green'} size={'xsmall'}>{editingMount ? 'Update' : 'Create'}</Button>
                                </div>
                            </Form>
                        )}
                    </Formik>
                </AdminBox>
            )}

            {!mounts ? (
                <Spinner centered size={'large'} />
            ) : (
                <AdminBox title={'Configured Mounts'} tools={tools} noPadding>
                    {mounts.length > 0 ? (
                        <AdminTable>
                            <AdminTableHead>
                                <tr>
                                    <AdminTableHeader>ID</AdminTableHeader>
                                    <AdminTableHeader>Name</AdminTableHeader>
                                    <AdminTableHeader>Source</AdminTableHeader>
                                    <AdminTableHeader>Target</AdminTableHeader>
                                    <AdminTableHeader className={'text-center'}>Read Only</AdminTableHeader>
                                    <AdminTableHeader></AdminTableHeader>
                                </tr>
                            </AdminTableHead>
                            <AdminTableBody>
                                {mounts.map((mount) => (
                                    <AdminTableRow key={mount.id}>
                                        <AdminTableCell><code>{mount.id}</code></AdminTableCell>
                                        <AdminTableCell>{mount.name}</AdminTableCell>
                                        <AdminTableCell><code>{mount.source}</code></AdminTableCell>
                                        <AdminTableCell><code>{mount.target}</code></AdminTableCell>
                                        <AdminTableCell className={'text-center'}>
                                            {mount.readOnly ? 'Yes' : 'No'}
                                        </AdminTableCell>
                                        <AdminTableCell className={'text-center'}>
                                            <button onClick={() => { setEditingMount(mount); setShowForm(true); }} css={tw`text-neutral-400 hover:text-neutral-200 mr-3`}>
                                                <FontAwesomeIcon icon={faPen} />
                                            </button>
                                            <button onClick={() => setDeleteId(mount.id)} css={tw`text-neutral-400 hover:text-red-400`}>
                                                <FontAwesomeIcon icon={faTrash} />
                                            </button>
                                        </AdminTableCell>
                                    </AdminTableRow>
                                ))}
                            </AdminTableBody>
                        </AdminTable>
                    ) : (
                        <p css={tw`text-center text-sm text-neutral-400 py-6`}>No mounts have been configured.</p>
                    )}
                </AdminBox>
            )}
        </AdminLayout>
    );
};

export default MountsContainer;
