import React, { useState } from 'react';
import { useHistory } from 'react-router-dom';
import { Form, Formik, FormikHelpers, Field as FormikField, FieldProps } from 'formik';
import * as Yup from 'yup';
import tw from 'twin.macro';
import useSWR from 'swr';
import { Node, updateNode, deleteNode } from '@/api/admin/nodes';
import { AdminLocation, getLocations } from '@/api/admin/locations';
import FlashMessageRender from '@/components/FlashMessageRender';
import Field from '@/components/elements/Field';
import Button from '@/components/elements/Button';
import FormikSwitch from '@/components/elements/FormikSwitch';
import Label from '@/components/elements/Label';
import Select from '@/components/elements/Select';
import SpinnerOverlay from '@/components/elements/SpinnerOverlay';
import ConfirmationModal from '@/components/elements/ConfirmationModal';
import useFlash from '@/plugins/useFlash';

interface Props {
    node: Node;
    mutate: () => void;
}

interface Values {
    name: string;
    description: string;
    locationId: number;
    fqdn: string;
    scheme: string;
    behindProxy: boolean;
    maintenanceMode: boolean;
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
    name: Yup.string().required().min(1).max(255),
    locationId: Yup.number().required().min(1),
    fqdn: Yup.string().required(),
    scheme: Yup.string().required().oneOf(['http', 'https']),
    memory: Yup.number().required().min(1),
    memoryOverallocate: Yup.number().required().min(-1),
    disk: Yup.number().required().min(1),
    diskOverallocate: Yup.number().required().min(-1),
    uploadSize: Yup.number().required().min(1).max(1024),
    daemonListen: Yup.number().required().min(1).max(65535),
    daemonSftp: Yup.number().required().min(1).max(65535),
    daemonBase: Yup.string().required(),
});

const NodeSettings = ({ node, mutate }: Props) => {
    const history = useHistory();
    const { addFlash, clearFlashes, clearAndAddHttpError } = useFlash();
    const { data: locations } = useSWR<AdminLocation[]>('/api/application/locations', () =>
        getLocations().then((result) => result.items),
    );
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const submit = (values: Values, { setSubmitting }: FormikHelpers<Values>) => {
        clearFlashes('admin:node:settings');

        updateNode(node.id, {
            name: values.name,
            description: values.description || null,
            location_id: values.locationId,
            fqdn: values.fqdn,
            scheme: values.scheme,
            behind_proxy: values.behindProxy,
            maintenance_mode: values.maintenanceMode,
            memory: values.memory,
            memory_overallocate: values.memoryOverallocate,
            disk: values.disk,
            disk_overallocate: values.diskOverallocate,
            upload_size: values.uploadSize,
            daemon_listen: values.daemonListen,
            daemon_sftp: values.daemonSftp,
            daemon_base: values.daemonBase,
        })
            .then(() => {
                mutate();
                addFlash({ key: 'admin:node:settings', type: 'success', message: 'Node settings updated.' });
            })
            .catch((error) => {
                clearAndAddHttpError({ key: 'admin:node:settings', error });
            })
            .finally(() => setSubmitting(false));
    };

    const handleDelete = () => {
        setDeleting(true);
        clearFlashes('admin:node:settings');

        deleteNode(node.id)
            .then(() => {
                addFlash({ key: 'admin:nodes', type: 'success', message: 'Node has been deleted.' });
                history.push('/admin/nodes');
            })
            .catch((error) => {
                setDeleting(false);
                setShowDeleteModal(false);
                clearAndAddHttpError({ key: 'admin:node:settings', error });
            });
    };

    return (
        <>
            <FlashMessageRender byKey={'admin:node:settings'} css={tw`mb-4`} />
            <ConfirmationModal
                visible={showDeleteModal}
                title={'Delete Node'}
                buttonText={'Yes, Delete'}
                onConfirmed={handleDelete}
                showSpinnerOverlay={deleting}
                onModalDismissed={() => setShowDeleteModal(false)}
            >
                Are you sure you want to delete this node? This action cannot be undone and any servers on this node must
                be removed first.
            </ConfirmationModal>

            <Formik<Values>
                initialValues={{
                    name: node.name,
                    description: node.description || '',
                    locationId: node.locationId,
                    fqdn: node.fqdn,
                    scheme: node.scheme,
                    behindProxy: node.behindProxy,
                    maintenanceMode: node.maintenanceMode,
                    memory: node.memory,
                    memoryOverallocate: node.memoryOverallocate,
                    disk: node.disk,
                    diskOverallocate: node.diskOverallocate,
                    uploadSize: node.uploadSize,
                    daemonListen: node.daemonListen,
                    daemonSftp: node.daemonSftp,
                    daemonBase: node.daemonBase,
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
                                    <Field name={'fqdn'} label={'FQDN'} />
                                </div>
                                <div css={tw`mb-4`}>
                                    <FormikSwitch name={'behindProxy'} label={'Behind Proxy'} />
                                </div>
                                <div css={tw`mb-4`}>
                                    <FormikSwitch name={'maintenanceMode'} label={'Maintenance Mode'} description={'If enabled, no servers can be started on this node.'} />
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
                                                    <option value={'https'}>Use SSL (https)</option>
                                                    <option value={'http'}>Use HTTP (http)</option>
                                                </Select>
                                            </div>
                                        )}
                                    </FormikField>
                                </div>
                                <div css={tw`grid grid-cols-2 gap-4 mb-4`}>
                                    <Field name={'memory'} label={'Memory (MB)'} type={'number'} />
                                    <Field name={'memoryOverallocate'} label={'Over-Allocate (%)'} type={'number'} />
                                </div>
                                <div css={tw`grid grid-cols-2 gap-4 mb-4`}>
                                    <Field name={'disk'} label={'Disk (MB)'} type={'number'} />
                                    <Field name={'diskOverallocate'} label={'Over-Allocate (%)'} type={'number'} />
                                </div>
                                <div css={tw`mb-4`}>
                                    <Field name={'uploadSize'} label={'Upload Size (MB)'} type={'number'} />
                                </div>
                                <div css={tw`grid grid-cols-2 gap-4 mb-4`}>
                                    <Field name={'daemonListen'} label={'Daemon Port'} type={'number'} />
                                    <Field name={'daemonSftp'} label={'SFTP Port'} type={'number'} />
                                </div>
                                <div css={tw`mb-4`}>
                                    <Field name={'daemonBase'} label={'Data Directory'} />
                                </div>
                            </div>
                        </div>

                        <div css={tw`mt-6 flex justify-between`}>
                            <Button type={'button'} color={'red'} isSecondary onClick={() => setShowDeleteModal(true)}>
                                Delete Node
                            </Button>
                            <Button type={'submit'} color={'green'} size={'large'}>
                                Save Changes
                            </Button>
                        </div>
                    </Form>
                )}
            </Formik>
        </>
    );
};

export default NodeSettings;
