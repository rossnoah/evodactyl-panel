import { type Actions, type State, useStoreActions, useStoreState } from 'easy-peasy';
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
import type { ApplicationStore } from '@/state';

interface FormValues {
    companyName: string;
    twoFactorRequirement: '0' | '1' | '2';
    defaultLanguage: string;
}

const LANGUAGES: { value: string; label: string }[] = [
    { value: 'en', label: 'English' },
    { value: 'de', label: 'Deutsch' },
    { value: 'es', label: 'Español' },
    { value: 'fr', label: 'Français' },
    { value: 'pt', label: 'Português' },
    { value: 'ru', label: 'Русский' },
    { value: 'zh', label: '中文' },
];

const TWO_FACTOR_OPTIONS = [
    { value: '0' as const, label: 'Not Required' },
    { value: '1' as const, label: 'Admin Only' },
    { value: '2' as const, label: 'All Users' },
];

const GeneralSettingsForm = () => {
    const { addFlash, clearFlashes } = useFlash();
    const [loading, setLoading] = useState(true);
    const [initialValues, setInitialValues] = useState<FormValues | null>(null);

    const currentSiteSettings = useStoreState((state: State<ApplicationStore>) => state.settings.data);
    const setSiteSettings = useStoreActions((actions: Actions<ApplicationStore>) => actions.settings.setSettings);

    useEffect(() => {
        getSettings()
            .then((settings) => {
                setInitialValues({
                    companyName: settings['app:name'] || 'Pterodactyl',
                    twoFactorRequirement: ((settings['pterodactyl:auth:2fa_required'] as '0' | '1' | '2') || '0'),
                    defaultLanguage: settings['app:locale'] || 'en',
                });
                setLoading(false);
            })
            .catch(() => {
                addFlash({ key: 'admin:settings', type: 'error', title: 'Error', message: 'Failed to load settings.' });
                setLoading(false);
            });
    }, [addFlash]);

    const schema = object().shape({
        companyName: string().required('Company name is required.').min(1).max(191),
        twoFactorRequirement: string().required().oneOf(['0', '1', '2']),
        defaultLanguage: string().required().min(2).max(10),
    });

    const handleSubmit = (values: FormValues, { setSubmitting }: any) => {
        clearFlashes('admin:settings');
        const payload: PanelSettings = {
            'app:name': values.companyName,
            'app:locale': values.defaultLanguage,
            'pterodactyl:auth:2fa_required': values.twoFactorRequirement,
        };

        updateSettings(payload)
            .then(() => {
                addFlash({
                    key: 'admin:settings',
                    type: 'success',
                    message: 'Settings have been saved successfully.',
                });
                if (currentSiteSettings) {
                    setSiteSettings({
                        ...currentSiteSettings,
                        name: values.companyName,
                        locale: values.defaultLanguage,
                    });
                }
            })
            .catch(() => addFlash({ key: 'admin:settings', type: 'error', message: 'Failed to save settings.' }))
            .finally(() => setSubmitting(false));
    };

    if (loading || !initialValues) {
        return <Spinner centered />;
    }

    const hasUnknownLocale = !LANGUAGES.some((l) => l.value === initialValues.defaultLanguage);

    return (
        <Formik initialValues={initialValues} validationSchema={schema} onSubmit={handleSubmit}>
            {({ values, setFieldValue, isSubmitting }) => (
                <Form>
                    <AdminBox
                        title={'Panel Settings'}
                        footer={
                            <div css={tw`flex justify-end`}>
                                <Button type={'submit'} color={'primary'} size={'xsmall'} disabled={isSubmitting}>
                                    Save
                                </Button>
                            </div>
                        }
                    >
                        <div css={tw`grid grid-cols-1 md:grid-cols-3 gap-4 items-start`}>
                            <div>
                                <Field
                                    id={'companyName'}
                                    name={'companyName'}
                                    label={'Company Name'}
                                    description={
                                        'Used throughout the panel and in emails sent to clients.'
                                    }
                                />
                            </div>
                            <div>
                                <Label htmlFor={'defaultLanguage'}>Default Language</Label>
                                <Select
                                    id={'defaultLanguage'}
                                    name={'defaultLanguage'}
                                    value={values.defaultLanguage}
                                    onChange={(e) => setFieldValue('defaultLanguage', e.target.value)}
                                >
                                    {hasUnknownLocale && (
                                        <option value={values.defaultLanguage} disabled>
                                            {values.defaultLanguage}
                                        </option>
                                    )}
                                    {LANGUAGES.map((l) => (
                                        <option key={l.value} value={l.value}>
                                            {l.label}
                                        </option>
                                    ))}
                                </Select>
                                <p css={tw`mt-1 text-xs text-neutral-400`}>
                                    The default language to use when rendering UI components.
                                </p>
                            </div>
                            <div>
                                <Label>Require 2-Factor Authentication</Label>
                                <div css={tw`flex gap-1 mt-2`}>
                                    {TWO_FACTOR_OPTIONS.map((opt) => (
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
                                <p css={tw`mt-1 text-xs text-neutral-400`}>
                                    If enabled, any account falling into the selected grouping will be required to
                                    have 2-Factor authentication enabled to use the Panel.
                                </p>
                            </div>
                        </div>
                    </AdminBox>
                </Form>
            )}
        </Formik>
    );
};

export default GeneralSettingsForm;
