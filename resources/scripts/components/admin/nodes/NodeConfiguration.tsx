import React, { useEffect, useState } from 'react';
import tw from 'twin.macro';
import useSWR from 'swr';
import { Node, getNodeConfiguration, generateDeployToken } from '@/api/admin/nodes';
import FlashMessageRender from '@/components/FlashMessageRender';
import Spinner from '@/components/elements/Spinner';
import AdminBox from '@/components/admin/AdminBox';
import CopyOnClick from '@/components/elements/CopyOnClick';
import Button from '@/components/elements/Button';
import useFlash from '@/plugins/useFlash';

interface Props {
    node: Node;
}

const NodeConfiguration = ({ node }: Props) => {
    const { clearFlashes, clearAndAddHttpError } = useFlash();
    const [deployCommand, setDeployCommand] = useState<string | null>(null);
    const [generating, setGenerating] = useState(false);

    const { data: config, error } = useSWR<string>(
        `/api/application/nodes/${node.id}/configuration`,
        () => getNodeConfiguration(node.id)
    );

    useEffect(() => {
        if (error) clearAndAddHttpError({ key: 'admin:node:config', error });
        if (!error) clearFlashes('admin:node:config');
    }, [error]);

    const handleGenerateToken = () => {
        setGenerating(true);
        clearFlashes('admin:node:config');

        generateDeployToken(node.id)
            .then((data) => {
                const panelUrl = `${window.location.protocol}//${window.location.host}`;
                const cmd = `cd /etc/pterodactyl && sudo wings configure --panel-url ${panelUrl} --token ${data.token} --node ${data.node}`;
                setDeployCommand(cmd);
            })
            .catch((error) => {
                clearAndAddHttpError({ key: 'admin:node:config', error });
            })
            .finally(() => setGenerating(false));
    };

    return (
        <>
            <FlashMessageRender byKey={'admin:node:config'} css={tw`mb-4`} />

            <div css={tw`grid grid-cols-1 lg:grid-cols-3 gap-6`}>
                {/* Left column — Configuration file */}
                <div css={tw`lg:col-span-2`}>
                    <AdminBox title={'Configuration File'}>
                        {!config ? (
                            <Spinner centered size={'base'} />
                        ) : (
                            <>
                                <div css={tw`flex justify-end mb-3`}>
                                    <CopyOnClick text={config} showInNotification={false}>
                                        <Button size={'xsmall'} color={'primary'} isSecondary>
                                            Copy to Clipboard
                                        </Button>
                                    </CopyOnClick>
                                </div>
                                <pre css={tw`bg-neutral-900 p-4 rounded text-sm text-neutral-200 overflow-x-auto whitespace-pre-wrap`}>
                                    {config}
                                </pre>
                            </>
                        )}
                        <p css={tw`text-sm text-neutral-400 mt-4`}>
                            This file should be placed in your daemon&apos;s root directory (usually <code css={tw`bg-neutral-800 px-1 rounded`}>/etc/pterodactyl</code>) in a file called <code css={tw`bg-neutral-800 px-1 rounded`}>config.yml</code>.
                        </p>
                    </AdminBox>
                </div>

                {/* Right column — Auto-Deploy */}
                <div>
                    <AdminBox title={'Auto-Deploy'}>
                        <p css={tw`text-sm text-neutral-400 mb-4`}>
                            Use the button below to generate a custom deployment command that can be used to configure
                            wings on the target server with a single command.
                        </p>

                        {deployCommand && (
                            <CopyOnClick text={deployCommand}>
                                <pre css={tw`bg-neutral-900 p-3 rounded text-xs text-neutral-200 overflow-x-auto cursor-pointer mb-4 whitespace-pre-wrap break-all`}>
                                    {deployCommand}
                                </pre>
                            </CopyOnClick>
                        )}

                        <Button
                            size={'small'}
                            color={'primary'}
                            css={tw`w-full`}
                            isLoading={generating}
                            onClick={handleGenerateToken}
                        >
                            Generate Token
                        </Button>
                    </AdminBox>
                </div>
            </div>
        </>
    );
};

export default NodeConfiguration;
