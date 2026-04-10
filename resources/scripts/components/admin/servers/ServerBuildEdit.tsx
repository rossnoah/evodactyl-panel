import React, { useContext, useEffect, useState } from 'react';
import { Form, Formik, FormikHelpers, Field as FormikField, FieldProps } from 'formik';
import { object, number, string } from 'yup';
import tw from 'twin.macro';
import FlashMessageRender from '@/components/FlashMessageRender';
import TitledGreyBox from '@/components/elements/TitledGreyBox';
import Field from '@/components/elements/Field';
import Label from '@/components/elements/Label';
import Select from '@/components/elements/Select';
import Switch from '@/components/elements/Switch';
import Button from '@/components/elements/Button';
import SpinnerOverlay from '@/components/elements/SpinnerOverlay';
import useFlash from '@/plugins/useFlash';
import { updateServerBuild, getNodeAllocations, AdminAllocation } from '@/api/admin/servers';
import { AdminServerContext } from '@/components/admin/servers/ServerRouter';

interface Values {
    memory: number;
    swap: number;
    disk: number;
    io: number;
    cpu: number;
    threads: string;
    oomDisabled: boolean;
    databaseLimit: number;
    allocationLimit: number;
    backupLimit: number;
    allocationId: number;
    addAllocations: number[];
    removeAllocations: number[];
}

const schema = object().shape({
    memory: number().required().min(0),
    swap: number().required().min(-1),
    disk: number().required().min(0),
    io: number().required().min(10).max(1000),
    cpu: number().required().min(0),
    threads: string().nullable(),
    databaseLimit: number().required().min(0),
    allocationLimit: number().required().min(0),
    backupLimit: number().required().min(0),
});

