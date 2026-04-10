import React from 'react';
import tw from 'twin.macro';
import styled from 'styled-components/macro';

interface AdminBoxProps {
    title?: string;
    tools?: React.ReactNode;
    footer?: React.ReactNode;
    noPadding?: boolean;
    className?: string;
    children: React.ReactNode;
}

const BoxContainer = styled.div`
    ${tw`rounded shadow-md bg-neutral-700 overflow-hidden`};
`;

const BoxHeader = styled.div`
    ${tw`bg-neutral-800 px-4 py-3 flex items-center justify-between border-b border-neutral-600`};
`;

const BoxTitle = styled.h3`
    ${tw`text-sm font-medium text-neutral-200 m-0`};
`;

const BoxTools = styled.div`
    ${tw`flex items-center gap-2`};
`;

const BoxBody = styled.div<{ $noPadding?: boolean }>`
    ${(props) => (props.$noPadding ? tw`p-0` : tw`p-4`)};
`;

const BoxFooter = styled.div`
    ${tw`bg-neutral-800 px-4 py-3 border-t border-neutral-600`};
`;

const AdminBox: React.FC<AdminBoxProps> = ({ title, tools, footer, noPadding, className, children }) => (
    <BoxContainer className={className}>
        {(title || tools) && (
            <BoxHeader>
                {title && <BoxTitle>{title}</BoxTitle>}
                {tools && <BoxTools>{tools}</BoxTools>}
            </BoxHeader>
        )}
        <BoxBody $noPadding={noPadding}>{children}</BoxBody>
        {footer && <BoxFooter>{footer}</BoxFooter>}
    </BoxContainer>
);

export default AdminBox;
