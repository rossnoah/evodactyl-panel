import React, { useEffect, useState } from 'react';
import { useParams, useHistory } from 'react-router-dom';
import AdminLayout from '@/components/admin/AdminLayout';
import TitledGreyBox from '@/components/elements/TitledGreyBox';
import Spinner from '@/components/elements/Spinner';
import tw from 'twin.macro';
import Field from '@/components/elements/Field';
import Button from '@/components/elements/Button';
import Label from '@/components/elements/Label';
import Select from '@/components/elements/Select';
import { Formik, Form } from 'formik';
import { object, string, boolean } from 'yup';
import useFlash from '@/plugins/useFlash';
import FlashMessageRender from '@/components/FlashMessageRender';
import { AdminUser, getUser, updateUser, deleteUser } from '@/api/admin/users';
import { httpErrorToHuman } from '@/api/http';
import ConfirmationModal from '@/components/elements/ConfirmationModal';
import SpinnerOverlay from '@/components/elements/SpinnerOverlay';

interface FormValues {
    email: string;
    username: string;
    firstName: string;
    lastName: string;
    language: string;
    password: string;
    rootAdmin: boolean;
}

export default () => {
    const { id } = useParams<{ id: string }>();
    const history = useHistory();
    const { addFlash, clearFlashes, clearAndAddHttpError } = useFlash();

    const [user, setUser] = useState<AdminUser | null>(null);
    const [loading, setLoading] = useState(true);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        clearFlashes('admin:user');
        getUser(Number(id))
            .then((data) => {
                setUser(data);
                setLoading(false);
            })
            .catch((error) => {
                clearAndAddHttpError({ key: 'admin:user', error });
                setLoading(false);
            });
    }, [id]);

    if (loading) {
        return (
            <AdminLayout title={'Loading...'} breadcrumbs={[{ label: 'Admin', to: '/admin' }, { label: 'Users', to: '/admin/users' }, { label: 'Loading...' }]}>
                <Spinner centered size={'large'} />
            </AdminLayout>
        );
    }

    if (!user) {
        return (
            <AdminLayout title={'User Not Found'} showFlashKey={'admin:user'} breadcrumbs={[{ label: 'Admin', to: '/admin' }, { label: 'Users', to: '/admin/users' }, { label: 'Not Found' }]}>
                <p css={tw`text-center text-neutral-400`}>User could not be loaded.</p>
            </AdminLayout>
        );
    }

    const schema = object().shape({
        email: string().email('Must be a valid email address.').required('Email is required.'),
        username: string().min(1).max(255).required('Username is required.'),
        firstName: string().min(1).max(255).required('First name is required.'),
        lastName: string().min(1).max(255).required('Last name is required.'),
        language: string().required(),
        password: string().min(8, 'Password must be at least 8 characters.').optional(),
    });

    const handleSubmit = (values: FormValues, { setSubmitting }: { setSubmitting: (v: boolean) => void }) => {
        clearFlashes('admin:user');

        const data: any = {
            email: values.email,
            username: values.username,
            first_name: values.firstName,
            last_name: values.lastName,
            language: values.language,
            root_admin: values.rootAdmin,
        };

        if (values.password) {
            data.password = values.password;
        }

        updateUser(Number(id), data)
            .then((updated) => {
                setUser(updated);
                addFlash({
                    key: 'admin:user',
                    type: 'success',
                    title: 'Success',
                    message: 'User has been updated successfully.',
                });
            })
            .catch((error) => {
                clearAndAddHttpError({ key: 'admin:user', error });
            })
            .finally(() => setSubmitting(false));
    };

    const handleDelete = () => {
        setDeleting(true);
        clearFlashes('admin:user');

        deleteUser(Number(id))
            .then(() => {
                history.push('/admin/users');
            })
            .catch((error) => {
                clearAndAddHttpError({ key: 'admin:user', error });
                setShowDeleteModal(false);
                setDeleting(false);
            });
    };

    return (
        <AdminLayout title={`Edit User: ${user.username}`} subtitle={`User ID: ${user.id}`} showFlashKey={'admin:user'} breadcrumbs={[{ label: 'Admin', to: '/admin' }, { label: 'Users', to: '/admin/users' }, { label: user.username }]}>
            <ConfirmationModal
                visible={showDeleteModal}
                title={'Delete User'}
                buttonText={'Yes, Delete User'}
                onConfirmed={handleDelete}
                showSpinnerOverlay={deleting}
                onModalDismissed={() => setShowDeleteModal(false)}
            >
                Are you sure you want to delete this user? This action is permanent and cannot be undone.
                All servers owned by this user will need to be transferred or deleted first.
            </ConfirmationModal>
            <Formik
                initialValues={{
                    email: user.email,
                    username: user.username,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    language: user.language,
                    password: '',
                    rootAdmin: user.rootAdmin,
                } as FormValues}
                validationSchema={schema}
                onSubmit={handleSubmit}
            >
                {({ values, setFieldValue, isSubmitting }) => (
                    <Form>
                        <div css={tw`grid grid-cols-1 lg:grid-cols-2 gap-4`}>
                            <TitledGreyBox title={'Identity'}>
                                <div css={tw`relative`}>
                                    <SpinnerOverlay visible={isSubmitting} />
                                    <div css={tw`mb-4`}>
                                        <Field id={'email'} name={'email'} label={'Email'} type={'email'} />
                                    </div>
                                    <div css={tw`mb-4`}>
                                        <Field id={'username'} name={'username'} label={'Username'} />
                                    </div>
                                    <div css={tw`grid grid-cols-2 gap-4 mb-4`}>
                                        <Field id={'firstName'} name={'firstName'} label={'First Name'} />
                                        <Field id={'lastName'} name={'lastName'} label={'Last Name'} />
                                    </div>
                                    <div>
                                        <Label htmlFor={'language'}>Language</Label>
                                        <Select
                                            id={'language'}
                                            name={'language'}
                                            value={values.language}
                                            onChange={(e) => setFieldValue('language', e.target.value)}
                                        >
                                            <option value={'en'}>English</option>
                                            <option value={'de'}>Deutsch</option>
                                            <option value={'es'}>Espa&#241;ol</option>
                                            <option value={'fr'}>Fran&#231;ais</option>
                                            <option value={'pt'}>Portugu&#234;s</option>
                                            <option value={'ru'}>&#1056;&#1091;&#1089;&#1089;&#1082;&#1080;&#1081;</option>
                                            <option value={'zh'}>&#20013;&#25991;</option>
                                        </Select>
                                    </div>
                                </div>
                            </TitledGreyBox>
                            <div css={tw`flex flex-col gap-4`}>
                                <TitledGreyBox title={'Password'}>
                                    <Field
                                        id={'password'}
                                        name={'password'}
                                        label={'New Password'}
                                        type={'password'}
                                        description={'Leave blank to keep the current password.'}
                                        autoComplete={'new-password'}
                                    />
                                </TitledGreyBox>
                                <TitledGreyBox title={'Permissions'}>
                                    <div css={tw`flex items-center justify-between`}>
                                        <div>
                                            <p css={tw`text-sm text-neutral-100`}>Administrator</p>
                                            <p css={tw`text-xs text-neutral-400 mt-1`}>
                                                Grant this user full administrative access to the panel.
                                            </p>
                                        </div>
                                        <label css={tw`relative inline-flex items-center cursor-pointer`}>
                                            <input
                                                type={'checkbox'}
                                                checked={values.rootAdmin}
                                                onChange={(e) => setFieldValue('rootAdmin', e.target.checked)}
                                                css={tw`w-5 h-5`}
                                            />
                                        </label>
                                    </div>
                                </TitledGreyBox>
                            </div>
                        </div>
                        <div css={tw`mt-6 flex justify-between`}>
                            <Button color={'red'} type={'button'} onClick={() => setShowDeleteModal(true)}>
                                Delete User
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
