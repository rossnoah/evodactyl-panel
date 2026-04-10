import React, { useContext } from 'react';
import { Link } from 'react-router-dom';
import tw from 'twin.macro';
import AdminBox from '@/components/admin/AdminBox';
import { AdminServerContext } from '@/components/admin/servers/ServerRouter';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUser, faServer } from '@fortawesome/free-solid-svg-icons';

const InfoRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <tr css={tw`border-b border-neutral-600 last:border-b-0`}>
        <td css={tw`py-2 pr-4 text-neutral-400 text-sm whitespace-nowrap`}>{label}</td>
        <td css={tw`py-2 text-sm`}>{children}</td>
    </tr>
);

const StatusBox = ({ color, label, value }: { color: string; label: string; value: string }) => (
    <div className={color} css={tw`rounded p-4 mb-4 flex items-center`}>
        <div>
            <p css={tw`text-sm`}>{label}</p>
            <p css={tw`text-lg font-bold`}>{value}</p>
        </div>
    </div>
);

const SidebarLink = ({ icon, label, to, value }: { icon: any; label: string; to: string; value: string }) => (
    <div css={tw`bg-neutral-700 rounded p-4 mb-4`}>
        <div css={tw`flex items-center mb-2`}>
            <FontAwesomeIcon icon={icon} css={tw`text-neutral-400 mr-3`} />
            <span css={tw`text-sm text-neutral-400`}>{label}</span>
        </div>
        <Link to={to} css={tw`text-primary-400 hover:text-primary-300 font-medium`}>{value}</Link>
    </div>
);

const ServerAbout = () => {
    const { server } = useContext(AdminServerContext);

    const isInstalled = server.status === null;
    const isInstallFailed = server.status === 'install_failed';

    return (
        <div css={tw`grid grid-cols-1 lg:grid-cols-3 gap-6`}>
            {/* Left column — Information */}
            <div css={tw`lg:col-span-2`}>
                <AdminBox title={'Information'}>
                    <table css={tw`w-full text-sm`}>
                        <tbody>
                            <InfoRow label={'Internal Identifier'}>
                                <code css={tw`bg-neutral-800 px-2 py-0.5 rounded text-xs`}>{server.id}</code>
                            </InfoRow>
                            <InfoRow label={'External Identifier'}>
                                {server.externalId
                                    ? <code css={tw`bg-neutral-800 px-2 py-0.5 rounded text-xs`}>{server.externalId}</code>
                                    : <span css={tw`text-neutral-500 text-xs bg-neutral-600 px-2 py-0.5 rounded`}>Not Set</span>
                                }
                            </InfoRow>
                            <InfoRow label={'UUID / Docker Container ID'}>
                                <code css={tw`bg-neutral-800 px-2 py-0.5 rounded text-xs`}>{server.uuid}</code>
                            </InfoRow>
                            <InfoRow label={'Current Egg'}>
                                {server.nest && server.egg ? (
                                    <Link to={`/admin/nests/${server.nestId}`} css={tw`text-primary-400 hover:text-primary-300`}>
                                        {server.nest.name}
                                    </Link>
                                ) : `Nest #${server.nestId}`}
                                {' \u2192 '}
                                {server.egg ? (
                                    <Link to={`/admin/nests/${server.nestId}`} css={tw`text-primary-400 hover:text-primary-300`}>
                                        {server.egg.name}
                                    </Link>
                                ) : `Egg #${server.eggId}`}
                            </InfoRow>
                            <InfoRow label={'Server Name'}>{server.name}</InfoRow>
                            <InfoRow label={'CPU Limit'}>
                                <code css={tw`bg-neutral-800 px-2 py-0.5 rounded text-xs`}>
                                    {server.limits.cpu === 0 ? 'Unlimited' : `${server.limits.cpu}%`}
                                </code>
                            </InfoRow>
                            <InfoRow label={'CPU Pinning'}>
                                {server.limits.threads
                                    ? <code css={tw`bg-neutral-800 px-2 py-0.5 rounded text-xs`}>{server.limits.threads}</code>
                                    : <span css={tw`text-neutral-500 text-xs bg-neutral-600 px-2 py-0.5 rounded`}>Not Set</span>
                                }
                            </InfoRow>
                            <InfoRow label={'Memory'}>
                                <code css={tw`bg-neutral-800 px-2 py-0.5 rounded text-xs`}>
                                    {server.limits.memory === 0 ? 'Unlimited' : `${server.limits.memory} MiB`}
                                </code>
                                {server.limits.swap !== 0 && (
                                    <span css={tw`text-neutral-500 text-xs ml-2`} title={`Swap: ${server.limits.swap === -1 ? 'Unlimited' : `${server.limits.swap} MiB`}`}>
                                        (Swap: {server.limits.swap === -1 ? 'Unlimited' : `${server.limits.swap} MiB`})
                                    </span>
                                )}
                            </InfoRow>
                            <InfoRow label={'Disk Space'}>
                                <code css={tw`bg-neutral-800 px-2 py-0.5 rounded text-xs`}>
                                    {server.limits.disk === 0 ? 'Unlimited' : `${server.limits.disk} MiB`}
                                </code>
                            </InfoRow>
                            <InfoRow label={'Block IO Weight'}>
                                <code css={tw`bg-neutral-800 px-2 py-0.5 rounded text-xs`}>{server.limits.io}</code>
                            </InfoRow>
                            <InfoRow label={'Default Connection'}>
                                <code css={tw`bg-neutral-800 px-2 py-0.5 rounded text-xs`}>
                                    {server.allocation
                                        ? `${server.allocation.ip}:${server.allocation.port}`
                                        : 'N/A'}
                                </code>
                            </InfoRow>
                            <InfoRow label={'Connection Alias'}>
                                {server.allocation?.alias
                                    ? server.allocation.alias
                                    : <span css={tw`text-neutral-500 text-xs bg-neutral-600 px-2 py-0.5 rounded`}>No Alias Assigned</span>
                                }
                            </InfoRow>
                        </tbody>
                    </table>
                </AdminBox>
            </div>

            {/* Right column — At-a-Glance */}
            <div>
                {/* Status indicators */}
                {server.suspended && (
                    <StatusBox color={'bg-yellow-700'} label={'This server is'} value={'Suspended'} />
                )}
                {!isInstalled && !server.suspended && (
                    <StatusBox
                        color={isInstallFailed ? 'bg-red-800' : 'bg-cyan-700'}
                        label={'This server is'}
                        value={isInstallFailed ? 'Install Failed' : 'Installing'}
                    />
                )}

                {/* Server Owner */}
                <SidebarLink
                    icon={faUser}
                    label={'Server Owner'}
                    to={`/admin/users/${server.userId}`}
                    value={server.user?.username || `User #${server.userId}`}
                />

                {/* Server Node */}
                <SidebarLink
                    icon={faServer}
                    label={'Server Node'}
                    to={`/admin/nodes/${server.nodeId}`}
                    value={server.node?.name || `Node #${server.nodeId}`}
                />
            </div>
        </div>
    );
};

export default ServerAbout;
