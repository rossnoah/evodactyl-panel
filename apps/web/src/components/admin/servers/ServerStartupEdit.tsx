import React, { useContext, useEffect, useState } from 'react';
import { Form, Formik, FormikHelpers, Field as FormikField } from 'formik';
import { object, string, number } from 'yup';
import tw from 'twin.macro';
import FlashMessageRender from '@/components/FlashMessageRender';
import TitledGreyBox from '@/components/elements/TitledGreyBox';
import Field from '@/components/elements/Field';
import Label from '@/components/elements/Label';
import Select from '@/components/elements/Select';
import Button from '@/components/elements/Button';
import SpinnerOverlay from '@/components/elements/SpinnerOverlay';
import Spinner from '@/components/elements/Spinner';
import useFlash from '@/plugins/useFlash';
import { updateServerStartup, getNests, AdminNest, AdminEgg } from '@/api/admin/servers';
import { AdminServerContext } from '@/components/admin/servers/ServerRouter';

interface Values {
    startupCommand: string;
    dockerImage: string;
    nestId: number;
    eggId: number;
    environment: Record<string, string>;
}

const schema = object().shape({
    startupCommand: string().required('A startup command is required.'),
    dockerImage: string().required('A Docker image is required.'),
    eggId: number().required('An egg is required.').min(1),
});

