import styled from 'styled-components';
import tw from 'twin.macro';

const AdminStatusBadge = styled.span<{ $color: 'green' | 'yellow' | 'red' | 'maroon' | 'default' }>`
    ${tw`inline-block px-2 py-0.5 rounded text-xs font-bold uppercase`};
    ${(props) => props.$color === 'green' && tw`bg-green-600 text-green-50`};
    ${(props) => props.$color === 'yellow' && tw`bg-yellow-600 text-yellow-50`};
    ${(props) => props.$color === 'red' && tw`bg-red-600 text-red-50`};
    ${(props) => props.$color === 'maroon' && tw`bg-red-800 text-red-100`};
    ${(props) => props.$color === 'default' && tw`bg-neutral-600 text-neutral-300`};
`;

export default AdminStatusBadge;
