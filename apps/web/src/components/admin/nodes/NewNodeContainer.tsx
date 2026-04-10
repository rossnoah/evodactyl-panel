import React from 'react';
import { useHistory } from 'react-router-dom';
import { Form, Formik, FormikHelpers } from 'formik';
import * as Yup from 'yup';
import tw from 'twin.macro';
import useSWR from 'swr';
import { createNode } from '@/api/admin/nodes';
import { getLocations, AdminLocation } from '@/api/admin/locations';
import AdminLayout from '@/components/admin/AdminLayout';
import Field from '@/components/elements/Field';
import Button from '@/components/elements/Button';
import FormikSwitch from '@/components/elements/FormikSwitch';
import Label from '@/components/elements/Label';
import Select from '@/components/elements/Select';
import SpinnerOverlay from '@/components/elements/SpinnerOverlay';
import useFlash from '@/plugins/useFlash';
import { Field as FormikField, FieldProps } from 'formik';

interface Values {
    name: string;
    description: string;
    locationId: number;
    fqdn: string;
    scheme: string;
    behindProxy: boolean;
    memory: number;
    memoryOverallocate: number;
    disk: number;
    diskOverallocate: number;
    uploadSize: number;
    daemonListen: number;
    daemonSftp: number;
    daemonBase: string;
}

const schema = Yup.object().shape({
    name: Yup.string().required('A node name is required.').min(1).max(255),
    description: Yup.string().max(255).nullable(),
    locationId: Yup.number().required('A location must be selected.').min(1, 'A location must be selected.'),
    fqdn: Yup.string().required('A FQDN or IP address is required.'),
    scheme: Yup.string().required().oneOf(['http', 'https']),
    memory: Yup.number().required().min(1, 'Memory must be at least 1 MB.'),
    memoryOverallocate: Yup.number().required().min(-1),
    disk: Yup.number().required().min(1, 'Disk must be at least 1 MB.'),
    diskOverallocate: Yup.number().required().min(-1),
    uploadSize: Yup.number().required().min(1).max(1024),
    daemonListen: Yup.number().required().min(1).max(65535),
    daemonSftp: Yup.number().required().min(1).max(65535),
    daemonBase: Yup.string().required(),
});

