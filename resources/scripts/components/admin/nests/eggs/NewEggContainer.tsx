import React, { useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import { Form, Formik, FormikHelpers } from 'formik';
import * as Yup from 'yup';
import tw from 'twin.macro';
import useSWR from 'swr';
import { getNests, createEgg, Nest } from '@/api/admin/nests';
import Spinner from '@/components/elements/Spinner';
import Button from '@/components/elements/Button';
import Field from '@/components/elements/Field';
import Label from '@/components/elements/Label';
import Select from '@/components/elements/Select';
import SpinnerOverlay from '@/components/elements/SpinnerOverlay';
import useFlash from '@/plugins/useFlash';
import AdminLayout from '@/components/admin/AdminLayout';
import AdminBox from '@/components/admin/AdminBox';

interface FormValues {
    nestId: string;
    name: string;
    description: string;
    dockerImages: string;
    startup: string;
    forceOutgoingIp: boolean;
    configStop: string;
    configLogs: string;
    configFiles: string;
    configStartup: string;
}

const schema = Yup.object().shape({
    nestId: Yup.string().required('A nest is required.'),
    name: Yup.string().required('A name is required.').max(191),
    dockerImages: Yup.string().required('At least one Docker image is required.'),
    startup: Yup.string().required('A startup command is required.'),
});

const NewEggContainer = () => {
    const history = useHistory();
    const { addFlash, clearFlashes, clearAndAddHttpError } = useFlash();

    const { data: nests } = useSWR<Nest[]>('/api/application/nests', getNests);

    const submit = (values: FormValues, { setSubmitting }: FormikHelpers<FormValues>) => {
        clearFlashes('admin:egg:new');

        // Parse docker images: one per line, format "image" or "label|image"
        const dockerImages: Record<string, string> = {};
        values.dockerImages.split('\n').map((l) => l.trim()).filter(Boolean).forEach((line) => {
            const [key, ...rest] = line.split('|');
            if (key && rest.length > 0) {
                dockerImages[key.trim()] = rest.join('|').trim();
            } else {
                dockerImages[line.trim()] = line.trim();
            }
        });

        createEgg(Number(values.nestId), {
            name: values.name,
            description: values.description || null,
            docker_images: dockerImages,
            startup: values.startup,
            force_outgoing_ip: values.forceOutgoingIp,
            config_stop: values.configStop || null,
            config_logs: values.configLogs || null,
            config_files: values.configFiles || null,
            config_startup: values.configStartup || null,
        })
            .then((egg) => {
                addFlash({ key: 'admin:nest', type: 'success', message: `Egg "${egg.name}" created successfully.` });
                history.push(`/admin/nests/${values.nestId}/eggs/${egg.id}`);
            })
            .catch((error) => clearAndAddHttpError({ key: 'admin:egg:new', error }))
            .finally(() => setSubmitting(false));
    };

    return (
        <AdminLayout
            title={'New Egg'}
            subtitle={'Create a new Egg to assign to servers.'}
            showFlashKey={'admin:egg:new'}
            breadcrumbs={[
                { label: 'Admin', to: '/admin' },
                { label: 'Nests', to: '/admin/nests' },
                { label: 'New Egg' },
            ]}
        >
            {!nests ? <Spinner centered size={'large'} /> : (<>
            <Formik<FormValues>
                initialValues={{
                    nestId: nests.length > 0 ? String(nests[0].id) : '',
                    name: '',
                    description: '',
                    dockerImages: '',
                    startup: '',
                    forceOutgoingIp: false,
                    configStop: '',
                    configLogs: '',
                    configFiles: '',
                    configStartup: '',
                }}
                validationSchema={schema}
                onSubmit={submit}
            >
                {({ isSubmitting, values, setFieldValue }) => (
                    <Form>
                        <SpinnerOverlay visible={isSubmitting} />

                        <AdminBox title={'Configuration'} css={tw`mb-4`}>
                            <div css={tw`grid grid-cols-1 lg:grid-cols-2 gap-6`}>
                                <div css={tw`space-y-4`}>
                                    <div>
                                        <Label htmlFor={'nestId'}>Associated Nest</Label>
                                        <Select
                                            id={'nestId'}
                                            name={'nestId'}
                                            value={values.nestId}
                                            onChange={(e) => setFieldValue('nestId', e.target.value)}
                                        >
                                            {nests.map((nest) => (
                                                <option key={nest.id} value={nest.id}>
                                                    {nest.name} &lt;{nest.author}&gt;
                                                </option>
                                            ))}
                                        </Select>
                                        <p css={tw`mt-1 text-xs text-neutral-400`}>
                                            Think of a Nest as a category. You can put multiple Eggs in a nest, but consider putting only related Eggs in each Nest.
                                        </p>
                                    </div>
                                    <Field
                                        name={'name'}
                                        label={'Name'}
                                        description={'A simple, human-readable name to use as an identifier for this Egg.'}
                                    />
                                    <div>
                                        <Label htmlFor={'description'}>Description</Label>
                                        <textarea
                                            id={'description'}
                                            name={'description'}
                                            value={values.description}
                                            onChange={(e) => setFieldValue('description', e.target.value)}
                                            rows={6}
                                            css={tw`w-full bg-neutral-600 border-2 border-neutral-500 hover:border-neutral-400 rounded p-3 text-sm text-neutral-200 outline-none focus:border-primary-300`}
                                        />
                                        <p css={tw`mt-1 text-xs text-neutral-400`}>A description of this Egg.</p>
                                    </div>
                                    <div>
                                        <label css={tw`flex items-center gap-2 text-sm text-neutral-300 cursor-pointer`}>
                                            <input
                                                type={'checkbox'}
                                                checked={values.forceOutgoingIp}
                                                onChange={(e) => setFieldValue('forceOutgoingIp', e.target.checked)}
                                            />
                                            Force Outgoing IP
                                        </label>
                                        <p css={tw`mt-1 text-xs text-neutral-400`}>
                                            Forces all outgoing network traffic to have its Source IP NATed to the IP of the server's primary allocation IP.
                                        </p>
                                    </div>
                                </div>
                                <div css={tw`space-y-4`}>
                                    <div>
                                        <Label htmlFor={'dockerImages'}>Docker Images</Label>
                                        <textarea
                                            id={'dockerImages'}
                                            name={'dockerImages'}
                                            value={values.dockerImages}
                                            onChange={(e) => setFieldValue('dockerImages', e.target.value)}
                                            rows={4}
                                            placeholder={'ghcr.io/pterodactyl/yolks:java_17'}
                                            css={tw`w-full bg-neutral-600 border-2 border-neutral-500 hover:border-neutral-400 rounded p-3 text-sm font-mono text-neutral-200 outline-none focus:border-primary-300`}
                                        />
                                        <p css={tw`mt-1 text-xs text-neutral-400`}>
                                            The docker images available to servers using this egg. Enter one per line. Users will be able to select from this list if more than one value is provided.
                                        </p>
                                    </div>
                                    <div>
                                        <Label htmlFor={'startup'}>Startup Command</Label>
                                        <textarea
                                            id={'startup'}
                                            name={'startup'}
                                            value={values.startup}
                                            onChange={(e) => setFieldValue('startup', e.target.value)}
                                            rows={6}
                                            css={tw`w-full bg-neutral-600 border-2 border-neutral-500 hover:border-neutral-400 rounded p-3 text-sm font-mono text-neutral-200 outline-none focus:border-primary-300`}
                                        />
                                        <p css={tw`mt-1 text-xs text-neutral-400`}>
                                            The default startup command that should be used for new servers created with this Egg.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </AdminBox>

                        <AdminBox
                            title={'Process Management'}
                            footer={
                                <div css={tw`flex justify-end`}>
                                    <Button type={'submit'} color={'green'} size={'xsmall'}>Create</Button>
                                </div>
                            }
                        >
                            <div css={tw`bg-yellow-900 border border-yellow-700 rounded p-3 mb-4 text-sm text-yellow-200`}>
                                All fields below are required unless you select a separate option from the 'Copy Settings From' dropdown, in which case fields may be left blank to use the values from that option.
                            </div>
                            <div css={tw`grid grid-cols-1 lg:grid-cols-2 gap-6`}>
                                <div css={tw`space-y-4`}>
                                    <Field
                                        name={'configStop'}
                                        label={'Stop Command'}
                                        description={'The command that should be sent to server processes to stop them gracefully. Use ^C for SIGINT.'}
                                    />
                                    <div>
                                        <Label htmlFor={'configLogs'}>Log Configuration</Label>
                                        <textarea
                                            id={'configLogs'}
                                            name={'configLogs'}
                                            value={values.configLogs}
                                            onChange={(e) => setFieldValue('configLogs', e.target.value)}
                                            rows={6}
                                            css={tw`w-full bg-neutral-600 border-2 border-neutral-500 hover:border-neutral-400 rounded p-3 text-sm font-mono text-neutral-200 outline-none focus:border-primary-300`}
                                        />
                                        <p css={tw`mt-1 text-xs text-neutral-400`}>
                                            JSON representation of where log files are stored and whether the daemon should be creating custom logs.
                                        </p>
                                    </div>
                                </div>
                                <div css={tw`space-y-4`}>
                                    <div>
                                        <Label htmlFor={'configFiles'}>Configuration Files</Label>
                                        <textarea
                                            id={'configFiles'}
                                            name={'configFiles'}
                                            value={values.configFiles}
                                            onChange={(e) => setFieldValue('configFiles', e.target.value)}
                                            rows={6}
                                            css={tw`w-full bg-neutral-600 border-2 border-neutral-500 hover:border-neutral-400 rounded p-3 text-sm font-mono text-neutral-200 outline-none focus:border-primary-300`}
                                        />
                                        <p css={tw`mt-1 text-xs text-neutral-400`}>
                                            JSON representation of configuration files to modify and what parts should be changed.
                                        </p>
                                    </div>
                                    <div>
                                        <Label htmlFor={'configStartup'}>Start Configuration</Label>
                                        <textarea
                                            id={'configStartup'}
                                            name={'configStartup'}
                                            value={values.configStartup}
                                            onChange={(e) => setFieldValue('configStartup', e.target.value)}
                                            rows={6}
                                            css={tw`w-full bg-neutral-600 border-2 border-neutral-500 hover:border-neutral-400 rounded p-3 text-sm font-mono text-neutral-200 outline-none focus:border-primary-300`}
                                        />
                                        <p css={tw`mt-1 text-xs text-neutral-400`}>
                                            JSON representation of what values the daemon should be looking for when booting a server to determine completion.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </AdminBox>
                    </Form>
                )}
            </Formik>
            </>)}
        </AdminLayout>
    );
};

export default NewEggContainer;
