import React from 'react';
import { useHistory } from 'react-router-dom';
import AdminLayout from '@/components/admin/AdminLayout';
import TitledGreyBox from '@/components/elements/TitledGreyBox';
import tw from 'twin.macro';
import Field from '@/components/elements/Field';
import Button from '@/components/elements/Button';
import { Formik, Form } from 'formik';
import { object, string, boolean } from 'yup';
import useFlash from '@/plugins/useFlash';
import FlashMessageRender from '@/components/FlashMessageRender';
import { createUser } from '@/api/admin/users';
import SpinnerOverlay from '@/components/elements/SpinnerOverlay';

interface FormValues {
    email: string;
    username: string;
    firstName: string;
    lastName: string;
    password: string;
    rootAdmin: boolean;
}

export default () => {
    const history = useHistory();
    const { clearFlashes, clearAndAddHttpError } = useFlash();

    const schema = object().shape({
        email: string().email('Must be a valid email address.').required('Email is required.'),
        username: string().min(1).max(255).required('Username is required.'),
        firstName: string().min(1).max(255).required('First name is required.'),
        lastName: string().min(1).max(255).required('Last name is required.'),
        password: string().min(8, 'Password must be at least 8 characters.').optional(),
    });

    const handleSubmit = (values: FormValues, { setSubmitting }: { setSubmitting: (v: boolean) => void }) => {
        clearFlashes('admin:user:new');

        const data: any = {
            email: values.email,
            username: values.username,
            first_name: values.firstName,
            last_name: values.lastName,
            root_admin: values.rootAdmin,
        };

        if (values.password) {
            data.password = values.password;
        }

        createUser(data)
            .then((user) => {
                history.push(`/admin/users/${user.id}`);
            })
            .catch((error) => {
                clearAndAddHttpError({ key: 'admin:user:new', error });
                setSubmitting(false);
            });
    };

    return (
        <AdminLayout title={'Create User'} subtitle={'Add a new user account to the panel.'} showFlashKey={'admin:user:new'} breadcrumbs={[{ label: 'Admin', to: '/admin' }, { label: 'Users', to: '/admin/users' }, { label: 'New User' }]}>
            <Formik
                initialValues={{
                    email: '',
                    username: '',
                    firstName: '',
                    lastName: '',
                    password: '',
                    rootAdmin: false,
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
                                    <div css={tw`grid grid-cols-2 gap-4`}>
                                        <Field id={'firstName'} name={'firstName'} label={'First Name'} />
                                        <Field id={'lastName'} name={'lastName'} label={'Last Name'} />
                                    </div>
                                </div>
                            </TitledGreyBox>
                            <div css={tw`flex flex-col gap-4`}>
                                <TitledGreyBox title={'Password'}>
                                    <div css={tw`relative`}>
                                        <SpinnerOverlay visible={isSubmitting} />
                                        <Field
                                            id={'password'}
                                            name={'password'}
                                            label={'Password'}
                                            type={'password'}
                                            description={'Leave blank to send the user a setup email. Must be at least 8 characters if set.'}
                                            autoComplete={'new-password'}
                                        />
                                    </div>
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
                        <div css={tw`mt-6 flex justify-end`}>
                            <Button type={'submit'} color={'primary'} isLoading={isSubmitting} disabled={isSubmitting}>
                                Create User
                            </Button>
                        </div>
                    </Form>
                )}
            </Formik>
        </AdminLayout>
    );
};
