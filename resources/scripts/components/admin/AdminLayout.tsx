import React, { useEffect } from 'react';
import tw from 'twin.macro';
import styled from 'styled-components/macro';
import NavigationBar from '@/components/NavigationBar';
import AdminSidebar from '@/components/admin/AdminSidebar';
import AdminContentHeader from '@/components/admin/AdminContentHeader';
import FlashMessageRender from '@/components/FlashMessageRender';

interface Breadcrumb {
    label: string;
    to?: string;
}

interface AdminLayoutProps {
    title: string;
    subtitle?: string;
    breadcrumbs?: Breadcrumb[];
    showFlashKey?: string;
    children: React.ReactNode;
}

const PageWrapper = styled.div`
    ${tw`flex flex-col min-h-screen`};
`;

const BodyWrapper = styled.div`
    ${tw`flex flex-1`};
    background: #2b303b;
`;

const ContentWrapper = styled.div`
    ${tw`flex-1 flex flex-col`};
    margin-left: 230px;
`;

const ContentHeader = styled.div`
    ${tw`px-6 pt-6 pb-0`};
`;

const ContentBody = styled.div`
    ${tw`px-6 py-4 flex-1`};
`;

const Footer = styled.footer`
    ${tw`px-6 py-4 text-xs text-neutral-500 border-t border-neutral-700`};

    & a {
        ${tw`text-neutral-400 no-underline hover:text-neutral-300`};
    }
`;

const AdminLayout: React.FC<AdminLayoutProps> = ({ title, subtitle, breadcrumbs, showFlashKey, children }) => {
    useEffect(() => {
        document.title = `${title} | Admin`;
    }, [title]);

    return (
        <PageWrapper>
            <NavigationBar />
            <BodyWrapper>
                <AdminSidebar />
                <ContentWrapper>
                    <ContentHeader>
                        <AdminContentHeader
                            title={title}
                            subtitle={subtitle}
                            breadcrumbs={breadcrumbs}
                        />
                        {showFlashKey && <FlashMessageRender byKey={showFlashKey} css={tw`mb-4`} />}
                    </ContentHeader>
                    <ContentBody>{children}</ContentBody>
                    <Footer>
                        Copyright &copy; 2015 - {new Date().getFullYear()}{' '}
                        <a href={'https://pterodactyl.io/'} target={'_blank'} rel={'noopener noreferrer'}>
                            Pterodactyl Software
                        </a>
                        .
                    </Footer>
                </ContentWrapper>
            </BodyWrapper>
        </PageWrapper>
    );
};

export default AdminLayout;