const ServerStartupEdit = () => {
    const { server, setServer } = useContext(AdminServerContext);
    const { addFlash, clearFlashes, clearAndAddHttpError } = useFlash();

    const [nests, setNests] = useState<AdminNest[]>([]);
    const [selectedEgg, setSelectedEgg] = useState<AdminEgg | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getNests()
            .then((data) => {
                setNests(data);
                // Find the current egg
                for (const nest of data) {
                    const egg = nest.eggs.find((e) => e.id === server.eggId);
                    if (egg) {
                        setSelectedEgg(egg);
                        break;
                    }
                }
            })
            .catch((error) => clearAndAddHttpError({ key: 'admin:server:startup', error }))
            .finally(() => setLoading(false));
    }, []);

    const handleEggChange = (
        nestId: number,
        eggId: number,
        setFieldValue: (field: string, value: any) => void
    ) => {
        const nest = nests.find((n) => n.id === nestId);
        const egg = nest?.eggs.find((e) => e.id === eggId) || null;
        setSelectedEgg(egg);

        if (egg) {
            setFieldValue('startupCommand', egg.startup);
            const images = Object.values(egg.dockerImages);
            if (images.length > 0) {
                setFieldValue('dockerImage', images[0]);
            }
            const env: Record<string, string> = {};
            egg.variables.forEach((v) => {
                env[v.envVariable] = v.defaultValue;
            });
            setFieldValue('environment', env);
        }
    };

    const submit = (values: Values, { setSubmitting }: FormikHelpers<Values>) => {
        clearFlashes('admin:server:startup');

        updateServerStartup(server.id, {
            startup: values.startupCommand,
            environment: values.environment,
            egg: values.eggId,
            image: values.dockerImage,
        })
            .then((updatedServer) => {
                setServer({ ...server, ...updatedServer });
                addFlash({ key: 'admin:server:startup', type: 'success', message: 'Server startup configuration has been updated.' });
            })
            .catch((error) => {
                console.error(error);
                clearAndAddHttpError({ key: 'admin:server:startup', error });
            })
            .finally(() => setSubmitting(false));
    };

    if (loading) {
        return (
            <Spinner centered size={'large'} />
        );
    }

    return (
        <>
            <FlashMessageRender byKey={'admin:server:startup'} css={tw`mb-4`} />
            <Formik
                onSubmit={submit}
                initialValues={{
                    startupCommand: server.container.startupCommand,
                    dockerImage: server.container.image,
                    nestId: server.nestId,
                    eggId: server.eggId,
                    environment: server.container.environment,
                }}
                validationSchema={schema}
            >
                {({ isSubmitting, values, setFieldValue }) => (
                    <Form>
                        <SpinnerOverlay visible={isSubmitting} />
                        <div css={tw`grid gap-8 md:grid-cols-2`}>
                            <TitledGreyBox title={'Startup Command'}>
                                <Field
                                    id={'startupCommand'}
                                    name={'startupCommand'}
                                    label={'Startup Command'}
                                    type={'text'}
                                />
                            </TitledGreyBox>

                            <TitledGreyBox title={'Docker Image'}>
                                {selectedEgg && Object.keys(selectedEgg.dockerImages).length > 1 ? (
                                    <div>
                                        <Label>Docker Image</Label>
                                        <Select
                                            value={values.dockerImage}
                                            onChange={(e) => setFieldValue('dockerImage', e.target.value)}
                                        >
                                            {Object.entries(selectedEgg.dockerImages).map(([key, value]) => (
                                                <option key={value} value={value}>
                                                    {key}
                                                </option>
                                            ))}
                                        </Select>
                                    </div>
                                ) : (
                                    <Field
                                        id={'dockerImage'}
                                        name={'dockerImage'}
                                        label={'Docker Image'}
                                        type={'text'}
                                    />
                                )}
                            </TitledGreyBox>

                            <TitledGreyBox title={'Egg Selection'}>
                                <div css={tw`mb-4`}>
                                    <Label>Nest</Label>
                                    <Select
                                        value={values.nestId}
                                        onChange={(e) => {
                                            const nestId = Number(e.target.value);
                                            setFieldValue('nestId', nestId);
                                            setFieldValue('eggId', '');
                                            setSelectedEgg(null);
                                        }}
                                    >
                                        <option value={''}>Select a nest...</option>
                                        {nests.map((nest) => (
                                            <option key={nest.id} value={nest.id}>
                                                {nest.name}
                                            </option>
                                        ))}
                                    </Select>
                                </div>
                                <div>
                                    <Label>Egg</Label>
                                    <Select
                                        value={values.eggId}
                                        disabled={!values.nestId}
                                        onChange={(e) => {
                                            const eggId = Number(e.target.value);
                                            setFieldValue('eggId', eggId);
                                            if (eggId && values.nestId) {
                                                handleEggChange(values.nestId, eggId, setFieldValue);
                                            }
                                        }}
                                    >
                                        <option value={''}>Select an egg...</option>
                                        {nests
                                            .find((n) => n.id === values.nestId)
                                            ?.eggs.map((egg) => (
                                                <option key={egg.id} value={egg.id}>
                                                    {egg.name}
                                                </option>
                                            ))}
                                    </Select>
                                </div>
                            </TitledGreyBox>
                        </div>

                        {/* Environment Variables */}
                        {selectedEgg && selectedEgg.variables.length > 0 && (
                            <div css={tw`mt-8`}>
                                <TitledGreyBox title={'Environment Variables'}>
                                    <div css={tw`grid gap-4 md:grid-cols-2`}>
                                        {selectedEgg.variables.map((variable) => (
                                            <div key={variable.envVariable}>
                                                <Label>{variable.name}</Label>
                                                <FormikField
                                                    as={'input'}
                                                    name={`environment.${variable.envVariable}`}
                                                    css={tw`shadow-none block p-3 rounded border w-full text-sm bg-neutral-600 border-neutral-500 text-neutral-200`}
                                                    placeholder={variable.defaultValue}
                                                />
                                                {variable.description && (
                                                    <p css={tw`text-xs text-neutral-400 mt-1`}>{variable.description}</p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </TitledGreyBox>
                            </div>
                        )}

                        <div css={tw`mt-6 text-right`}>
                            <Button type={'submit'} disabled={isSubmitting}>
                                Save Changes
                            </Button>
                        </div>
                    </Form>
                )}
            </Formik>
        </>
    );
};

export default ServerStartupEdit;
