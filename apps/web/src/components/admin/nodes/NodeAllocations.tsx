import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Form, Formik, FormikHelpers } from 'formik';
import * as Yup from 'yup';
import tw from 'twin.macro';
import useSWR from 'swr';
import {
    Node, Allocation, getAllocations, createAllocations, deleteAllocation,
    updateAllocationAlias, bulkDeleteAllocations,
} from '@/api/admin/nodes';
import { PaginatedResult } from '@/api/http';
import FlashMessageRender from '@/components/FlashMessageRender';
import Spinner from '@/components/elements/Spinner';
import Pagination from '@/components/elements/Pagination';
import Button from '@/components/elements/Button';
import Field from '@/components/elements/Field';
import AdminBox from '@/components/admin/AdminBox';
import SpinnerOverlay from '@/components/elements/SpinnerOverlay';
import ConfirmationModal from '@/components/elements/ConfirmationModal';
import useFlash from '@/plugins/useFlash';
import { AdminTable, AdminTableHead, AdminTableBody, AdminTableHeader, AdminTableRow, AdminTableCell } from '@/components/admin/AdminTable';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash } from '@fortawesome/free-solid-svg-icons';

interface Props {
    node: Node;
}

interface CreateValues {
    ip: string;
    alias: string;
    ports: string;
}

const createSchema = Yup.object().shape({
    ip: Yup.string().required('An IP address is required.'),
    alias: Yup.string().max(191).nullable(),
    ports: Yup.string().required('At least one port or port range is required.'),
});

const AliasInput = ({ allocation, nodeId, onUpdated }: { allocation: Allocation; nodeId: number; onUpdated: () => void }) => {
    const [value, setValue] = useState(allocation.alias || '');
    const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
    const timerRef = useRef<ReturnType<typeof setTimeout>>();
    const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();

    const save = useCallback((newValue: string) => {
        setStatus('saving');
        updateAllocationAlias(nodeId, allocation.id, newValue || null)
            .then(() => {
                setStatus('success');
                saveTimerRef.current = setTimeout(() => setStatus('idle'), 2000);
            })
            .catch(() => {
                setStatus('error');
                saveTimerRef.current = setTimeout(() => setStatus('idle'), 2000);
            });
    }, [nodeId, allocation.id]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;
        setValue(newValue);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => save(newValue), 300);
    };

    useEffect(() => {
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
            if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        };
    }, []);

    const borderColor = status === 'success' ? 'border-green-500' : status === 'error' ? 'border-red-500' : 'border-neutral-500';

    return (
        <input
            type={'text'}
            value={value}
            onChange={handleChange}
            placeholder={'none'}
            className={borderColor}
            css={tw`bg-transparent border rounded px-2 py-1 text-sm text-neutral-200 outline-none w-full transition-colors duration-200 focus:border-primary-400`}
        />
    );
};

