import { Form, Formik } from 'formik';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import useSWR from 'swr';
import tw from 'twin.macro';
import { object, string } from 'yup';
import { createNest, getNests, importEgg, type Nest } from '@/api/admin/nests';
import AdminBox from '@/components/admin/AdminBox';
import AdminLayout from '@/components/admin/AdminLayout';
import {
    AdminTable,
    AdminTableBody,
    AdminTableCell,
    AdminTableHead,
    AdminTableHeader,
    AdminTableRow,
} from '@/components/admin/AdminTable';
import Button from '@/components/elements/Button';
import Field from '@/components/elements/Field';
import Modal from '@/components/elements/Modal';
import Spinner from '@/components/elements/Spinner';
import SpinnerOverlay from '@/components/elements/SpinnerOverlay';
import useFlash from '@/plugins/useFlash';

const NestsContainer = () => {
    const { addFlash, clearFlashes, clearAndAddHttpError } = useFlash();
    const [showImportModal, setShowImportModal] = useState(false);
    const [importFiles, setImportFiles] = useState<File[]>([]);
    const [importNestId, setImportNestId] = useState<number | null>(null);
    const [importing, setImporting] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);

    const { data: nests, error, mutate } = useSWR<Nest[]>('/api/application/nests', getNests);

    useEffect(() => {
        if (error) clearAndAddHttpError({ key: 'admin:nests', error });
        if (!error) clearFlashes('admin:nests');
    }, [error, clearFlashes, clearAndAddHttpError]);

    const createSchema = object().shape({
        name: string().min(1).max(191).required('A name is required.'),
        description: string().max(255).optional(),
    });

    const handleCreate = (
        values: { name: string; description: string },
        { setSubmitting }: { setSubmitting: (v: boolean) => void },
    ) => {
        clearFlashes('admin:nests');
        createNest({ name: values.name, description: values.description || undefined })
            .then(() => {
                setShowCreateModal(false);
                mutate();
                addFlash({ key: 'admin:nests', type: 'success', message: 'Nest created.' });
            })
            .catch((error) => clearAndAddHttpError({ key: 'admin:nests', error }))
            .finally(() => setSubmitting(false));
    };

    const readFileAsText = (file: File) =>
        new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(reader.error ?? new Error(`Failed to read ${file.name}.`));
            reader.readAsText(file);
        });

    const handleImport = async () => {
        if (importFiles.length === 0 || !importNestId) return;
        setImporting(true);
        clearFlashes('admin:nests');

        const results = await Promise.allSettled(
            importFiles.map(async (file) => {
                const content = await readFileAsText(file);
                return importEgg(importNestId, content);
            }),
        );

        await mutate();

        const failures = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
        const successCount = results.length - failures.length;

        setImporting(false);
        setShowImportModal(false);
        setImportFiles([]);
        setImportNestId(null);

        if (failures.length === 0) {
            addFlash({
                key: 'admin:nests',
                type: 'success',
                message: successCount === 1 ? 'Egg imported successfully.' : `Imported ${successCount} eggs.`,
            });
        } else if (successCount === 0) {
            clearAndAddHttpError({ key: 'admin:nests', error: failures[0].reason });
        } else {
            clearAndAddHttpError({ key: 'admin:nests', error: failures[0].reason });
            addFlash({
                key: 'admin:nests',
                type: 'warning',
                message: `Imported ${successCount} of ${results.length} eggs. ${failures.length} failed.`,
            });
        }
    };

    const tools = (
        <div css={tw`flex items-center gap-2`}>
            <Button color={'green'} size={'xsmall'} onClick={() => setShowImportModal(true)}>
                Import Eggs
            </Button>
            <Link to={'/admin/nests/egg/new'}>
                <Button color={'green'} size={'xsmall'}>
                    New Egg
                </Button>
            </Link>
            <Button color={'primary'} size={'xsmall'} onClick={() => setShowCreateModal(true)}>
                Create Nest
            </Button>
        </div>
    );

    return (
        <AdminLayout
            title={'Nests'}
            subtitle={'All nests currently available on this system.'}
            showFlashKey={'admin:nests'}
            breadcrumbs={[{ label: 'Admin', to: '/admin' }, { label: 'Nests' }]}
        >
            <Modal visible={showCreateModal} onDismissed={() => setShowCreateModal(false)}>
                <h2 css={tw`text-2xl mb-6`}>Create Nest</h2>
                <Formik
                    initialValues={{ name: '', description: '' }}
                    validationSchema={createSchema}
                    onSubmit={handleCreate}
                >
                    {({ isSubmitting }) => (
                        <Form>
                            <SpinnerOverlay visible={isSubmitting} />
                            <div css={tw`mb-4`}>
                                <Field
                                    id={'name'}
                                    name={'name'}
                                    label={'Name'}
                                    description={'A short identifier for this nest.'}
                                />
                            </div>
                            <div css={tw`mb-6`}>
                                <Field
                                    id={'description'}
                                    name={'description'}
                                    label={'Description'}
                                    description={'An optional description of this nest.'}
                                />
                            </div>
                            <div css={tw`flex justify-end gap-2`}>
                                <Button
                                    isSecondary
                                    type={'button'}
                                    onClick={() => setShowCreateModal(false)}
                                    css={tw`border-transparent`}
                                >
                                    Cancel
                                </Button>
                                <Button type={'submit'} color={'primary'}>
                                    Create
                                </Button>
                            </div>
                        </Form>
                    )}
                </Formik>
            </Modal>

            <Modal
                visible={showImportModal}
                onDismissed={() => {
                    setShowImportModal(false);
                    setImportFiles([]);
                    setImportNestId(null);
                }}
            >
                <SpinnerOverlay visible={importing} />
                <h2 css={tw`text-2xl mb-6`}>Import Eggs</h2>
                <div css={tw`mb-4`}>
                    <label css={tw`text-xs uppercase text-neutral-400 block mb-1`}>Egg Files</label>
                    <input
                        type='file'
                        accept='.json,application/json'
                        multiple
                        css={tw`text-sm text-neutral-300`}
                        onChange={(e) => {
                            const files = Array.from(e.target.files ?? []);
                            const oversized = files.find((f) => f.size > 1000 * 1024);
                            if (oversized) {
                                clearAndAddHttpError({
                                    key: 'admin:nests',
                                    error: new Error(`${oversized.name} must be under 1000KB.`),
                                });
                                setImportFiles([]);
                                return;
                            }
                            setImportFiles(files);
                        }}
                    />
                    <p css={tw`text-xs text-neutral-500 mt-1`}>
                        Select one or more <code>.json</code> files to import as new eggs.
                    </p>
                </div>
                <div css={tw`mb-6`}>
                    <label css={tw`text-xs uppercase text-neutral-400 block mb-1`}>Associated Nest</label>
                    <select
                        css={tw`w-full bg-neutral-600 border border-neutral-500 rounded p-2 text-sm text-neutral-200`}
                        value={importNestId ?? ''}
                        onChange={(e) => setImportNestId(e.target.value ? Number(e.target.value) : null)}
                    >
                        <option value=''>Select a nest...</option>
                        {nests?.map((n) => (
                            <option key={n.id} value={n.id}>
                                {n.name}
                            </option>
                        ))}
                    </select>
                    <p css={tw`text-xs text-neutral-500 mt-1`}>
                        Select the nest that this egg will be associated with from the dropdown.
                    </p>
                </div>
                <div css={tw`flex justify-end gap-2`}>
                    <Button
                        isSecondary
                        type={'button'}
                        onClick={() => {
                            setShowImportModal(false);
                            setImportFiles([]);
                            setImportNestId(null);
                        }}
                        css={tw`border-transparent`}
                    >
                        Cancel
                    </Button>
                    <Button
                        color={'primary'}
                        disabled={importFiles.length === 0 || !importNestId || importing}
                        onClick={handleImport}
                    >
                        {importFiles.length > 1 ? `Import ${importFiles.length} Eggs` : 'Import'}
                    </Button>
                </div>
            </Modal>

            <div css={tw`bg-red-900 border border-red-700 rounded p-3 mb-4 text-sm text-red-200`}>
                Eggs are a powerful feature of Pterodactyl Panel that allow for extreme flexibility and configuration.
                Please note that while powerful, modifying an egg wrongly can very easily brick your servers and cause
                more problems. Please avoid editing default eggs unless you are absolutely sure of what you are doing.
            </div>

            {!nests ? (
                <Spinner centered size={'large'} />
            ) : (
                <AdminBox title={'Configured Nests'} tools={tools} noPadding>
                    {nests.length > 0 ? (
                        <AdminTable>
                            <AdminTableHead>
                                <tr>
                                    <AdminTableHeader>ID</AdminTableHeader>
                                    <AdminTableHeader>Name</AdminTableHeader>
                                    <AdminTableHeader>Description</AdminTableHeader>
                                    <AdminTableHeader className={'text-center'}>Eggs</AdminTableHeader>
                                    <AdminTableHeader className={'text-center'}>Servers</AdminTableHeader>
                                </tr>
                            </AdminTableHead>
                            <AdminTableBody>
                                {nests.map((nest) => (
                                    <AdminTableRow key={nest.id}>
                                        <AdminTableCell>
                                            <code>{nest.id}</code>
                                        </AdminTableCell>
                                        <AdminTableCell>
                                            <Link to={`/admin/nests/${nest.id}`}>{nest.name}</Link>
                                        </AdminTableCell>
                                        <AdminTableCell css={tw`text-neutral-400`}>
                                            {nest.description || 'No description.'}
                                        </AdminTableCell>
                                        <AdminTableCell className={'text-center'}>
                                            {nest.eggs?.length ?? 0}
                                        </AdminTableCell>
                                        <AdminTableCell className={'text-center'}>
                                            {nest.serversCount ?? 0}
                                        </AdminTableCell>
                                    </AdminTableRow>
                                ))}
                            </AdminTableBody>
                        </AdminTable>
                    ) : (
                        <p css={tw`text-center text-sm text-neutral-400 py-6`}>No nests have been configured.</p>
                    )}
                </AdminBox>
            )}
        </AdminLayout>
    );
};

export default NestsContainer;
