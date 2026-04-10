import React from 'react';
import styled, { keyframes } from 'styled-components/macro';
import tw from 'twin.macro';
import useSWR from 'swr';
import { getNodeSystemInfo } from '@/api/admin/nodes';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHeartbeat, faHeartBroken, faSync } from '@fortawesome/free-solid-svg-icons';

interface Props {
    nodeId: number;
}

const pulseAnimation = keyframes`
    0% { transform: scale(1); }
    50% { transform: scale(1.15); }
    100% { transform: scale(1); }
`;

const PulsingIcon = styled.span`
    color: #50af51;
    animation: ${pulseAnimation} 2s ease-in-out infinite;
    display: inline-block;
`;

const NodeHeartbeat = ({ nodeId }: Props) => {
    const { data, error } = useSWR(
        `/api/application/nodes/${nodeId}/system-information`,
        () => getNodeSystemInfo(nodeId),
        { refreshInterval: 10000, revalidateOnFocus: false, shouldRetryOnError: false }
    );

    // Loading state — spinning refresh icon (matches Blade's fa-refresh fa-spin)
    if (!data && !error) {
        return (
            <span css={tw`text-neutral-400`} title={'Connecting...'}>
                <FontAwesomeIcon icon={faSync} spin />
            </span>
        );
    }

    // Error state — broken/empty heart in red (matches Blade's fa-heart-o in #d9534f)
    if (error) {
        return (
            <span style={{ color: '#d9534f' }} title={'Error connecting to node! Check browser console for details.'}>
                <FontAwesomeIcon icon={faHeartBroken} />
            </span>
        );
    }

    // Online state — pulsing heartbeat in green (matches Blade's fa-heartbeat faa-pulse animated in #50af51)
    return (
        <PulsingIcon title={`v${data!.version}`}>
            <FontAwesomeIcon icon={faHeartbeat} />
        </PulsingIcon>
    );
};

export default NodeHeartbeat;
