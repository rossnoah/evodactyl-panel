import styled from 'styled-components/macro';
import tw from 'twin.macro';

export const AdminTable = styled.table`
    ${tw`w-full`};
`;

export const AdminTableHead = styled.thead``;

export const AdminTableBody = styled.tbody``;

export const AdminTableHeader = styled.th`
    ${tw`px-4 py-3 text-left text-xs font-bold uppercase text-neutral-400 bg-neutral-800`};

    &.text-center {
        ${tw`text-center`};
    }
`;

export const AdminTableRow = styled.tr`
    ${tw`border-b border-neutral-600 transition-colors duration-100`};

    &:last-of-type {
        ${tw`border-b-0`};
    }

    &:hover {
        ${tw`bg-neutral-600`};
    }
`;

export const AdminTableCell = styled.td`
    ${tw`px-4 py-3 text-sm text-neutral-200`};

    &.text-center {
        ${tw`text-center`};
    }

    & code {
        ${tw`bg-neutral-800 px-1.5 py-0.5 rounded text-xs font-mono text-neutral-300`};
    }

    & a {
        ${tw`text-primary-400 hover:text-primary-300 no-underline`};
    }
`;