const ServerBuildEdit = () => {
    const { server, setServer } = useContext(AdminServerContext);
    const { addFlash, clearFlashes, clearAndAddHttpError } = useFlash();
    const [unassignedAllocations, setUnassignedAllocations] = useState<AdminAllocation[]>([]);

    // Load unassigned allocations from the server's node
    useEffect(() => {
        getNodeAllocations(server.nodeId)
            .then((allocs) => setUnassignedAllocations(allocs.filter(a => !a.assigned)))
            .catch(() => {});
    }, [server.nodeId]);

    // Build list of server's current allocations from the included relationship data
    // The allocation relationship includes all server allocations
    const serverAllocations: AdminAllocation[] = [];
    if (server.allocation) {
        serverAllocations.push(server.allocation);
    }

    const submit = (values: Values, { setSubmitting }: FormikHelpers<Values>) => {
        clearFlashes('admin:server:build');

        updateServerBuild(server.id, {
            allocation: values.allocationId,
            memory: values.memory,
            swap: values.swap,
            disk: values.disk,
            io: values.io,
            cpu: values.cpu,
            threads: values.threads || null,
            oom_disabled: values.oomDisabled,
            feature_limits: {
                databases: values.databaseLimit,
                allocations: values.allocationLimit,
                backups: values.backupLimit,
            },
            add_allocations: values.addAllocations,
            remove_allocations: values.removeAllocations,
        })
            .then((updatedServer) => {
                setServer({ ...server, ...updatedServer });
                addFlash({ key: 'admin:server:build', type: 'success', message: 'Server build configuration has been updated.' });
            })
            .catch((error) => clearAndAddHttpError({ key: 'admin:server:build', error }))
            .finally(() => setSubmitting(false));
    };

    return (
        <>
            <FlashMessageRender byKey={'admin:server:build'} css={tw`mb-4`} />
            <Formik
                onSubmit={submit}
                initialValues={{
                    memory: server.limits.memory,
                    swap: server.limits.swap,
                    disk: server.limits.disk,
                    io: server.limits.io,
                    cpu: server.limits.cpu,
                    threads: server.limits.threads || '',
                    oomDisabled: server.limits.oomDisabled,
                    databaseLimit: server.featureLimits.databases,
                    allocationLimit: server.featureLimits.allocations,
                    backupLimit: server.featureLimits.backups,
                    allocationId: server.allocationId,
                    addAllocations: [] as number[],
                    removeAllocations: [] as number[],
                }}
                validationSchema={schema}
            >
                {({ isSubmitting, values, setFieldValue }) => (
                    <Form>
                        <div css={tw`grid gap-6 lg:grid-cols-5`}>
                            {/* Left column — Resource Management (2/5) */}
                            <div css={tw`lg:col-span-2`}>
                                <TitledGreyBox title={'Resource Management'} css={tw`relative`}>
                                    <SpinnerOverlay visible={isSubmitting} />
                                    <div css={tw`mb-4`}>
                                        <Field id={'cpu'} name={'cpu'} label={'CPU Limit (%)'} type={'number'} min={0}
                                            description={'Each virtual core = 100%. Set to 0 for unlimited.'} />
                                    </div>
                                    <div css={tw`mb-4`}>
                                        <Field id={'threads'} name={'threads'} label={'CPU Pinning'} type={'text'}
                                            description={'Advanced: e.g. 0, 0-1,3, or 0,1,3,4. Leave blank for all cores.'} />
                                    </div>
                                    <div css={tw`grid grid-cols-2 gap-4 mb-4`}>
                                        <Field id={'memory'} name={'memory'} label={'Memory (MiB)'} type={'number'} min={0} />
                                        <Field id={'swap'} name={'swap'} label={'Swap (MiB)'} type={'number'} min={-1}
                                            description={'0 = disabled, -1 = unlimited'} />
                                    </div>
                                    <div css={tw`grid grid-cols-2 gap-4 mb-4`}>
                                        <Field id={'disk'} name={'disk'} label={'Disk Space (MiB)'} type={'number'} min={0} />
                                        <Field id={'io'} name={'io'} label={'Block IO Weight'} type={'number'} min={10} max={1000} />
                                    </div>
                                    <Switch
                                        name={'oomDisabled'}
                                        label={'Disable OOM Killer'}
                                        description={'Prevents the server from being killed when it runs out of memory.'}
                                        defaultChecked={values.oomDisabled}
                                        onChange={(e) => setFieldValue('oomDisabled', e.target.checked)}
                                    />
                                </TitledGreyBox>
                            </div>

                            {/* Right column — Feature Limits + Allocations (3/5) */}
                            <div css={tw`lg:col-span-3`}>
                                <TitledGreyBox title={'Application Feature Limits'} css={tw`relative mb-6`}>
                                    <SpinnerOverlay visible={isSubmitting} />
                                    <div css={tw`grid grid-cols-3 gap-4`}>
                                        <Field id={'databaseLimit'} name={'databaseLimit'} label={'Database Limit'} type={'number'} min={0} />
                                        <Field id={'allocationLimit'} name={'allocationLimit'} label={'Allocation Limit'} type={'number'} min={0} />
                                        <Field id={'backupLimit'} name={'backupLimit'} label={'Backup Limit'} type={'number'} min={0} />
                                    </div>
                                </TitledGreyBox>

                                <TitledGreyBox title={'Allocation Management'} css={tw`relative`}>
                                    <SpinnerOverlay visible={isSubmitting} />
                                    <div css={tw`mb-4`}>
                                        <FormikField name={'allocationId'}>
                                            {({ field, form }: FieldProps) => (
                                                <div>
                                                    <Label>Game Port</Label>
                                                    <Select
                                                        {...field}
                                                        onChange={(e) => form.setFieldValue('allocationId', Number(e.target.value))}
                                                    >
                                                        {serverAllocations.map(a => (
                                                            <option key={a.id} value={a.id}>
                                                                {a.alias ? `${a.alias}:${a.port}` : `${a.ip}:${a.port}`}
                                                            </option>
                                                        ))}
                                                    </Select>
                                                </div>
                                            )}
                                        </FormikField>
                                    </div>

                                    <div css={tw`mb-4`}>
                                        <Label>Assign Additional Ports</Label>
                                        <Select
                                            multiple
                                            value={values.addAllocations.map(String)}
                                            onChange={(e) => {
                                                const selected = Array.from(e.target.selectedOptions).map(o => Number(o.value));
                                                setFieldValue('addAllocations', selected);
                                            }}
                                            css={tw`h-24`}
                                        >
                                            {unassignedAllocations.map(a => (
                                                <option key={a.id} value={a.id}>
                                                    {a.alias ? `${a.alias}:${a.port}` : `${a.ip}:${a.port}`}
                                                </option>
                                            ))}
                                        </Select>
                                        <p css={tw`text-xs text-neutral-500 mt-1`}>Select ports from unassigned allocations on this node.</p>
                                    </div>

                                    <div>
                                        <Label>Remove Additional Ports</Label>
                                        <Select
                                            multiple
                                            value={values.removeAllocations.map(String)}
                                            onChange={(e) => {
                                                const selected = Array.from(e.target.selectedOptions).map(o => Number(o.value));
                                                setFieldValue('removeAllocations', selected);
                                            }}
                                            css={tw`h-24`}
                                        >
                                            {serverAllocations
                                                .filter(a => a.id !== values.allocationId)
                                                .map(a => (
                                                    <option key={a.id} value={a.id}>
                                                        {a.alias ? `${a.alias}:${a.port}` : `${a.ip}:${a.port}`}
                                                    </option>
                                                ))}
                                        </Select>
                                        <p css={tw`text-xs text-neutral-500 mt-1`}>Select secondary ports to remove from this server.</p>
                                    </div>
                                </TitledGreyBox>
                            </div>
                        </div>

                        <div css={tw`mt-6 text-right`}>
                            <Button type={'submit'} disabled={isSubmitting}>
                                Update Build Configuration
                            </Button>
                        </div>
                    </Form>
                )}
            </Formik>
        </>
    );
};

export default ServerBuildEdit;