const NodeAllocations = ({ node }: Props) => {
    const [page, setPage] = useState(1);
    const [selected, setSelected] = useState<Set<number>>(new Set());
    const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
    const [showIpBlockModal, setShowIpBlockModal] = useState(false);
    const [deleteIp, setDeleteIp] = useState('');
    const [bulkDeleting, setBulkDeleting] = useState(false);
    const { addFlash, clearFlashes, clearAndAddHttpError } = useFlash();

    const { data: allocations, error, mutate } = useSWR<PaginatedResult<Allocation>>(
        [`/api/application/nodes/${node.id}/allocations`, page],
        () => getAllocations(node.id, page)
    );

    useEffect(() => {
        if (error) clearAndAddHttpError({ key: 'admin:node:allocations', error });
        if (!error) clearFlashes('admin:node:allocations');
    }, [error]);

    // Reset selection on page change
    useEffect(() => { setSelected(new Set()); }, [page]);

    const toggleSelection = (id: number) => {
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (!allocations) return;
        const unassigned = allocations.items.filter(a => !a.assigned);
        if (selected.size === unassigned.length) {
            setSelected(new Set());
        } else {
            setSelected(new Set(unassigned.map(a => a.id)));
        }
    };

    const submitCreate = (values: CreateValues, { setSubmitting, resetForm }: FormikHelpers<CreateValues>) => {
        clearFlashes('admin:node:allocations');

        const ports = values.ports
            .split(',')
            .map((p) => p.trim())
            .filter((p) => p.length > 0);

        createAllocations(node.id, values.ip, ports, values.alias || undefined)
            .then(() => {
                addFlash({ key: 'admin:node:allocations', type: 'success', message: 'Allocations created.' });
                resetForm();
                mutate();
            })
            .catch((error) => {
                clearAndAddHttpError({ key: 'admin:node:allocations', error });
            })
            .finally(() => setSubmitting(false));
    };

    const handleDelete = (allocationId: number) => {
        clearFlashes('admin:node:allocations');

        deleteAllocation(node.id, allocationId)
            .then(() => {
                addFlash({ key: 'admin:node:allocations', type: 'success', message: 'Allocation deleted.' });
                mutate();
            })
            .catch((error) => {
                clearAndAddHttpError({ key: 'admin:node:allocations', error });
            });
    };

    const handleBulkDelete = () => {
        setBulkDeleting(true);
        clearFlashes('admin:node:allocations');

        bulkDeleteAllocations(node.id, Array.from(selected))
            .then(() => {
                addFlash({ key: 'admin:node:allocations', type: 'success', message: `${selected.size} allocation(s) deleted.` });
                setSelected(new Set());
                setShowBulkDeleteModal(false);
                mutate();
            })
            .catch((error) => {
                clearAndAddHttpError({ key: 'admin:node:allocations', error });
                setShowBulkDeleteModal(false);
            })
            .finally(() => setBulkDeleting(false));
    };

    const handleDeleteIpBlock = () => {
        if (!deleteIp || !allocations) return;
        setBulkDeleting(true);
        clearFlashes('admin:node:allocations');

        const idsForIp = allocations.items
            .filter(a => a.ip === deleteIp && !a.assigned)
            .map(a => a.id);

        if (idsForIp.length === 0) {
            setShowIpBlockModal(false);
            setBulkDeleting(false);
            return;
        }

        bulkDeleteAllocations(node.id, idsForIp)
            .then(() => {
                addFlash({ key: 'admin:node:allocations', type: 'success', message: `Allocations for ${deleteIp} deleted.` });
                setShowIpBlockModal(false);
                mutate();
            })
            .catch((error) => {
                clearAndAddHttpError({ key: 'admin:node:allocations', error });
                setShowIpBlockModal(false);
            })
            .finally(() => setBulkDeleting(false));
    };

    // Get unique IPs from current page
    const uniqueIps = allocations ? [...new Set(allocations.items.map(a => a.ip))] : [];

    return (
        <>
            <FlashMessageRender byKey={'admin:node:allocations'} css={tw`mb-4`} />

            <ConfirmationModal
                visible={showBulkDeleteModal}
                title={'Delete Allocations'}
                buttonText={'Delete'}
                onConfirmed={handleBulkDelete}
                showSpinnerOverlay={bulkDeleting}
                onModalDismissed={() => setShowBulkDeleteModal(false)}
            >
                Are you sure you want to delete {selected.size} selected allocation(s)?
            </ConfirmationModal>

            <ConfirmationModal
                visible={showIpBlockModal}
                title={'Delete Allocations for IP Block'}
                buttonText={'Delete Allocations'}
                onConfirmed={handleDeleteIpBlock}
                showSpinnerOverlay={bulkDeleting}
                onModalDismissed={() => setShowIpBlockModal(false)}
            >
                <div css={tw`mb-4`}>
                    <p css={tw`text-sm text-neutral-300 mb-3`}>Select the IP address to delete all unassigned allocations for:</p>
                    <select
                        value={deleteIp}
                        onChange={(e) => setDeleteIp(e.target.value)}
                        css={tw`bg-neutral-600 border border-neutral-500 rounded px-3 py-2 text-sm text-neutral-200 w-full outline-none`}
                    >
                        <option value={''}>Select an IP...</option>
                        {uniqueIps.map(ip => (
                            <option key={ip} value={ip}>{ip}</option>
                        ))}
                    </select>
                </div>
            </ConfirmationModal>

            <div css={tw`grid grid-cols-1 lg:grid-cols-3 gap-6`}>
                {/* Left column — Existing allocations */}
                <div css={tw`lg:col-span-2`}>
                    <AdminBox
                        title={'Existing Allocations'}
                        noPadding
                        tools={
                            <div css={tw`flex items-center gap-2`}>
                                {selected.size > 0 && (
                                    <Button size={'xsmall'} color={'red'} isSecondary onClick={() => setShowBulkDeleteModal(true)}>
                                        Delete Selected ({selected.size})
                                    </Button>
                                )}
                                <Button size={'xsmall'} color={'red'} isSecondary onClick={() => { setDeleteIp(''); setShowIpBlockModal(true); }}>
                                    Delete IP Block
                                </Button>
                            </div>
                        }
                    >
                        {!allocations ? (
                            <div css={tw`py-8`}>
                                <Spinner centered size={'large'} />
                            </div>
                        ) : (
                            <Pagination data={allocations} onPageSelect={setPage}>
                                {({ items }) =>
                                    items.length > 0 ? (
                                        <AdminTable>
                                            <AdminTableHead>
                                                <tr>
                                                    <AdminTableHeader css={tw`w-8`}>
                                                        <input
                                                            type={'checkbox'}
                                                            checked={items.filter(a => !a.assigned).length > 0 && selected.size === items.filter(a => !a.assigned).length}
                                                            onChange={toggleSelectAll}
                                                            css={tw`cursor-pointer`}
                                                        />
                                                    </AdminTableHeader>
                                                    <AdminTableHeader>IP Address</AdminTableHeader>
                                                    <AdminTableHeader>IP Alias</AdminTableHeader>
                                                    <AdminTableHeader>Port</AdminTableHeader>
                                                    <AdminTableHeader>Assigned To</AdminTableHeader>
                                                    <AdminTableHeader css={tw`w-12`}></AdminTableHeader>
                                                </tr>
                                            </AdminTableHead>
                                            <AdminTableBody>
                                                {items.map((allocation) => (
                                                    <AdminTableRow key={allocation.id}>
                                                        <AdminTableCell>
                                                            <input
                                                                type={'checkbox'}
                                                                disabled={allocation.assigned}
                                                                checked={selected.has(allocation.id)}
                                                                onChange={() => toggleSelection(allocation.id)}
                                                                css={tw`cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed`}
                                                            />
                                                        </AdminTableCell>
                                                        <AdminTableCell>{allocation.ip}</AdminTableCell>
                                                        <AdminTableCell css={tw`w-40`}>
                                                            <AliasInput allocation={allocation} nodeId={node.id} onUpdated={() => mutate()} />
                                                        </AdminTableCell>
                                                        <AdminTableCell>{allocation.port}</AdminTableCell>
                                                        <AdminTableCell>
                                                            {allocation.assigned && allocation.serverId
                                                                ? <Link to={`/admin/servers/${allocation.serverId}`} css={tw`text-primary-400 hover:text-primary-300`}>Server #{allocation.serverId}</Link>
                                                                : <span css={tw`text-neutral-500`}></span>
                                                            }
                                                        </AdminTableCell>
                                                        <AdminTableCell>
                                                            {!allocation.assigned && (
                                                                <button
                                                                    onClick={() => handleDelete(allocation.id)}
                                                                    css={tw`text-neutral-400 hover:text-red-400 transition-colors duration-150`}
                                                                >
                                                                    <FontAwesomeIcon icon={faTrash} />
                                                                </button>
                                                            )}
                                                        </AdminTableCell>
                                                    </AdminTableRow>
                                                ))}
                                            </AdminTableBody>
                                        </AdminTable>
                                    ) : (
                                        <p css={tw`text-center text-sm text-neutral-400 py-6`}>
                                            No allocations have been created for this node.
                                        </p>
                                    )
                                }
                            </Pagination>
                        )}
                    </AdminBox>
                </div>

                {/* Right column — Create allocations */}
                <div>
                    <AdminBox title={'Assign New Allocations'}>
                        <Formik<CreateValues>
                            initialValues={{ ip: '', alias: '', ports: '' }}
                            validationSchema={createSchema}
                            onSubmit={submitCreate}
                        >
                            {({ isSubmitting }) => (
                                <Form>
                                    <SpinnerOverlay visible={isSubmitting} />
                                    <div css={tw`mb-4`}>
                                        <Field
                                            name={'ip'}
                                            label={'IP Address'}
                                            placeholder={'0.0.0.0'}
                                            description={'Enter an IP address to assign ports to.'}
                                        />
                                    </div>
                                    <div css={tw`mb-4`}>
                                        <Field
                                            name={'alias'}
                                            label={'IP Alias'}
                                            placeholder={'alias'}
                                            description={'Assign a default alias to these allocations.'}
                                        />
                                    </div>
                                    <div css={tw`mb-4`}>
                                        <Field
                                            name={'ports'}
                                            label={'Ports'}
                                            placeholder={'25565-25570 or 25565,25566'}
                                            description={'Enter individual ports or port ranges separated by commas or spaces.'}
                                        />
                                    </div>
                                    <div css={tw`flex justify-end`}>
                                        <Button type={'submit'} color={'green'} size={'small'}>
                                            Submit
                                        </Button>
                                    </div>
                                </Form>
                            )}
                        </Formik>
                    </AdminBox>
                </div>
            </div>
        </>
    );
};

export default NodeAllocations;
