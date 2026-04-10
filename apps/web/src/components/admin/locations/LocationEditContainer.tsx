import React, { useEffect, useState } from 'react';
import { useParams, useHistory } from 'react-router-dom';
import AdminLayout from '@/components/admin/AdminLayout';
import TitledGreyBox from '@/components/elements/TitledGreyBox';
import Spinner from '@/components/elements/Spinner';
import tw from 'twin.macro';
import Field from '@/components/elements/Field';
import Button from '@/components/elements/Button';
import { Formik, Form } from 'formik';
import { object, string } from 'yup';
import useFlash from '@/plugins/useFlash';
import FlashMessageRender from '@/components/FlashMessageRender';
import { AdminLocation, getLocation, updateLocation, deleteLocation } from '@/api/admin/locations';
import ConfirmationModal from '@/components/elements/ConfirmationModal';
import SpinnerOverlay from '@/components/elements/SpinnerOverlay';
import GreyRowBox from '@/components/elements/GreyRowBox';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faNetworkWired } from '@fortawesome/free-solid-svg-icons';

interface FormValues {
    short: string;
    long: string;
}

export default () => {
    const { id } = useParams<{ id: string }>();
    const history = useHistory();
    const { addFlash, clearFlashes, clearAndAddHttpError } = useFlash();

    const [location, setLocation] = useState<AdminLocation | null>(null);
    const [loading, setLoading] = useState(true);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        clearFlashes('admin:location');
        getLocation(Number(id))
            .then((data) => {
                setLocation(data);
                setLoading(false);
            })
            .catch((error) => {
                clearAndAddHttpError({ key: 'admin:location', error });
                setLoading(false);
            });
    }, [id]);

    if (loading) {
        return (
            <AdminLayout title={'Loading...'} breadcrumbs={[{ label: 'Admin', to: '/admin' }, { label: 'Locations', to: '/admin/locations' }, { label: 'Loading...' }]}>
                <Spinner centered size={'large'} />
            </AdminLayout>
        );
    }

    if (!location) {
        return (
            <AdminLayout title={'Location Not Found'} showFlashKey={'admin:location'} breadcrumbs={[{ label: 'Admin', to: '/admin' }, { label: 'Locations', to: '/admin/locations' }, { label: 'Not Found' }]}>
                <p css={tw`text-center text-neutral-400`}>Location could not be loaded.</p>
            </AdminLayout>
        );
    }

    const schema = object().shape({
        short: string().min(1).max(60).required('Short code is required.'),
        long: string().max(255).optional(),
    });

    const handleSubmit = (values: FormValues, { setSubmitting }: { setSubmitting: (v: boolean) => void }) => {
        clearFlashes('admin:location');

        updateLocation(Number(id), { short: values.short, long: values.long || undefined })
            .then((updated) => {
                setLocation(updated);
                addFlash({
                    key: 'admin:location',
                    type: 'success',
                    title: 'Success',
                    message: 'Location has been updated successfully.',
                });
            })
            .catch((error) => {
                clearAndAddHttpError({ key: 'admin:location', error });
            })
            .finally(() => setSubmitting(false));
    };

    const handleDelete = () => {
        setDeleting(true);
        clearFlashes('admin:location');

        deleteLocation(Number(id))
            .then(() => {
                history.push('/admin/locations');
            })
            .catch((error) => {
                clearAndAddHttpError({ key: 'admin:location', error });
                setShowDeleteModal(false);
                setDeleting(false);
            });
    };

    return (
        <AdminLayout title={`Edit Location: ${location.short}`} subtitle={`Location ID: ${location.id}`} showFlashKey={'admin:location'} breadcrumbs={[{ label: 'Admin', to: '/admin' }, { label: 'Locations', to: '/admin/locations' }, { label: location.short }]}>
            <ConfirmationModal
                visible={showDeleteModal}
                title={'Delete Location'}
                buttonText={'Yes, Delete Location'}
                onConfirmed={handleDelete}
                showSpinnerOverlay={deleting}
                onModalDismissed={() => setShowDeleteModal(false)}
            >
                Are you sure you want to delete this location? All nodes assigned to this location will need
                to be moved to a different location first.
            </ConfirmationModal>
            <Formik
                initialValues={{
                    short: location.short,
                    long: location.long || '',
                } as FormValues}
                validationSchema={schema}
                onSubmit={handleSubmit}
            >
                {({ isSubmitting }) => (
                    <Form>
                        <div css={tw`grid grid-cols-1 lg:grid-cols-2 gap-4`}>
                            <TitledGreyBox title={'Location Details'}>
                                <div css={tw`relative`}>
                                    <SpinnerOverlay visible={isSubmitting} />
                                    <div css={tw`mb-4`}>
                                        <Field
                                            id={'short'}
                                            name={'short'}
                                            label={'Short Code'}
                                            description={'A short identifier for this location (e.g. "us.east").'}
                                        />
                                    </div>
                                    <div>
                                        <Field
                                            id={'long'}
                                            name={'long'}
                                            label={'Description'}
                                            description={'An optional longer description of this location.'}
                                        />
                                    </div>
                                </div>
                            </TitledGreyBox>
                            <TitledGreyBox title={`Nodes (${location.nodes?.length ?? 0})`}>
                                {location.nodes && location.nodes.length > 0 ? (
                                    <div css={tw`flex flex-col gap-2`}>
                                        {location.nodes.map((node) => (
                                            <GreyRowBox key={node.id} $hoverable={false}>
                                                <FontAwesomeIcon icon={faNetworkWired} css={tw`text-neutral-400 mr-3`} />
                                                <div css={tw`flex-1`}>
                                                    <p css={tw`text-sm text-neutral-100`}>{node.name}</p>
                                                    <p css={tw`text-xs text-neutral-400`}>{node.fqdn}</p>
                                                </div>
                                                <div css={tw`text-xs text-neutral-400`}>
                                                    {node.memory} MB / {node.disk} MB
                                                </div>
                                            </GreyRowBox>
                                        ))}
                                    </div>
                                ) : (
                                    <p css={tw`text-sm text-neutral-400 text-center py-4`}>
                                        No nodes are assigned to this location.
                                    </p>
                                )}
                            </TitledGreyBox>
                        </div>
                        <div css={tw`mt-6 flex justify-between`}>
                            <Button color={'red'} type={'button'} onClick={() => setShowDeleteModal(true)}>
                                Delete Location
                            </Button>
                            <Button type={'submit'} color={'primary'} isLoading={isSubmitting} disabled={isSubmitting}>
                                Save Changes
                            </Button>
                        </div>
                    </Form>
                )}
            </Formik>
        </AdminLayout>
    );
};
