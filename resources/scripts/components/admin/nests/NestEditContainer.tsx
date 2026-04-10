import React, { useEffect, useState } from 'react';
import { Link, useParams, useHistory } from 'react-router-dom';
import { LinkButton } from '@/components/elements/Button';
import { Form, Formik, FormikHelpers } from 'formik';
import * as Yup from 'yup';
import tw from 'twin.macro';
import useSWR from 'swr';
import { getNest, updateNest, deleteNest, importEgg, Nest } from '@/api/admin/nests';
import Spinner from '@/components/elements/Spinner';
import Button from '@/components/elements/Button';
import Field from '@/components/elements/Field';
import SpinnerOverlay from '@/components/elements/SpinnerOverlay';
import ConfirmationModal from '@/components/elements/ConfirmationModal';
import useFlash from '@/plugins/useFlash';
import AdminLayout from '@/components/admin/AdminLayout';
import AdminBox from '@/components/admin/AdminBox';
import { AdminTable, AdminTableHead, AdminTableBody, AdminTableHeader, AdminTableRow, AdminTableCell } from '@/components/admin/AdminTable';

const formSchema = Yup.object().shape({
    name: Yup.string().required('A name is required.').max(191),
    description: Yup.string().nullable(),
});

const NestEditContainer = () => {
    const { nestId } = useParams<{ nestId: string }>();
    const history = useHistory();
    const { addFlash, clearFlashes, clearAndAddHttpError } = useFlash();
    const [showDelete, setShowDelete] = useState(false);

    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const handleImportEgg = () => {
        fileInputRef.current?.click();
    };

    const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = () => {
            const content = reader.result as string;
            clearFlashes('admin:nest');
            importEgg(Number(nestId), content)
                .then(() => {
                    addFlash({ key: 'admin:nest', type: 'success', message: 'Egg imported successfully.' });
                    mutate();
                })
                .catch((error) => clearAndAddHttpError({ key: 'admin:nest', error }));
        };
        reader.readAsText(file);
        // Reset so the same file can be re-selected
        e.target.value = '';
    };

    const { data: nest, error, mutate } = useSWR<Nest>(
        `/api/application/nests/${nestId}`,
        () => getNest(Number(nestId))
    );

    useEffect(() => {
        if (error) clearAndAddHttpError({ key: 'admin:nest', error });
        if (!error) clearFlashes('admin:nest');
    }, [error]);

    const submit = (values: { name: string; description: string }, { setSubmitting }: FormikHelpers<any>) => {
        clearFlashes('admin:nest');
        updateNest(Number(nestId), { name: values.name, description: values.description || null })
            .then(() => { addFlash({ key: 'admin:nest', type: 'success', message: 'Nest updated.' }); mutate(); })
            .catch((error) => clearAndAddHttpError({ key: 'admin:nest', error }))
            .finally(() => setSubmitting(false));
    };

    const handleDelete = () => {
        clearFlashes('admin:nest');
        deleteNest(Number(nestId))
            .then(() => history.push('/admin/nests'))
            .catch((error) => { setShowDelete(false); clearAndAddHttpError({ key: 'admin:nest', error }); });
    };

    return (
        <AdminLayout
            title={nest?.name || 'Nest'}
            subtitle={'Manage this nest and its eggs.'}
            showFlashKey={'admin:nest'}
            breadcrumbs={[
                { label: 'Admin', to: '/admin' },
                { label: 'Nests', to: '/admin/nests' },
                { label: nest?.name || '...' },
            ]}
        >
            {!nest ? <Spinner centered size={'large'} /> : (<>
            <ConfirmationModal visible={showDelete} title={'Delete Nest'} buttonText={'Yes, Delete'} onConfirmed={handleDelete} onModalDismissed={() => setShowDelete(false)}>
                Are you sure you want to delete this nest? This will fail if any servers are still using eggs from this nest.
            </ConfirmationModal>

            <div css={tw`grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4`}>
                <AdminBox title={'Edit Nest'} footer={
                    <div css={tw`flex justify-end`}>
                        <Button form={'nest-form'} type={'submit'} color={'primary'} size={'xsmall'}>Save</Button>
                    </div>
                }>
                    <Formik
                        initialValues={{ name: nest.name, description: nest.description || '' }}
                        validationSchema={formSchema} onSubmit={submit} enableReinitialize
                    >
                        {({ isSubmitting }) => (
                            <Form id={'nest-form'}>
                                <SpinnerOverlay visible={isSubmitting} />
                                <div css={tw`space-y-4`}>
                                    <Field name={'name'} label={'Name'} />
                                    <Field name={'description'} label={'Description'} />
                                </div>
                            </Form>
                        )}
                    </Formik>
                </AdminBox>

                <AdminBox title={'Nest Information'}>
                    <div css={tw`space-y-3 text-sm`}>
                        <div css={tw`flex justify-between`}>
                            <span css={tw`text-neutral-400`}>Nest ID</span>
                            <code>{nest.id}</code>
                        </div>
                        <div css={tw`flex justify-between`}>
                            <span css={tw`text-neutral-400`}>Author</span>
                            <span css={tw`text-neutral-200`}>{nest.author}</span>
                        </div>
                        <div css={tw`flex justify-between`}>
                            <span css={tw`text-neutral-400`}>UUID</span>
                            <code css={tw`text-xs`}>{nest.uuid}</code>
                        </div>
                        <div css={tw`flex justify-between`}>
                            <span css={tw`text-neutral-400`}>Total Eggs</span>
                            <span css={tw`text-neutral-200`}>{nest.eggs?.length ?? 0}</span>
                        </div>
                        <div css={tw`flex justify-between`}>
                            <span css={tw`text-neutral-400`}>Total Servers</span>
                            <span css={tw`text-neutral-200`}>{nest.serversCount ?? 0}</span>
                        </div>
                    </div>
                    <div css={tw`mt-4 pt-4 border-t border-neutral-600`}>
                        <Button color={'red'} size={'xsmall'} onClick={() => setShowDelete(true)}>Delete Nest</Button>
                    </div>
                </AdminBox>
            </div>

            <input type={'file'} ref={fileInputRef} accept={'.json'} css={tw`hidden`} onChange={handleFileSelected} />
            <AdminBox title={'Eggs'} tools={
                <div css={tw`flex gap-2`}>
                    <Button color={'primary'} size={'xsmall'} onClick={handleImportEgg}>
                        Import
                    </Button>
                    <LinkButton href={'/admin/nests/egg/new'} color={'primary'} size={'xsmall'} css={tw`no-underline`}>
                        Create New
                    </LinkButton>
                </div>
            } noPadding>
                {nest.eggs && nest.eggs.length > 0 ? (
                    <AdminTable>
                        <AdminTableHead>
                            <tr>
                                <AdminTableHeader>ID</AdminTableHeader>
                                <AdminTableHeader>Name</AdminTableHeader>
                                <AdminTableHeader>Description</AdminTableHeader>
                                <AdminTableHeader>Docker Image</AdminTableHeader>
                            </tr>
                        </AdminTableHead>
                        <AdminTableBody>
                            {nest.eggs.map((egg) => (
                                <AdminTableRow key={egg.id}>
                                    <AdminTableCell><code>{egg.id}</code></AdminTableCell>
                                    <AdminTableCell>
                                        <Link to={`/admin/nests/${nest.id}/eggs/${egg.id}`}>{egg.name}</Link>
                                    </AdminTableCell>
                                    <AdminTableCell css={tw`text-neutral-400`}>
                                        {egg.description ? egg.description.substring(0, 80) : 'No description.'}
                                    </AdminTableCell>
                                    <AdminTableCell>
                                        <code css={tw`text-xs`}>{Object.values(egg.dockerImages)[0] || 'None'}</code>
                                    </AdminTableCell>
                                </AdminTableRow>
                            ))}
                        </AdminTableBody>
                    </AdminTable>
                ) : (
                    <p css={tw`text-center text-sm text-neutral-400 py-6`}>This nest has no eggs.</p>
                )}
            </AdminBox>
            </>)}
        </AdminLayout>
    );
};

export default NestEditContainer;
