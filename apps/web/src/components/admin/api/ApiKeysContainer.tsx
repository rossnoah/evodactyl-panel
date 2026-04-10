import React, { useEffect, useState } from 'react';
import { Form, Formik, FormikHelpers } from 'formik';
import * as Yup from 'yup';
import tw from 'twin.macro';
import useSWR from 'swr';
import {
    getApplicationApiKeys, createApplicationApiKey, deleteApplicationApiKey,
    ApplicationApiKey, API_PERMISSION_KEYS,
} from '@/api/admin/apiKeys';
import Spinner from '@/components/elements/Spinner';
import Button from '@/components/elements/Button';
import Field from '@/components/elements/Field';
import SpinnerOverlay from '@/components/elements/SpinnerOverlay';
import CopyOnClick from '@/components/elements/CopyOnClick';
import ConfirmationModal from '@/components/elements/ConfirmationModal';
import useFlash from '@/plugins/useFlash';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash } from '@fortawesome/free-solid-svg-icons';
import AdminLayout from '@/components/admin/AdminLayout';
import AdminBox from '@/components/admin/AdminBox';
import { AdminTable, AdminTableHead, AdminTableBody, AdminTableHeader, AdminTableRow, AdminTableCell } from '@/components/admin/AdminTable';

interface FormValues {
    description: string;
    allowedIps: string;
    permissions: Record<string, number>;
}

const formSchema = Yup.object().shape({
    description: Yup.string().required('A description is required.').max(255),
});

const PERMISSION_NONE = 0;
const PERMISSION_READ = 1;
const PERMISSION_WRITE = 2;

