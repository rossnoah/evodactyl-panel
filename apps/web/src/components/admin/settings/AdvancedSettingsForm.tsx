import { Form, Formik } from 'formik';
import { useEffect, useState } from 'react';
import tw from 'twin.macro';
import { object, string } from 'yup';
import { getSettings, type PanelSettings, updateSettings } from '@/api/admin/settings';
import AdminBox from '@/components/admin/AdminBox';
import Button from '@/components/elements/Button';
import Field from '@/components/elements/Field';
import Label from '@/components/elements/Label';
import Select from '@/components/elements/Select';
import Spinner from '@/components/elements/Spinner';
import useFlash from '@/plugins/useFlash';

interface FormValues {
    recaptchaEnabled: 'true' | 'false';
    recaptchaWebsiteKey: string;
    recaptchaSecretKey: string;
    guzzleConnectTimeout: string;
    guzzleTimeout: string;
    allocationsEnabled: 'true' | 'false';
    allocationsRangeStart: string;
    allocationsRangeEnd: string;
}

const SHIPPED_RECAPTCHA_SITE_KEY = '6LcJcjwUAAAAAO_Xqjrtj9wWufUpYRnK6BW8lnfn';

const portString = (label: string) =>
    string()
        .matches(/^\d*$/, `${label} must be numeric.`)
        .test('range', `${label} must be between 1024 and 65535.`, (value) => {
            if (!value) return true;
            const n = Number(value);
            return n >= 1024 && n <= 65535;
        });