const NewNodeContainer = () => {
    const history = useHistory();
    const { addFlash, clearFlashes, clearAndAddHttpError } = useFlash();
    const { data: locations } = useSWR<AdminLocation[]>('/api/application/locations', () =>
        getLocations().then((result) => result.items),
    );

    const submit = (values: Values, { setSubmitting }: FormikHelpers<Values>) => {
        clearFlashes('admin:nodes:new');

        createNode({
            name: values.name,
            description: values.description || null,
            location_id: values.locationId,
            fqdn: values.fqdn,
            scheme: values.scheme,
            behind_proxy: values.behindProxy,
            memory: values.memory,
            memory_overallocate: values.memoryOverallocate,
            disk: values.disk,
            disk_overallocate: values.diskOverallocate,
            upload_size: values.uploadSize,
            daemon_listen: values.daemonListen,
            daemon_sftp: values.daemonSftp,
            daemon_base: values.daemonBase,
        })
            .then((node) => {
                addFlash({ key: 'admin:nodes', type: 'success', message: 'Node created successfully.' });
                history.push(`/admin/nodes/${node.id}`);
            })
            .catch((error) => {
                setSubmitting(false);
                clearAndAddHttpError({ key: 'admin:nodes:new', error });
            });
    };

    return (
        <AdminLayout title={'Create Node'} subtitle={'Add a new node to the panel.'} showFlashKey={'admin:nodes:new'} breadcrumbs={[{ label: 'Admin', to: '/admin' }, { label: 'Nodes', to: '/admin/nodes' }, { label: 'New Node' }]}>
            <Formik<Values>
                initialValues={{
                    name: '',
                    description: '',
                    locationId: 0,
                    fqdn: '',
                    scheme: 'https',
                    behindProxy: false,
                    memory: 1024,
                    memoryOverallocate: 0,
                    disk: 5120,
                    diskOverallocate: 0,
                    uploadSize: 100,
                    daemonListen: 8080,
                    daemonSftp: 2022,
                    daemonBase: '/var/lib/pterodactyl/volumes',
                }}
                validationSchema={schema}
                onSubmit={submit}
            >
                {({ isSubmitting }) => (
                    <Form>
                        <SpinnerOverlay visible={isSubmitting} />

                        <div css={tw`grid grid-cols-1 md:grid-cols-2 gap-6`}>
                            <div css={tw`bg-neutral-700 rounded shadow-md p-6`}>
                                <h3 css={tw`text-lg mb-4`}>Basic Details</h3>
                                <div css={tw`mb-4`}>
                                    <Field name={'name'} label={'Name'} />
                                </div>
                                <div css={tw`mb-4`}>
                                    <Field name={'description'} label={'Description'} />
                                </div>
                                <div css={tw`mb-4`}>
                                    <FormikField name={'locationId'}>
                                        {({ field, form }: FieldProps) => (
                                            <div>
                                                <Label>Location</Label>
                                                <Select
                                                    {...field}
                                                    onChange={(e) => form.setFieldValue('locationId', Number(e.target.value))}
                                                >
                                                    <option value={0}>Select a location...</option>
                                                    {locations?.map((loc) => (
                                                        <option key={loc.id} value={loc.id}>
                                                            {loc.short} &mdash; {loc.long}
                                                        </option>
                                                    ))}
                                                </Select>
                                            </div>
                                        )}
                                    </FormikField>
                                </div>
                                <div css={tw`mb-4`}>
                                    <Field name={'fqdn'} label={'FQDN'} description={'The fully qualified domain name or IP used to connect to this node.'} />
                                </div>
                                <div css={tw`mb-4`}>
                                    <FormikSwitch name={'behindProxy'} label={'Behind Proxy'} description={'If running behind a proxy such as Cloudflare, select this to skip SSL certificate verification.'} />
                                </div>
                            </div>

                            <div css={tw`bg-neutral-700 rounded shadow-md p-6`}>
                                <h3 css={tw`text-lg mb-4`}>Configuration</h3>
                                <div css={tw`mb-4`}>
                                    <FormikField name={'scheme'}>
                                        {({ field, form }: FieldProps) => (
                                            <div>
                                                <Label>SSL Communication</Label>
                                                <Select
                                                    {...field}
                                                    onChange={(e) => form.setFieldValue('scheme', e.target.value)}
                                                >
                                                    <option value={'https'}>Use SSL Connection (https)</option>
                                                    <option value={'http'}>Use HTTP Connection (http)</option>
                                                </Select>
                                            </div>
                                        )}
                                    </FormikField>
                                </div>
                                <div css={tw`grid grid-cols-2 gap-4 mb-4`}>
                                    <Field name={'memory'} label={'Memory (MB)'} type={'number'} />
                                    <Field name={'memoryOverallocate'} label={'Memory Over-Allocate (%)'} type={'number'} description={'-1 to disable checking.'} />
                                </div>
                                <div css={tw`grid grid-cols-2 gap-4 mb-4`}>
                                    <Field name={'disk'} label={'Disk (MB)'} type={'number'} />
                                    <Field name={'diskOverallocate'} label={'Disk Over-Allocate (%)'} type={'number'} description={'-1 to disable checking.'} />
                                </div>
                                <div css={tw`mb-4`}>
                                    <Field name={'uploadSize'} label={'Upload Size (MB)'} type={'number'} description={'Max upload file size via web file manager.'} />
                                </div>
                                <div css={tw`grid grid-cols-2 gap-4 mb-4`}>
                                    <Field name={'daemonListen'} label={'Daemon Port'} type={'number'} />
                                    <Field name={'daemonSftp'} label={'SFTP Port'} type={'number'} />
                                </div>
                                <div css={tw`mb-4`}>
                                    <Field name={'daemonBase'} label={'Data Directory'} description={'The directory where server files will be stored.'} />
                                </div>
                            </div>
                        </div>

                        <div css={tw`mt-6 flex justify-end`}>
                            <Button type={'submit'} color={'green'} size={'large'}>
                                Create Node
                            </Button>
                        </div>
                    </Form>
                )}
            </Formik>
        </AdminLayout>
    );
};

export default NewNodeContainer;
