import React, { useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { Form, Formik, FormikHelpers, Field as FormikField } from 'formik';
import { object, string, number } from 'yup';
import tw from 'twin.macro';
import AdminLayout from '@/components/admin/AdminLayout';
import TitledGreyBox from '@/components/elements/TitledGreyBox';
import Field from '@/components/elements/Field';
import Label from '@/components/elements/Label';
import Select from '@/components/elements/Select';
import Switch from '@/components/elements/Switch';
import Button from '@/components/elements/Button';
import SpinnerOverlay from '@/components/elements/SpinnerOverlay';
import Spinner from '@/components/elements/Spinner';
import useFlash from '@/plugins/useFlash';
import { httpErrorToHuman } from '@/api/http';
import {
    createServer,
    getNodes,
    getNodeAllocations,
    getNests,
    AdminNode,
    AdminNest,
    AdminAllocation,
    AdminEgg,
} from '@/api/admin/servers';
import FormikFieldWrapper from '@/components/elements/FormikFieldWrapper';
import { Textarea } from '@/components/elements/Input';

interface Values {
    name: string;
    description: string;
    user: number | '';
    externalId: string;
    // Deployment
    nodeId: number | '';
    allocationId: number | '';
    nestId: number | '';
    eggId: number | '';
    startupCommand: string;
    dockerImage: string;
    // Resource limits
    memory: number;
    swap: number;
    disk: number;
    io: number;
    cpu: number;
    threads: string;
    oomDisabled: boolean;
    // Feature limits
    databaseLimit: number;
    allocationLimit: number;
    backupLimit: number;
    // Environment
    environment: Record<string, string>;
}

const schema = object().shape({
    name: string().required('A server name is required.').min(1),
    user: number().required('An owner user ID is required.').min(1, 'A valid user ID is required.'),
    nodeId: number().required('A node is required.').min(1),
    allocationId: number().required('A default allocation is required.').min(1),
    nestId: number().required('A nest is required.').min(1),
    eggId: number().required('An egg is required.').min(1),
    memory: number().required().min(0),
    swap: number().required().min(-1),
    disk: number().required().min(0),
    io: number().required().min(10).max(1000),
    cpu: number().required().min(0),
    databaseLimit: number().required().min(0),
    allocationLimit: number().required().min(0),
    backupLimit: number().required().min(0),
});

const NewServerContainer = () => {
    const history = useHistory();
    const { clearFlashes, addFlash, clearAndAddHttpError } = useFlash();

    const [nodes, setNodes] = useState<AdminNode[]>([]);
    const [nests, setNests] = useState<AdminNest[]>([]);
    const [allocations, setAllocations] = useState<AdminAllocation[]>([]);
    const [selectedEgg, setSelectedEgg] = useState<AdminEgg | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([getNodes(), getNests()])
            .then(([nodesData, nestsData]) => {
                setNodes(nodesData);
                setNests(nestsData);
            })
            .catch((error) => clearAndAddHttpError({ key: 'admin:servers:new', error }))
            .finally(() => setLoading(false));
    }, []);

    const handleNodeChange = (nodeId: number) => {
        if (!nodeId) {
            setAllocations([]);
            return;
        }
        getNodeAllocations(nodeId)
            .then((data) => setAllocations(data.filter((a) => !a.assigned)))
            .catch((error) => {
                console.error(error);
                setAllocations([]);
            });
    };

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
            // Set default environment values
            const env: Record<string, string> = {};
            egg.variables.forEach((v) => {
                env[v.envVariable] = v.defaultValue;
            });
            setFieldValue('environment', env);
        }
    };

    const submit = (values: Values, { setSubmitting }: FormikHelpers<Values>) => {
        clearFlashes('admin:servers:new');

        createServer({
            name: values.name,
            description: values.description || undefined,
            user: Number(values.user),
            egg: Number(values.eggId),
            docker_image: values.dockerImage,
            startup: values.startupCommand,
            environment: values.environment,
            limits: {
                memory: values.memory,
                swap: values.swap,
                disk: values.disk,
                io: values.io,
                cpu: values.cpu,
                threads: values.threads || null,
                oom_disabled: values.oomDisabled,
            },
            feature_limits: {
                databases: values.databaseLimit,
                allocations: values.allocationLimit,
                backups: values.backupLimit,
            },
            allocation: {
                default: Number(values.allocationId),
            },
            external_id: values.externalId || null,
        })
            .then((server) => {
                addFlash({ key: 'admin:servers', type: 'success', message: 'Server has been created successfully.' });
                history.push(`/admin/servers/${server.id}`);
            })
            .catch((error) => {
                console.error(error);
                clearAndAddHttpError({ key: 'admin:servers:new', error });
                setSubmitting(false);
            });
    };

    if (loading) {
        return (
            <AdminLayout title={'New Server'} subtitle={'Add a new server to the panel.'} showFlashKey={'admin:servers:new'} breadcrumbs={[{ label: 'Admin', to: '/admin' }, { label: 'Servers', to: '/admin/servers' }, { label: 'New Server' }]}>
                <Spinner centered size={'large'} />
            </AdminLayout>
        );
    }

    return (
        <AdminLayout title={'New Server'} subtitle={'Add a new server to the panel.'} showFlashKey={'admin:servers:new'} breadcrumbs={[{ label: 'Admin', to: '/admin' }, { label: 'Servers', to: '/admin/servers' }, { label: 'New Server' }]}>
            <h1 css={tw`text-2xl text-neutral-50 mb-4`}>Create Server</h1>
            <Formik
                onSubmit={submit}
                initialValues={{
                    name: '',
                    description: '',
                    user: '' as number | '',
                    externalId: '',
                    nodeId: '' as number | '',
                    allocationId: '' as number | '',
                    nestId: '' as number | '',
                    eggId: '' as number | '',
                    startupCommand: '',
                    dockerImage: '',
                    memory: 1024,
                    swap: 0,
                    disk: 10240,
                    io: 500,
                    cpu: 100,
                    threads: '',
                    oomDisabled: false,
                    databaseLimit: 0,
                    allocationLimit: 0,
                    backupLimit: 0,
                    environment: {} as Record<string, string>,
                }}
                validationSchema={schema}
            >
                {({ isSubmitting, values, setFieldValue }) => (
                    <Form>
                        <SpinnerOverlay visible={isSubmitting} />
                        <div css={tw`grid gap-8 md:grid-cols-2`}>
                            {/* Core Details */}
                            <TitledGreyBox title={'Core Details'}>
                                <div css={tw`mb-4`}>
                                    <Field id={'name'} name={'name'} label={'Server Name'} type={'text'} />
                                </div>
                                <div css={tw`mb-4`}>
                                    <Label>Description</Label>
                                    <FormikFieldWrapper name={'description'}>
                                        <FormikField as={Textarea} name={'description'} rows={3} />
                                    </FormikFieldWrapper>
                                </div>
                                <div css={tw`mb-4`}>
                                    <Field
                                        id={'user'}
                                        name={'user'}
                                        label={'Owner User ID'}
                                        type={'number'}
                                        min={1}
                                    />
                                </div>
                                <div>
                                    <Field
                                        id={'externalId'}
                                        name={'externalId'}
                                        label={'External ID'}
                                        type={'text'}
                                        description={'Optional external identifier for this server.'}
                                    />
                                </div>
                            </TitledGreyBox>

                            {/* Resource Limits */}
                            <TitledGreyBox title={'Resource Limits'}>
                                <div css={tw`grid grid-cols-2 gap-4`}>
                                    <Field id={'memory'} name={'memory'} label={'Memory (MB)'} type={'number'} min={0} />
                                    <Field id={'swap'} name={'swap'} label={'Swap (MB)'} type={'number'} min={-1} />
                                    <Field id={'disk'} name={'disk'} label={'Disk (MB)'} type={'number'} min={0} />
                                    <Field id={'cpu'} name={'cpu'} label={'CPU (%)'} type={'number'} min={0} />
                                    <Field id={'io'} name={'io'} label={'Block IO Weight'} type={'number'} min={10} max={1000} />
                                    <Field id={'threads'} name={'threads'} label={'CPU Threads'} type={'text'} description={'Comma-separated list of CPU threads.'} />
                                </div>
                                <div css={tw`mt-4`}>
                                    <Switch
                                        name={'oomDisabled'}
                                        label={'Disable OOM Killer'}
                                        description={'Disable the Out-Of-Memory killer for this server.'}
                                        defaultChecked={false}
                                        onChange={(e) => setFieldValue('oomDisabled', e.target.checked)}
                                    />
                                </div>
                            </TitledGreyBox>

                            {/* Feature Limits */}
                            <TitledGreyBox title={'Feature Limits'}>
                                <div css={tw`grid grid-cols-3 gap-4`}>
                                    <Field id={'databaseLimit'} name={'databaseLimit'} label={'Databases'} type={'number'} min={0} />
                                    <Field id={'allocationLimit'} name={'allocationLimit'} label={'Allocations'} type={'number'} min={0} />
                                    <Field id={'backupLimit'} name={'backupLimit'} label={'Backups'} type={'number'} min={0} />
                                </div>
                            </TitledGreyBox>

                            {/* Deployment */}
                            <TitledGreyBox title={'Deployment'}>
                                <div css={tw`mb-4`}>
                                    <Label>Node</Label>
                                    <Select
                                        name={'nodeId'}
                                        value={values.nodeId}
                                        onChange={(e) => {
                                            const nodeId = Number(e.target.value);
                                            setFieldValue('nodeId', nodeId || '');
                                            setFieldValue('allocationId', '');
                                            handleNodeChange(nodeId);
                                        }}
                                    >
                                        <option value={''}>Select a node...</option>
                                        {nodes.map((node) => (
                                            <option key={node.id} value={node.id}>
                                                {node.name} ({node.fqdn})
                                            </option>
                                        ))}
                                    </Select>
                                </div>
                                <div css={tw`mb-4`}>
                                    <Label>Default Allocation</Label>
                                    <Select
                                        name={'allocationId'}
                                        value={values.allocationId}
                                        onChange={(e) => setFieldValue('allocationId', Number(e.target.value) || '')}
                                        disabled={!values.nodeId}
                                    >
                                        <option value={''}>Select an allocation...</option>
                                        {allocations.map((alloc) => (
                                            <option key={alloc.id} value={alloc.id}>
                                                {alloc.ip}:{alloc.port}
                                                {alloc.alias ? ` (${alloc.alias})` : ''}
                                            </option>
                                        ))}
                                    </Select>
                                </div>
                                <div css={tw`mb-4`}>
                                    <Label>Nest</Label>
                                    <Select
                                        name={'nestId'}
                                        value={values.nestId}
                                        onChange={(e) => {
                                            const nestId = Number(e.target.value);
                                            setFieldValue('nestId', nestId || '');
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
                                        name={'eggId'}
                                        value={values.eggId}
                                        disabled={!values.nestId}
                                        onChange={(e) => {
                                            const eggId = Number(e.target.value);
                                            setFieldValue('eggId', eggId || '');
                                            if (eggId && values.nestId) {
                                                handleEggChange(Number(values.nestId), eggId, setFieldValue);
                                            }
                                        }}
                                    >
                                        <option value={''}>Select an egg...</option>
                                        {nests
                                            .find((n) => n.id === Number(values.nestId))
                                            ?.eggs.map((egg) => (
                                                <option key={egg.id} value={egg.id}>
                                                    {egg.name}
                                                </option>
                                            ))}
                                    </Select>
                                </div>
                            </TitledGreyBox>
                        </div>

                        {/* Startup Configuration */}
                        <div css={tw`mt-8`}>
                            <TitledGreyBox title={'Startup Configuration'}>
                                <div css={tw`mb-4`}>
                                    <Field
                                        id={'startupCommand'}
                                        name={'startupCommand'}
                                        label={'Startup Command'}
                                        type={'text'}
                                    />
                                </div>
                                <div css={tw`mb-4`}>
                                    <Label>Docker Image</Label>
                                    {selectedEgg && Object.keys(selectedEgg.dockerImages).length > 1 ? (
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
                                    ) : (
                                        <Field
                                            id={'dockerImage'}
                                            name={'dockerImage'}
                                            type={'text'}
                                        />
                                    )}
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
                            <Button type={'submit'} size={'large'} disabled={isSubmitting}>
                                Create Server
                            </Button>
                        </div>
                    </Form>
                )}
            </Formik>
        </AdminLayout>
    );
};

export default NewServerContainer;
