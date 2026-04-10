import React, { useEffect, useState } from 'react';
import { useParams, useHistory } from 'react-router-dom';
import { Form, Formik, FormikHelpers } from 'formik';
import * as Yup from 'yup';
import tw from 'twin.macro';
import styled from 'styled-components';
import useSWR from 'swr';
import { getEgg, updateEgg, updateEggScript, deleteEgg, exportEgg, updateEggImport, Egg } from '@/api/admin/nests';
import Spinner from '@/components/elements/Spinner';
import Button from '@/components/elements/Button';
import Field from '@/components/elements/Field';
import SpinnerOverlay from '@/components/elements/SpinnerOverlay';
import ConfirmationModal from '@/components/elements/ConfirmationModal';
import useFlash from '@/plugins/useFlash';
import EggVariables from '@/components/admin/nests/eggs/EggVariables';
import AdminLayout from '@/components/admin/AdminLayout';
import AdminBox from '@/components/admin/AdminBox';

type Tab = 'configuration' | 'variables' | 'install';

const TabButton = styled.button<{ $active: boolean }>`
    ${tw`px-4 py-2.5 text-sm font-medium transition-colors duration-100 border-b-2`};
    ${(props) => props.$active
        ? tw`text-neutral-100 border-cyan-500`
        : tw`text-neutral-400 border-transparent hover:text-neutral-200`};
`;

const configSchema = Yup.object().shape({
    name: Yup.string().required('A name is required.').max(191),
    startup: Yup.string().required('A startup command is required.'),
});

