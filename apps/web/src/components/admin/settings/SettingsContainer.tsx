import React, { useEffect, useState } from 'react';
import tw from 'twin.macro';
import Field from '@/components/elements/Field';
import Button from '@/components/elements/Button';
import Select from '@/components/elements/Select';
import Label from '@/components/elements/Label';
import { Formik, Form } from 'formik';
import { object, string } from 'yup';
import useFlash from '@/plugins/useFlash';
import Spinner from '@/components/elements/Spinner';
import { getSettings, updateSettings, PanelSettings } from '@/api/admin/settings';
import AdminLayout from '@/components/admin/AdminLayout';
import AdminBox from '@/components/admin/AdminBox';

interface SettingsFormValues {
    companyName: string;
    twoFactorRequirement: string;
    defaultLanguage: string;
    mailHost: string;
    mailPort: string;
    mailEncryption: string;
    mailUsername: string;
    mailPassword: string;
    mailFromAddress: string;
    mailFromName: string;
}

const twoFactorMap: Record<string, string> = { not_required: '0', admin_only: '1', all_users: '2' };
const twoFactorReverseMap: Record<string, string> = { '0': 'not_required', '1': 'admin_only', '2': 'all_users' };

export default () => {
    const { addFlash, clearFlashes } = useFlash();
    const [loading, setLoading] = useState(true);
    const [initialValues, setInitialValues] = useState<SettingsFormValues | null>(null);

    useEffect(() => {
        getSettings()
            .then((settings) => {
                setInitialValues({
                    companyName: settings['app:name'] || 'Pterodactyl',
                    twoFactorRequirement: twoFactorReverseMap[settings['pterodactyl:auth:2fa_required'] || '0'] || 'not_required',
                    defaultLanguage: settings['app:locale'] || 'en',
                    mailHost: settings['mail:mailers:smtp:host'] || '',
                    mailPort: settings['mail:mailers:smtp:port'] || '587',
                    mailEncryption: settings['mail:mailers:smtp:encryption'] || 'tls',
                    mailUsername: settings['mail:mailers:smtp:username'] || '',
                    mailPassword: settings['mail:mailers:smtp:password'] || '',
                    mailFromAddress: settings['mail:from:address'] || '',
                    mailFromName: settings['mail:from:name'] || '',
                });
                setLoading(false);
            })
            .catch(() => {
                addFlash({ key: 'admin:settings', type: 'error', title: 'Error', message: 'Failed to load settings.' });
                setLoading(false);
            });
    }, []);

    const schema = object().shape({
        companyName: string().required('Company name is required.').min(1).max(255),
        twoFactorRequirement: string().required().oneOf(['not_required', 'admin_only', 'all_users']),
        defaultLanguage: string().required(),
    });

    const handleSubmit = (values: SettingsFormValues, { setSubmitting }: any) => {
        clearFlashes('admin:settings');
        const payload: PanelSettings = {
            'app:name': values.companyName,
            'app:locale': values.defaultLanguage,
            'pterodactyl:auth:2fa_required': twoFactorMap[values.twoFactorRequirement],
            'mail:mailers:smtp:host': values.mailHost,
            'mail:mailers:smtp:port': values.mailPort,
            'mail:mailers:smtp:encryption': values.mailEncryption,
            'mail:mailers:smtp:username': values.mailUsername,
            'mail:from:address': values.mailFromAddress,
            'mail:from:name': values.mailFromName,
        };
        if (values.mailPassword) payload['mail:mailers:smtp:password'] = values.mailPassword;

        updateSettings(payload)
            .then(() => addFlash({ key: 'admin:settings', type: 'success', message: 'Settings have been saved successfully.' }))
            .catch(() => addFlash({ key: 'admin:settings', type: 'error', message: 'Failed to save settings.' }))
            .finally(() => setSubmitting(false));
    };

    return (
        <AdminLayout
            title={'Settings'}
            subtitle={'Configure your panel.'}
            showFlashKey={'admin:settings'}
            breadcrumbs={[{ label: 'Admin', to: '/admin' }, { label: 'Settings' }]}
        >
            {(loading || !initialValues) ? <Spinner centered /> : (
            <Formik initialValues={initialValues} validationSchema={schema} onSubmit={handleSubmit}>
                {({ values, setFieldValue, isSubmitting }) => (
                    <Form>
                        <AdminBox title={'Panel Settings'} footer={
                            <div css={tw`flex justify-end`}>
                                <Button type={'submit'} color={'primary'} size={'xsmall'} disabled={isSubmitting}>Save</Button>
                            </div>
                        }>
                            <div css={tw`grid grid-cols-1 md:grid-cols-3 gap-4 items-start`}>
                                <div>
                                    <Field id={'companyName'} name={'companyName'} label={'Company Name'} description={'The name displayed in the page title and navigation.'} />
                                </div>
                                <div>
                                    <Label htmlFor={'defaultLanguage'}>Default Language</Label>
                                    <Select id={'defaultLanguage'} name={'defaultLanguage'} value={values.defaultLanguage} onChange={(e) => setFieldValue('defaultLanguage', e.target.value)}>
                                        <option value={'en'}>English</option>
                                        <option value={'de'}>Deutsch</option>
                                        <option value={'es'}>Espa&#241;ol</option>
                                        <option value={'fr'}>Fran&#231;ais</option>
                                        <option value={'pt'}>Portugu&#234;s</option>
                                        <option value={'ru'}>&#1056;&#1091;&#1089;&#1089;&#1082;&#1080;&#1081;</option>
                                        <option value={'zh'}>&#20013;&#25991;</option>
                                    </Select>
                                    <p css={tw`mt-1 text-xs text-neutral-400`}>The default language for new users.</p>
                                </div>
                                <div>
                                    <Label>2FA Requirement</Label>
                                    <div css={tw`flex gap-1 mt-2`}>
                                        {[
                                            { value: 'not_required', label: 'Not Required' },
                                            { value: 'admin_only', label: 'Admin Only' },
                                            { value: 'all_users', label: 'All Users' },
                                        ].map((opt) => (
                                            <Button
                                                key={opt.value}
                                                type={'button'}
                                                size={'small'}
                                                color={values.twoFactorRequirement === opt.value ? 'primary' : 'grey'}
                                                onClick={() => setFieldValue('twoFactorRequirement', opt.value)}
                                            >
                                                {opt.label}
                                            </Button>
                                        ))}
                                    </div>
                                    <p css={tw`mt-1 text-xs text-neutral-400`}>Require two-factor authentication for users.</p>
                                </div>
                            </div>
                        </AdminBox>

                        <AdminBox title={'Mail Settings'} css={tw`mt-4`} footer={
                            <div css={tw`flex justify-end`}>
                                <Button type={'submit'} color={'primary'} size={'xsmall'} disabled={isSubmitting}>Save</Button>
                            </div>
                        }>
                            <div css={tw`grid grid-cols-1 md:grid-cols-3 gap-4`}>
                                <Field id={'mailHost'} name={'mailHost'} label={'SMTP Host'} />
                                <Field id={'mailPort'} name={'mailPort'} label={'SMTP Port'} />
                                <div>
                                    <Label htmlFor={'mailEncryption'}>Encryption</Label>
                                    <Select id={'mailEncryption'} name={'mailEncryption'} value={values.mailEncryption} onChange={(e) => setFieldValue('mailEncryption', e.target.value)}>
                                        <option value={''}>None</option>
                                        <option value={'tls'}>TLS</option>
                                        <option value={'ssl'}>SSL</option>
                                    </Select>
                                </div>
                                <Field id={'mailUsername'} name={'mailUsername'} label={'Username'} />
                                <Field id={'mailPassword'} name={'mailPassword'} label={'Password'} type={'password'} description={'Leave blank to keep current.'} />
                                <Field id={'mailFromAddress'} name={'mailFromAddress'} label={'From Address'} />
                                <Field id={'mailFromName'} name={'mailFromName'} label={'From Name'} />
                            </div>
                        </AdminBox>
                    </Form>
                )}
            </Formik>
            )}
        </AdminLayout>
    );
};
