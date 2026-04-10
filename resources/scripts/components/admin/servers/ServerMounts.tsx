import React, { useContext, useEffect, useState } from 'react';
import tw from 'twin.macro';
import useSWR from 'swr';
import http, { FractalResponseData } from '@/api/http';
import { getMounts, Mount } from '@/api/admin/mounts';
import Spinner from '@/components/elements/Spinner';
import Button from '@/components/elements/Button';
import Select from '@/components/elements/Select';
import Label from '@/components/elements/Label';
import ConfirmationModal from '@/components/elements/ConfirmationModal';
import useFlash from '@/plugins/useFlash';
import { AdminServerContext } from '@/components/admin/servers/ServerRouter';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash } from '@fortawesome/free-solid-svg-icons';
import AdminBox from '@/components/admin/AdminBox';
import { AdminTable, AdminTableHead, AdminTableBody, AdminTableHeader, AdminTableRow, AdminTableCell } from '@/components/admin/AdminTable';
import FlashMessageRender from '@/components/FlashMessageRender';

interface ServerMount {
    id: number;
    uuid: string;
    name: string;
    source: string;
    target: string;
    readOnly: boolean;
}

const rawDataToServerMount = (data: any): ServerMount => ({
    id: data.id, uuid: data.uuid, name: data.name,
    source: data.source, target: data.target, readOnly: data.read_only,
});

const ServerMounts = () => {
    const { server } = useContext(AdminServerContext);
    const { addFlash, clearFlashes, clearAndAddHttpError } = useFlash();
    const [selectedMountId, setSelectedMountId] = useState<number>(0);
    const [detachId, setDetachId] = useState<number | null>(null);

    const { data: serverMounts, error, mutate } = useSWR(
        `/api/application/servers/${server.id}/mounts`,
        () => http.get(`/api/application/servers/${server.id}/mounts`)
            .then(({ data }) => (data.data || []).map((d: FractalResponseData) => rawDataToServerMount(d.attributes)))
    );

    const { data: allMounts } = useSWR<Mount[]>('/api/application/mounts:all', getMounts);

    useEffect(() => {
        if (error) clearAndAddHttpError({ key: 'admin:server:mounts', error });
        if (!error) clearFlashes('admin:server:mounts');
    }, [error]);

    const handleAttach = () => {
        if (!selectedMountId) return;
        http.post(`/api/application/servers/${server.id}/mounts/${selectedMountId}`)
            .then(() => { addFlash({ key: 'admin:server:mounts', type: 'success', message: 'Mount attached.' }); setSelectedMountId(0); mutate(); })
            .catch((error) => clearAndAddHttpError({ key: 'admin:server:mounts', error }));
    };

    const handleDetach = () => {
        if (!detachId) return;
        http.delete(`/api/application/servers/${server.id}/mounts/${detachId}`)
            .then(() => { addFlash({ key: 'admin:server:mounts', type: 'success', message: 'Mount detached.' }); setDetachId(null); mutate(); })
            .catch((error) => { setDetachId(null); clearAndAddHttpError({ key: 'admin:server:mounts', error }); });
    };

    const attachedIds = new Set((serverMounts || []).map((m: ServerMount) => m.id));
    const availableMounts = (allMounts || []).filter((m) => !attachedIds.has(m.id));

    return (
        <>
            <FlashMessageRender byKey={'admin:server:mounts'} css={tw`mb-4`} />
            <ConfirmationModal visible={!!detachId} title={'Detach Mount'} buttonText={'Yes, Detach'} onConfirmed={handleDetach} onModalDismissed={() => setDetachId(null)}>
                Are you sure you want to detach this mount?
            </ConfirmationModal>

            {availableMounts.length > 0 && (
                <AdminBox title={'Attach Mount'} css={tw`mb-4`}>
                    <div css={tw`flex items-end gap-4`}>
                        <div css={tw`flex-1`}>
                            <Label>Select Mount</Label>
                            <Select value={selectedMountId} onChange={(e) => setSelectedMountId(Number(e.target.value))}>
                                <option value={0}>Select a mount...</option>
                                {availableMounts.map((mount) => (
                                    <option key={mount.id} value={mount.id}>{mount.name} ({mount.source} → {mount.target})</option>
                                ))}
                            </Select>
                        </div>
                        <Button color={'green'} size={'xsmall'} onClick={handleAttach} disabled={!selectedMountId}>Attach</Button>
                    </div>
                </AdminBox>
            )}

            {!serverMounts ? (
                <Spinner centered size={'large'} />
            ) : (
                <AdminBox title={'Attached Mounts'} noPadding>
                    {serverMounts.length > 0 ? (
                        <AdminTable>
                            <AdminTableHead>
                                <tr>
                                    <AdminTableHeader>Name</AdminTableHeader>
                                    <AdminTableHeader>Source</AdminTableHeader>
                                    <AdminTableHeader>Target</AdminTableHeader>
                                    <AdminTableHeader className={'text-center'}>Mode</AdminTableHeader>
                                    <AdminTableHeader></AdminTableHeader>
                                </tr>
                            </AdminTableHead>
                            <AdminTableBody>
                                {serverMounts.map((mount: ServerMount) => (
                                    <AdminTableRow key={mount.id}>
                                        <AdminTableCell>{mount.name}</AdminTableCell>
                                        <AdminTableCell><code>{mount.source}</code></AdminTableCell>
                                        <AdminTableCell><code>{mount.target}</code></AdminTableCell>
                                        <AdminTableCell className={'text-center'}>{mount.readOnly ? 'RO' : 'RW'}</AdminTableCell>
                                        <AdminTableCell className={'text-center'}>
                                            <button onClick={() => setDetachId(mount.id)} css={tw`text-neutral-400 hover:text-red-400`}>
                                                <FontAwesomeIcon icon={faTrash} />
                                            </button>
                                        </AdminTableCell>
                                    </AdminTableRow>
                                ))}
                            </AdminTableBody>
                        </AdminTable>
                    ) : (
                        <p css={tw`text-center text-sm text-neutral-400 py-6`}>No mounts are attached to this server.</p>
                    )}
                </AdminBox>
            )}
        </>
    );
};

export default ServerMounts;