const EggEditContainer = () => {
    const { nestId, eggId } = useParams<{ nestId: string; eggId: string }>();
    const history = useHistory();
    const { addFlash, clearFlashes, clearAndAddHttpError } = useFlash();
    const [activeTab, setActiveTab] = useState<Tab>('configuration');
    const [showDelete, setShowDelete] = useState(false);
    const [updateFile, setUpdateFile] = useState<File | null>(null);
    const [updating, setUpdating] = useState(false);

    const { data: egg, error, mutate } = useSWR<Egg>(
        `/api/application/nests/${nestId}/eggs/${eggId}`,
        () => getEgg(Number(nestId), Number(eggId))
    );

    useEffect(() => {
        if (error) clearAndAddHttpError({ key: 'admin:egg', error });
        if (!error) clearFlashes('admin:egg');
    }, [error]);

    const submitConfig = (values: any, { setSubmitting }: FormikHelpers<any>) => {
        clearFlashes('admin:egg');
        const dockerImages: Record<string, string> = {};
        values.dockerImages.split('\n').filter(Boolean).forEach((line: string) => {
            const [key, ...rest] = line.split('|');
            if (key && rest.length > 0) dockerImages[key.trim()] = rest.join('|').trim();
            else dockerImages[line.trim()] = line.trim();
        });
        updateEgg(Number(nestId), Number(eggId), {
            name: values.name, description: values.description || null,
            startup: values.startup, config_stop: values.configStop || null,
            docker_images: Object.keys(dockerImages).length > 0 ? dockerImages : undefined,
        })
            .then(() => { addFlash({ key: 'admin:egg', type: 'success', message: 'Egg updated.' }); mutate(); })
            .catch((error) => clearAndAddHttpError({ key: 'admin:egg', error }))
            .finally(() => setSubmitting(false));
    };

    const submitScript = (values: any, { setSubmitting }: FormikHelpers<any>) => {
        clearFlashes('admin:egg');
        updateEggScript(Number(nestId), Number(eggId), {
            script_container: values.scriptContainer || null,
            script_entry: values.scriptEntry || null,
            script_install: values.scriptInstall || null,
        })
            .then(() => { addFlash({ key: 'admin:egg', type: 'success', message: 'Install script updated.' }); mutate(); })
            .catch((error) => clearAndAddHttpError({ key: 'admin:egg', error }))
            .finally(() => setSubmitting(false));
    };

    const handleDelete = () => {
        clearFlashes('admin:egg');
        deleteEgg(Number(nestId), Number(eggId))
            .then(() => history.push(`/admin/nests/${nestId}`))
            .catch((error) => { setShowDelete(false); clearAndAddHttpError({ key: 'admin:egg', error }); });
    };

    const handleExport = () => {
        clearFlashes('admin:egg');
        exportEgg(Number(nestId), Number(eggId))
            .catch((error) => clearAndAddHttpError({ key: 'admin:egg', error }));
    };

    const handleUpdateImport = () => {
        if (!updateFile) return;
        setUpdating(true);
        clearFlashes('admin:egg');
        const reader = new FileReader();
        reader.onload = () => {
            updateEggImport(Number(nestId), Number(eggId), reader.result as string)
                .then(() => {
                    addFlash({ key: 'admin:egg', type: 'success', message: 'Egg updated from imported file.' });
                    mutate();
                    setUpdateFile(null);
                })
                .catch((error) => clearAndAddHttpError({ key: 'admin:egg', error }))
                .finally(() => setUpdating(false));
        };
        reader.readAsText(updateFile);
    };

    const dockerImagesString = egg ? Object.entries(egg.dockerImages)
        .map(([key, value]) => (key === value ? value : `${key}|${value}`))
        .join('\n') : '';

    return (
        <AdminLayout
            title={egg?.name || 'Egg'}
            subtitle={egg ? `Egg configuration for ${egg.name}.` : 'Loading egg...'}
            showFlashKey={'admin:egg'}
            breadcrumbs={[
                { label: 'Admin', to: '/admin' },
                { label: 'Nests', to: '/admin/nests' },
                { label: `Nest #${nestId}`, to: `/admin/nests/${nestId}` },
                { label: egg?.name || '...' },
            ]}
        >
            {!egg ? <Spinner centered size={'large'} /> : (<>
            <ConfirmationModal visible={showDelete} title={'Delete Egg'} buttonText={'Yes, Delete'} onConfirmed={handleDelete} onModalDismissed={() => setShowDelete(false)}>
                Are you sure you want to delete this egg?
            </ConfirmationModal>

            <div css={tw`grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4`}>
                <AdminBox title={'Egg Information'}>
                    <div css={tw`space-y-2 text-sm`}>
                        <div css={tw`flex justify-between`}>
                            <span css={tw`text-neutral-400`}>Author</span>
                            <span css={tw`text-neutral-200`}>{egg.author}</span>
                        </div>
                        <div css={tw`flex justify-between`}>
                            <span css={tw`text-neutral-400`}>UUID</span>
                            <code css={tw`text-xs`}>{egg.uuid}</code>
                        </div>
                        <div css={tw`flex justify-between`}>
                            <span css={tw`text-neutral-400`}>Nest ID</span>
                            <span css={tw`text-neutral-200`}>{egg.nestId}</span>
                        </div>
                    </div>
                    <div css={tw`mt-4 pt-4 border-t border-neutral-600 flex gap-2`}>
                        <Button color={'primary'} size={'xsmall'} onClick={handleExport}>Export</Button>
                        <Button color={'red'} size={'xsmall'} onClick={() => setShowDelete(true)}>Delete Egg</Button>
                    </div>
                </AdminBox>
            </div>

            <div css={tw`bg-red-900/30 border border-red-700 rounded p-4 mb-4`}>
                <div css={tw`flex items-center justify-between`}>
                    <div css={tw`flex-1`}>
                        <label css={tw`text-xs uppercase text-neutral-400 block mb-1`}>Egg File</label>
                        <input
                            type="file"
                            accept=".json,application/json"
                            css={tw`text-sm text-neutral-300`}
                            onChange={(e) => {
                                const file = e.target.files?.[0] || null;
                                if (file && file.size > 1000 * 1024) {
                                    clearAndAddHttpError({ key: 'admin:egg', error: new Error('File must be under 1000KB.') });
                                    return;
                                }
                                setUpdateFile(file);
                            }}
                        />
                        <p css={tw`text-xs text-neutral-500 mt-1`}>If you would like to replace settings for this Egg by uploading a new JSON file, simply select it here and press &quot;Update Egg&quot;. This will not change any existing startup strings or Docker images for existing servers.</p>
                    </div>
                    <div>
                        <Button color={'red'} size={'xsmall'} disabled={!updateFile || updating} onClick={handleUpdateImport}>Update Egg</Button>
                    </div>
                </div>
            </div>

            <div css={tw`flex border-b border-neutral-600 mb-0`}>
                <TabButton $active={activeTab === 'configuration'} onClick={() => setActiveTab('configuration')}>Configuration</TabButton>
                <TabButton $active={activeTab === 'variables'} onClick={() => setActiveTab('variables')}>Variables</TabButton>
                <TabButton $active={activeTab === 'install'} onClick={() => setActiveTab('install')}>Install Script</TabButton>
            </div>

            <AdminBox>
                {activeTab === 'configuration' && (
                    <Formik
                        initialValues={{
                            name: egg.name, description: egg.description || '',
                            startup: egg.startup, configStop: egg.configStop || '',
                            dockerImages: dockerImagesString,
                        }}
                        validationSchema={configSchema} onSubmit={submitConfig} enableReinitialize
                    >
                        {({ isSubmitting }) => (
                            <Form>
                                <SpinnerOverlay visible={isSubmitting} />
                                <div css={tw`grid grid-cols-1 md:grid-cols-2 gap-4 mb-4`}>
                                    <Field name={'name'} label={'Name'} />
                                    <Field name={'description'} label={'Description'} />
                                </div>
                                <div css={tw`mb-4`}>
                                    <Field name={'startup'} label={'Startup Command'} />
                                </div>
                                <div css={tw`mb-4`}>
                                    <Field name={'configStop'} label={'Stop Command'} />
                                </div>
                                <div css={tw`mb-4`}>
                                    <label css={tw`text-xs uppercase text-neutral-400 block mb-1`}>Docker Images</label>
                                    <p css={tw`text-xs text-neutral-500 mb-1`}>One per line. Format: label|image or just image.</p>
                                    <textarea
                                        name={'dockerImages'}
                                        css={tw`w-full bg-neutral-600 border border-neutral-500 rounded p-3 text-sm font-mono text-neutral-200`}
                                        rows={4}
                                        defaultValue={dockerImagesString}
                                    />
                                </div>
                                <div css={tw`flex justify-end`}>
                                    <Button type={'submit'} color={'primary'} size={'xsmall'}>Save Configuration</Button>
                                </div>
                            </Form>
                        )}
                    </Formik>
                )}

                {activeTab === 'variables' && <EggVariables variables={egg.variables || []} />}

                {activeTab === 'install' && (
                    <Formik
                        initialValues={{
                            scriptContainer: egg.scriptContainer || 'alpine:3.4',
                            scriptEntry: egg.scriptEntry || 'ash',
                            scriptInstall: egg.scriptInstall || '',
                        }}
                        onSubmit={submitScript} enableReinitialize
                    >
                        {({ isSubmitting, values, setFieldValue }) => (
                            <Form>
                                <SpinnerOverlay visible={isSubmitting} />
                                <div css={tw`grid grid-cols-1 md:grid-cols-2 gap-4 mb-4`}>
                                    <Field name={'scriptContainer'} label={'Script Container'} description={'Docker image for the install script.'} />
                                    <Field name={'scriptEntry'} label={'Script Entry'} description={'Shell entrypoint for the install script.'} />
                                </div>
                                <div css={tw`mb-4`}>
                                    <label css={tw`text-xs uppercase text-neutral-400 block mb-1`}>Install Script</label>
                                    <textarea
                                        css={tw`w-full bg-neutral-600 border border-neutral-500 rounded p-3 text-sm font-mono text-neutral-200`}
                                        rows={20}
                                        value={values.scriptInstall}
                                        onChange={(e) => setFieldValue('scriptInstall', e.target.value)}
                                    />
                                </div>
                                <div css={tw`flex justify-end`}>
                                    <Button type={'submit'} color={'primary'} size={'xsmall'}>Save Install Script</Button>
                                </div>
                            </Form>
                        )}
                    </Formik>
                )}
            </AdminBox>
            </>)}
        </AdminLayout>
    );
};

export default EggEditContainer;
