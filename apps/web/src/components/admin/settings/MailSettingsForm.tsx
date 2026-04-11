import { Form, Formik, type FormikHelpers } from 'formik';
import { useEffect, useRef, useState } from 'react';
import tw from 'twin.macro';
import { object, string } from 'yup';
import { getSettings, type PanelSettings, sendTestMail, updateSettings } from '@/api/admin/settings';
import AdminBox from '@/components/admin/AdminBox';
import Button from '@/components/elements/Button';
import Field from '@/components/elements/Field';
import Label from '@/components/elements/Label';
import Select from '@/components/elements/Select';
import Spinner from '@/components/elements/Spinner';
import useFlash from '@/plugins/useFlash';

interface FormValues {
    mailHost: string;
    mailPort: string;
    mailEncryption: '' | 'tls' | 'ssl';
    mailUsername: string;
    mailPassword: string;
    mailFromAddress: string;
    mailFromName: string;
}

const MailSettingsForm = () => {
    const { addFlash, clearFlashes } = useFlash();
    const [loading, setLoading] = useState(true);
    const [initialValues, setInitialValues] = useState<FormValues | null>(null);
    const sendTestAfterSave = useRef(false);

    useEffect(() => {
        getSettings()
            .then((settings) => {
                setInitialValues({
                    mailHost: settings['mail:mailers:smtp:host'] || '',
                    mailPort: settings['mail:mailers:smtp:port'] || '587',
                    mailEncryption: ((settings['mail:mailers:smtp:encryption'] as '' | 'tls' | 'ssl') || 'tls'),
                    mailUsername: settings['mail:mailers:smtp:username'] || '',
                    mailPassword: '',
                    mailFromAddress: settings['mail:from:address'] || '',
                    mailFromName: settings['mail:from:name'] || '',
                });
                setLoading(false);
            })
            .catch(() => {
                addFlash({ key: 'admin:settings', type: 'error', message: 'Failed to load settings.' });
                setLoading(false);
            });
    }, [addFlash]);

    const schema = object().shape({
        mailHost: string().required('SMTP host is required.').max(191),
        mailPort: string()
            .required('SMTP port is required.')
            .matches(/^\d+$/, 'Port must be numeric.'),
        mailEncryption: string().oneOf(['', 'tls', 'ssl']),
        mailUsername: string().max(191),
        mailPassword: string().max(191),
        mailFromAddress: string().required('Mail from address is required.').email().max(191),
        mailFromName: string().max(191),
    });

    const handleSubmit = (values: FormValues, helpers: FormikHelpers<FormValues>) => {
        clearFlashes('admin:settings');
        const payload: PanelSettings = {
            'mail:mailers:smtp:host': values.mailHost,
            'mail:mailers:smtp:port': values.mailPort,
            'mail:mailers:smtp:encryption': values.mailEncryption,
            'mail:mailers:smtp:username': values.mailUsername,
            'mail:from:address': values.mailFromAddress,
            'mail:from:name': values.mailFromName,
        };
        if (values.mailPassword) {
            payload['mail:mailers:smtp:password'] = values.mailPassword;
        }

        const shouldTest = sendTestAfterSave.current;
        sendTestAfterSave.current = false;

        updateSettings(payload)
            .then(async () => {
                addFlash({
                    key: 'admin:settings',
                    type: 'success',
                    message: 'Mail settings have been saved successfully.',
                });
                // Clear the password field after a successful save so the
                // "leave blank to keep current" convention is obvious on
                // subsequent edits.
                helpers.setFieldValue('mailPassword', '');

                if (shouldTest) {
                    try {
                        await sendTestMail();
                        addFlash({
                            key: 'admin:settings',
                            type: 'success',
                            message: 'Test message sent successfully. Check your inbox.',
                        });
                    } catch (err: any) {
                        const message =
                            err?.response?.data?.error ??
                            err?.message ??
                            'Failed to send test message.';
                        addFlash({
                            key: 'admin:settings',
                            type: 'error',
                            title: 'Test failed',
                            message,
                        });
                    }
                }
            })
            .catch(() =>
                addFlash({ key: 'admin:settings', type: 'error', message: 'Failed to save mail settings.' }),
            )
            .finally(() => helpers.setSubmitting(false));
    };

    if (loading || !initialValues) {
        return <Spinner centered />;
    }

    return (
        <Formik initialValues={initialValues} validationSchema={schema} onSubmit={handleSubmit}>
            {({ values, setFieldValue, isSubmitting, submitForm }) => (
                <Form>
                    <AdminBox
                        title={'Email Settings'}
                        footer={
                            <div css={tw`flex justify-end gap-2`}>
                                <Button
                                    type={'button'}
                                    color={'grey'}
                                    size={'xsmall'}
                                    disabled={isSubmitting}
                                    onClick={() => {
                                        sendTestAfterSave.current = true;
                                        submitForm();
                                    }}
                                >
                                    Save and Send Test
                                </Button>
                                <Button type={'submit'} color={'primary'} size={'xsmall'} disabled={isSubmitting}>
                                    Save
                                </Button>
                            </div>
                        }
                    >
                        <div css={tw`grid grid-cols-1 md:grid-cols-3 gap-4`}>
                            <Field
                                id={'mailHost'}
                                name={'mailHost'}
                                label={'SMTP Host'}
                                description={'Enter the SMTP server address that mail should be sent through.'}
                            />
                            <Field
                                id={'mailPort'}
                                name={'mailPort'}
                                label={'SMTP Port'}
                                description={'Enter the SMTP server port that mail should be sent through.'}
                            />
                            <div>
                                <Label htmlFor={'mailEncryption'}>Encryption</Label>
                                <Select
                                    id={'mailEncryption'}
                                    name={'mailEncryption'}
                                    value={values.mailEncryption}
                                    onChange={(e) =>
                                        setFieldValue('mailEncryption', e.target.value as '' | 'tls' | 'ssl')
                                    }
                                >
                                    <option value={''}>None</option>
                                    <option value={'tls'}>Transport Layer Security (TLS)</option>
                                    <option value={'ssl'}>Secure Sockets Layer (SSL)</option>
                                </Select>
                                <p css={tw`mt-1 text-xs text-neutral-400`}>
                                    Select the type of encryption to use when sending mail.
                                </p>
                            </div>
                            <Field
                                id={'mailUsername'}
                                name={'mailUsername'}
                                label={'Username'}
                                description={'The username to use when connecting to the SMTP server.'}
                            />
                            <Field
                                id={'mailPassword'}
                                name={'mailPassword'}
                                label={'Password'}
                                type={'password'}
                                description={
                                    'Leave blank to continue using the existing password. Enter !e to set the password to an empty value.'
                                }
                            />
                            <Field
                                id={'mailFromAddress'}
                                name={'mailFromAddress'}
                                label={'Mail From'}
                                description={'Email address that all outgoing emails will originate from.'}
                            />
                            <Field
                                id={'mailFromName'}
                                name={'mailFromName'}
                                label={'Mail From Name'}
                                description={'The name that emails should appear to come from.'}
                            />
                        </div>
                    </AdminBox>
                </Form>
            )}
        </Formik>
    );
};

export default MailSettingsForm;