const AdvancedSettingsForm = () => {
    const { addFlash, clearFlashes } = useFlash();
    const [loading, setLoading] = useState(true);
    const [initialValues, setInitialValues] = useState<FormValues | null>(null);

    useEffect(() => {
        getSettings()
            .then((settings) => {
                setInitialValues({
                    recaptchaEnabled: ((settings['recaptcha:enabled'] as 'true' | 'false') || 'false'),
                    recaptchaWebsiteKey: settings['recaptcha:website_key'] || '',
                    recaptchaSecretKey: '',
                    guzzleConnectTimeout: settings['pterodactyl:guzzle:connect_timeout'] || '5',
                    guzzleTimeout: settings['pterodactyl:guzzle:timeout'] || '15',
                    allocationsEnabled:
                        ((settings['pterodactyl:client_features:allocations:enabled'] as 'true' | 'false') ||
                            'false'),
                    allocationsRangeStart:
                        settings['pterodactyl:client_features:allocations:range_start'] || '',
                    allocationsRangeEnd: settings['pterodactyl:client_features:allocations:range_end'] || '',
                });
                setLoading(false);
            })
            .catch(() => {
                addFlash({ key: 'admin:settings', type: 'error', message: 'Failed to load settings.' });
                setLoading(false);
            });
    }, [addFlash]);

    const schema = object().shape({
        recaptchaEnabled: string().oneOf(['true', 'false']),
        recaptchaWebsiteKey: string()
            .max(191)
            .when('recaptchaEnabled', {
                is: 'true',
                then: (s) => s.required('Site key is required when reCAPTCHA is enabled.'),
            }),
        recaptchaSecretKey: string().max(191),
        guzzleConnectTimeout: string()
            .required('Connection timeout is required.')
            .matches(/^\d+$/, 'Connection timeout must be numeric.')
            .test('range', 'Connection timeout must be between 1 and 60.', (value) => {
                if (!value) return false;
                const n = Number(value);
                return n >= 1 && n <= 60;
            }),
        guzzleTimeout: string()
            .required('Request timeout is required.')
            .matches(/^\d+$/, 'Request timeout must be numeric.')
            .test('range', 'Request timeout must be between 1 and 60.', (value) => {
                if (!value) return false;
                const n = Number(value);
                return n >= 1 && n <= 60;
            }),
        allocationsEnabled: string().oneOf(['true', 'false']),
        allocationsRangeStart: portString('Starting port').when('allocationsEnabled', {
            is: 'true',
            then: (s) => s.required('Starting port is required when automatic allocation is enabled.'),
        }),
        allocationsRangeEnd: portString('Ending port').when('allocationsEnabled', {
            is: 'true',
            then: (s) =>
                s
                    .required('Ending port is required when automatic allocation is enabled.')
                    .test('gt', 'Ending port must be greater than starting port.', function (value) {
                        const start = this.parent.allocationsRangeStart;
                        if (!start || !value) return true;
                        return Number(value) > Number(start);
                    }),
        }),
    });

    const handleSubmit = (values: FormValues, { setSubmitting, setFieldValue }: any) => {
        clearFlashes('admin:settings');
        const payload: PanelSettings = {
            'recaptcha:enabled': values.recaptchaEnabled,
            'recaptcha:website_key': values.recaptchaWebsiteKey,
            'pterodactyl:guzzle:connect_timeout': values.guzzleConnectTimeout,
            'pterodactyl:guzzle:timeout': values.guzzleTimeout,
            'pterodactyl:client_features:allocations:enabled': values.allocationsEnabled,
        };
        if (values.recaptchaSecretKey) {
            payload['recaptcha:secret_key'] = values.recaptchaSecretKey;
        }
        if (values.allocationsEnabled === 'true') {
            payload['pterodactyl:client_features:allocations:range_start'] = values.allocationsRangeStart;
            payload['pterodactyl:client_features:allocations:range_end'] = values.allocationsRangeEnd;
        }

        updateSettings(payload)
            .then(() => {
                addFlash({
                    key: 'admin:settings',
                    type: 'success',
                    message: 'Advanced settings have been saved successfully.',
                });
                setFieldValue('recaptchaSecretKey', '');
            })
            .catch(() =>
                addFlash({
                    key: 'admin:settings',
                    type: 'error',
                    message: 'Failed to save advanced settings.',
                }),
            )
            .finally(() => setSubmitting(false));
    };

    if (loading || !initialValues) {
        return <Spinner centered />;
    }

    return (
        <Formik initialValues={initialValues} validationSchema={schema} onSubmit={handleSubmit}>
            {({ values, setFieldValue, isSubmitting }) => (
                <Form>
                    <AdminBox title={'reCAPTCHA'}>
                        <div css={tw`grid grid-cols-1 md:grid-cols-3 gap-4`}>
                            <div>
                                <Label htmlFor={'recaptchaEnabled'}>Status</Label>
                                <Select
                                    id={'recaptchaEnabled'}
                                    name={'recaptchaEnabled'}
                                    value={values.recaptchaEnabled}
                                    onChange={(e) =>
                                        setFieldValue('recaptchaEnabled', e.target.value as 'true' | 'false')
                                    }
                                >
                                    <option value={'true'}>Enabled</option>
                                    <option value={'false'}>Disabled</option>
                                </Select>
                                <p css={tw`mt-1 text-xs text-neutral-400`}>
                                    If enabled, login forms and password reset forms will do a silent captcha check
                                    and display a visible captcha if needed.
                                </p>
                            </div>
                            <Field
                                id={'recaptchaWebsiteKey'}
                                name={'recaptchaWebsiteKey'}
                                label={'Site Key'}
                            />
                            <Field
                                id={'recaptchaSecretKey'}
                                name={'recaptchaSecretKey'}
                                label={'Secret Key'}
                                type={'password'}
                                description={
                                    'Used for communication between your site and Google. Leave blank to keep the existing secret.'
                                }
                            />
                        </div>
                        {values.recaptchaWebsiteKey === SHIPPED_RECAPTCHA_SITE_KEY && (
                            <div
                                css={tw`mt-4 p-3 text-xs text-yellow-100 bg-yellow-800 border border-yellow-700 rounded`}
                            >
                                You are currently using reCAPTCHA keys that were shipped with this Panel. For
                                improved security it is recommended to{' '}
                                <a
                                    href={'https://www.google.com/recaptcha/admin'}
                                    target={'_blank'}
                                    rel={'noreferrer noopener'}
                                    css={tw`underline`}
                                >
                                    generate new invisible reCAPTCHA keys
                                </a>{' '}
                                that are tied specifically to your website.
                            </div>
                        )}
                    </AdminBox>

                    <AdminBox title={'HTTP Connections'} css={tw`mt-4`}>
                        <div css={tw`grid grid-cols-1 md:grid-cols-2 gap-4`}>
                            <Field
                                id={'guzzleConnectTimeout'}
                                name={'guzzleConnectTimeout'}
                                label={'Connection Timeout'}
                                description={
                                    'The amount of time in seconds to wait for a connection to be opened before throwing an error.'
                                }
                            />
                            <Field
                                id={'guzzleTimeout'}
                                name={'guzzleTimeout'}
                                label={'Request Timeout'}
                                description={
                                    'The amount of time in seconds to wait for a request to be completed before throwing an error.'
                                }
                            />
                        </div>
                    </AdminBox>

                    <AdminBox title={'Automatic Allocation Creation'} css={tw`mt-4`}>
                        <div css={tw`grid grid-cols-1 md:grid-cols-3 gap-4`}>
                            <div>
                                <Label htmlFor={'allocationsEnabled'}>Status</Label>
                                <Select
                                    id={'allocationsEnabled'}
                                    name={'allocationsEnabled'}
                                    value={values.allocationsEnabled}
                                    onChange={(e) =>
                                        setFieldValue('allocationsEnabled', e.target.value as 'true' | 'false')
                                    }
                                >
                                    <option value={'false'}>Disabled</option>
                                    <option value={'true'}>Enabled</option>
                                </Select>
                                <p css={tw`mt-1 text-xs text-neutral-400`}>
                                    If enabled users will have the option to automatically create new allocations
                                    for their server via the frontend.
                                </p>
                            </div>
                            <Field
                                id={'allocationsRangeStart'}
                                name={'allocationsRangeStart'}
                                label={'Starting Port'}
                                description={'The starting port in the range that can be automatically allocated.'}
                                disabled={values.allocationsEnabled !== 'true'}
                            />
                            <Field
                                id={'allocationsRangeEnd'}
                                name={'allocationsRangeEnd'}
                                label={'Ending Port'}
                                description={'The ending port in the range that can be automatically allocated.'}
                                disabled={values.allocationsEnabled !== 'true'}
                            />
                        </div>
                    </AdminBox>

                    <div css={tw`flex justify-end mt-4`}>
                        <Button type={'submit'} color={'primary'} size={'xsmall'} disabled={isSubmitting}>
                            Save
                        </Button>
                    </div>
                </Form>
            )}
        </Formik>
    );
};

export default AdvancedSettingsForm;