const ApiKeysContainer = () => {
    const { addFlash, clearFlashes, clearAndAddHttpError } = useFlash();
    const [showForm, setShowForm] = useState(false);
    const [newSecret, setNewSecret] = useState<string | null>(null);
    const [deleteIdentifier, setDeleteIdentifier] = useState<string | null>(null);

    const { data: keys, error, mutate } = useSWR<ApplicationApiKey[]>('/api/application/api-keys', getApplicationApiKeys);

    useEffect(() => {
        if (error) clearAndAddHttpError({ key: 'admin:api-keys', error });
        if (!error) clearFlashes('admin:api-keys');
    }, [error]);

    const defaultPermissions = API_PERMISSION_KEYS.reduce(
        (acc, { key }) => ({ ...acc, [key]: PERMISSION_NONE }),
        {} as Record<string, number>
    );

    const submit = (values: FormValues, { setSubmitting, resetForm }: FormikHelpers<FormValues>) => {
        clearFlashes('admin:api-keys');
        const allowedIps = values.allowedIps.split('\n').map((ip) => ip.trim()).filter((ip) => ip.length > 0);
        createApplicationApiKey(values.description, allowedIps, values.permissions)
            .then((result) => {
                setNewSecret(result.secretToken);
                resetForm(); setShowForm(false); mutate();
                addFlash({ key: 'admin:api-keys', type: 'success', message: 'API key created. Copy the secret token below.' });
            })
            .catch((error) => clearAndAddHttpError({ key: 'admin:api-keys', error }))
            .finally(() => setSubmitting(false));
    };

    const handleDelete = () => {
        if (!deleteIdentifier) return;
        clearFlashes('admin:api-keys');
        deleteApplicationApiKey(deleteIdentifier)
            .then(() => { addFlash({ key: 'admin:api-keys', type: 'success', message: 'API key deleted.' }); setDeleteIdentifier(null); mutate(); })
            .catch((error) => { setDeleteIdentifier(null); clearAndAddHttpError({ key: 'admin:api-keys', error }); });
    };

    const tools = (
        <Button color={'primary'} size={'xsmall'} onClick={() => { setShowForm(!showForm); setNewSecret(null); }}>
            {showForm ? 'Cancel' : 'Create New'}
        </Button>
    );

    return (
        <AdminLayout
            title={'Application API'}
            subtitle={'Manage access credentials for the application API.'}
            showFlashKey={'admin:api-keys'}
            breadcrumbs={[{ label: 'Admin', to: '/admin' }, { label: 'Application API' }]}
        >
            <ConfirmationModal visible={!!deleteIdentifier} title={'Revoke API Key'} buttonText={'Yes, Revoke'} onConfirmed={handleDelete} onModalDismissed={() => setDeleteIdentifier(null)}>
                Once this API key is revoked, any applications using it will immediately lose access.
            </ConfirmationModal>

            {newSecret && (
                <div css={tw`bg-green-900 border border-green-700 rounded p-4 mb-4`}>
                    <p css={tw`text-green-200 text-sm mb-2`}>Your new API key secret token is shown below. This will not be displayed again.</p>
                    <CopyOnClick text={newSecret}>
                        <pre css={tw`bg-neutral-900 p-3 rounded text-sm text-neutral-200 cursor-pointer break-all`}>{newSecret}</pre>
                    </CopyOnClick>
                </div>
            )}

            {showForm && (
                <AdminBox title={'Create API Key'} css={tw`mb-4`}>
                    <Formik<FormValues>
                        initialValues={{ description: '', allowedIps: '', permissions: defaultPermissions }}
                        validationSchema={formSchema} onSubmit={submit}
                    >
                        {({ isSubmitting, values, setFieldValue }) => (
                            <Form>
                                <SpinnerOverlay visible={isSubmitting} />
                                <div css={tw`grid grid-cols-1 md:grid-cols-2 gap-4 mb-4`}>
                                    <Field name={'description'} label={'Description'} />
                                    <Field name={'allowedIps'} label={'Allowed IPs'} description={'One per line. Leave blank to allow all.'} />
                                </div>
                                <h4 css={tw`text-xs font-bold uppercase text-neutral-400 mb-3`}>Permissions</h4>
                                <div css={tw`grid grid-cols-1 md:grid-cols-3 gap-3 mb-4`}>
                                    {API_PERMISSION_KEYS.map(({ key, label }) => (
                                        <div key={key} css={tw`flex items-center justify-between bg-neutral-800 rounded px-3 py-2`}>
                                            <span css={tw`text-sm text-neutral-300`}>{label}</span>
                                            <div css={tw`flex gap-1`}>
                                                {[
                                                    { value: PERMISSION_NONE, label: 'None' },
                                                    { value: PERMISSION_READ, label: 'R' },
                                                    { value: PERMISSION_WRITE, label: 'R/W' },
                                                ].map((option) => (
                                                    <button
                                                        key={option.value} type={'button'}
                                                        onClick={() => setFieldValue(`permissions.${key}`, option.value)}
                                                        css={[
                                                            tw`px-2 py-1 text-xs rounded transition-colors duration-100`,
                                                            values.permissions[key] === option.value
                                                                ? tw`bg-primary-500 text-primary-50`
                                                                : tw`bg-neutral-600 text-neutral-400 hover:text-neutral-200`,
                                                        ]}
                                                    >
                                                        {option.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div css={tw`flex justify-end`}>
                                    <Button type={'submit'} color={'green'} size={'xsmall'}>Create Key</Button>
                                </div>
                            </Form>
                        )}
                    </Formik>
                </AdminBox>
            )}

            {!keys ? (
                <Spinner centered size={'large'} />
            ) : (
                <AdminBox title={'API Credentials'} tools={tools} noPadding>
                    {keys.length > 0 ? (
                        <AdminTable>
                            <AdminTableHead>
                                <tr>
                                    <AdminTableHeader>Key</AdminTableHeader>
                                    <AdminTableHeader>Memo</AdminTableHeader>
                                    <AdminTableHeader>Last Used</AdminTableHeader>
                                    <AdminTableHeader>Created</AdminTableHeader>
                                    <AdminTableHeader></AdminTableHeader>
                                </tr>
                            </AdminTableHead>
                            <AdminTableBody>
                                {keys.map((apiKey) => (
                                    <AdminTableRow key={apiKey.identifier}>
                                        <AdminTableCell><code>{apiKey.identifier}</code></AdminTableCell>
                                        <AdminTableCell>{apiKey.description}</AdminTableCell>
                                        <AdminTableCell>{apiKey.lastUsedAt ? apiKey.lastUsedAt.toLocaleDateString() : 'Never'}</AdminTableCell>
                                        <AdminTableCell>{apiKey.createdAt.toLocaleDateString()}</AdminTableCell>
                                        <AdminTableCell className={'text-center'}>
                                            <button onClick={() => setDeleteIdentifier(apiKey.identifier)} css={tw`text-neutral-400 hover:text-red-400`}>
                                                <FontAwesomeIcon icon={faTrash} />
                                            </button>
                                        </AdminTableCell>
                                    </AdminTableRow>
                                ))}
                            </AdminTableBody>
                        </AdminTable>
                    ) : (
                        <p css={tw`text-center text-sm text-neutral-400 py-6`}>No application API keys have been created.</p>
                    )}
                </AdminBox>
            )}
        </AdminLayout>
    );
};

export default ApiKeysContainer;
