import React, { useEffect, useState } from 'react';
import { Link, useHistory } from 'react-router-dom';
import tw from 'twin.macro';
import useSWR from 'swr';
import { getNests, createNest, importEgg, Nest } from '@/api/admin/nests';
import Spinner from '@/components/elements/Spinner';
import useFlash from '@/plugins/useFlash';
import Button from '@/components/elements/Button';
import Modal from '@/components/elements/Modal';
import SpinnerOverlay from '@/components/elements/SpinnerOverlay';
import AdminLayout from '@/components/admin/AdminLayout';
import AdminBox from '@/components/admin/AdminBox';
import { AdminTable, AdminTableHead, AdminTableBody, AdminTableHeader, AdminTableRow, AdminTableCell } from '@/components/admin/AdminTable';

const NestsContainer = () => {
    const history = useHistory();
    const { addFlash, clearFlashes, clearAndAddHttpError } = useFlash();
    const [showImportModal, setShowImportModal] = useState(false);
    const [importFile, setImportFile] = useState<File | null>(null);
    const [importNestId, setImportNestId] = useState<number | null>(null);
    const [importing, setImporting] = useState(false);

    const { data: nests, error, mutate } = useSWR<Nest[]>(
        '/api/application/nests',
        getNests
    );

    useEffect(() => {
        if (error) clearAndAddHttpError({ key: 'admin:nests', error });
        if (!error) clearFlashes('admin:nests');
    }, [error]);

    const handleImport = () => {
        if (!importFile || !importNestId) return;
        setImporting(true);
        clearFlashes('admin:nests');
        const reader = new FileReader();
        reader.onload = () => {
            importEgg(importNestId, reader.result as string)
                .then((egg) => {
                    setShowImportModal(false);
                    setImportFile(null);
                    setImportNestId(null);
                    history.push(`/admin/nests/${importNestId}/eggs/${egg.id}`);
                })
                .catch((error) => clearAndAddHttpError({ key: 'admin:nests', error }))
                .finally(() => setImporting(false));
        };
        reader.readAsText(importFile);
    };

    const tools = (
        <div css={tw`flex items-center gap-2`}>
            <Button color={'green'} size={'xsmall'} onClick={() => setShowImportModal(true)}>Import Egg</Button>
            <Link to={'/admin/nests/egg/new'}>
                <Button color={'green'} size={'xsmall'}>New Egg</Button>
            </Link>
            <Button color={'primary'} size={'xsmall'} onClick={() => {
                const name = prompt('Enter a name for the new nest:');
                if (!name) return;
                clearFlashes('admin:nests');
                createNest({ name })
                    .then(() => { mutate(); addFlash({ key: 'admin:nests', type: 'success', message: 'Nest created.' }); })
                    .catch((error) => clearAndAddHttpError({ key: 'admin:nests', error }));
            }}>
                Create Nest
            </Button>
        </div>
    );

    return (
        <AdminLayout
            title={'Nests'}
            subtitle={'All nests currently available on this system.'}
            showFlashKey={'admin:nests'}
            breadcrumbs={[
                { label: 'Admin', to: '/admin' },
                { label: 'Nests' },
            ]}
        >
            <Modal visible={showImportModal} onDismissed={() => { setShowImportModal(false); setImportFile(null); setImportNestId(null); }}>
                <SpinnerOverlay visible={importing} />
                <h2 css={tw`text-2xl mb-6`}>Import an Egg</h2>
                <div css={tw`mb-4`}>
                    <label css={tw`text-xs uppercase text-neutral-400 block mb-1`}>Egg File</label>
                    <input
                        type="file"
                        accept=".json,application/json"
                        css={tw`text-sm text-neutral-300`}
                        onChange={(e) => {
                            const file = e.target.files?.[0] || null;
                            if (file && file.size > 1000 * 1024) {
                                clearAndAddHttpError({ key: 'admin:nests', error: new Error('File must be under 1000KB.') });
                                return;
                            }
                            setImportFile(file);
                        }}
                    />
                    <p css={tw`text-xs text-neutral-500 mt-1`}>Select the <code>.json</code> file for the new egg that you wish to import.</p>
                </div>
                <div css={tw`mb-6`}>
                    <label css={tw`text-xs uppercase text-neutral-400 block mb-1`}>Associated Nest</label>
                    <select
                        css={tw`w-full bg-neutral-600 border border-neutral-500 rounded p-2 text-sm text-neutral-200`}
                        value={importNestId ?? ''}
                        onChange={(e) => setImportNestId(e.target.value ? Number(e.target.value) : null)}
                    >
                        <option value="">Select a nest...</option>
                        {nests?.map((n) => (
                            <option key={n.id} value={n.id}>{n.name}</option>
                        ))}
                    </select>
                    <p css={tw`text-xs text-neutral-500 mt-1`}>Select the nest that this egg will be associated with from the dropdown.</p>
                </div>
                <div css={tw`flex justify-end gap-2`}>
                    <Button isSecondary type={'button'} onClick={() => { setShowImportModal(false); setImportFile(null); setImportNestId(null); }} css={tw`border-transparent`}>Cancel</Button>
                    <Button color={'primary'} disabled={!importFile || !importNestId || importing} onClick={handleImport}>Import</Button>
                </div>
            </Modal>

            <div css={tw`bg-red-900 border border-red-700 rounded p-3 mb-4 text-sm text-red-200`}>
                Eggs are a powerful feature of Pterodactyl Panel that allow for extreme flexibility and configuration. Please note that while powerful, modifying an egg wrongly can very easily brick your servers and cause more problems. Please avoid editing default eggs unless you are absolutely sure of what you are doing.
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
                                        <AdminTableCell><code>{nest.id}</code></AdminTableCell>
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
