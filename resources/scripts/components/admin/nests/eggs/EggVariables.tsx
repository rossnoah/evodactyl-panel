import React from 'react';
import tw from 'twin.macro';
import { EggVariable } from '@/api/admin/nests';
import GreyRowBox from '@/components/elements/GreyRowBox';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye, faEyeSlash, faPen, faBan } from '@fortawesome/free-solid-svg-icons';

interface Props {
    variables: EggVariable[];
}

const EggVariables = ({ variables }: Props) => {
    if (variables.length === 0) {
        return (
            <p css={tw`text-center text-sm text-neutral-400`}>
                No variables have been configured for this egg.
            </p>
        );
    }

    return (
        <div>
            {variables.map((variable, index) => (
                <GreyRowBox key={variable.id} $hoverable={false} css={index > 0 ? tw`mt-2` : undefined}>
                    <div css={tw`w-full`}>
                        <div css={tw`flex items-center justify-between mb-2`}>
                            <div>
                                <p css={tw`text-sm font-medium`}>{variable.name}</p>
                                <p css={tw`text-xs font-mono text-neutral-400`}>{variable.envVariable}</p>
                            </div>
                            <div css={tw`flex items-center space-x-3`}>
                                <span
                                    css={tw`text-xs`}
                                    title={variable.userViewable ? 'User Viewable' : 'Hidden from User'}
                                >
                                    <FontAwesomeIcon
                                        icon={variable.userViewable ? faEye : faEyeSlash}
                                        css={variable.userViewable ? tw`text-green-500` : tw`text-neutral-500`}
                                    />
                                    <span css={tw`ml-1 text-neutral-400`}>Viewable</span>
                                </span>
                                <span
                                    css={tw`text-xs`}
                                    title={variable.userEditable ? 'User Editable' : 'Read-only for User'}
                                >
                                    <FontAwesomeIcon
                                        icon={variable.userEditable ? faPen : faBan}
                                        css={variable.userEditable ? tw`text-green-500` : tw`text-neutral-500`}
                                    />
                                    <span css={tw`ml-1 text-neutral-400`}>Editable</span>
                                </span>
                            </div>
                        </div>
                        {variable.description && (
                            <p css={tw`text-xs text-neutral-400 mb-2`}>{variable.description}</p>
                        )}
                        <div css={tw`grid grid-cols-1 md:grid-cols-2 gap-4`}>
                            <div>
                                <p css={tw`text-xs text-neutral-400 uppercase`}>Default Value</p>
                                <p css={tw`text-sm font-mono bg-neutral-900 px-2 py-1 rounded mt-1`}>
                                    {variable.defaultValue || '(empty)'}
                                </p>
                            </div>
                            <div>
                                <p css={tw`text-xs text-neutral-400 uppercase`}>Validation Rules</p>
                                <p css={tw`text-sm font-mono bg-neutral-900 px-2 py-1 rounded mt-1`}>
                                    {variable.rules || '(none)'}
                                </p>
                            </div>
                        </div>
                    </div>
                </GreyRowBox>
            ))}
        </div>
    );
};

export default EggVariables;
