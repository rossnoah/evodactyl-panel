import React from 'react';
import { Link } from 'react-router-dom';
import tw from 'twin.macro';

interface Breadcrumb {
    label: string;
    to?: string;
}

interface AdminContentHeaderProps {
    title: string;
    subtitle?: string;
    breadcrumbs?: Breadcrumb[];
}

const AdminContentHeader: React.FC<AdminContentHeaderProps> = ({ title, subtitle, breadcrumbs }) => (
    <div css={tw`mb-6 flex items-center justify-between`}>
        <h1 css={tw`text-2xl text-neutral-100 font-normal m-0`}>
            {title}
            {subtitle && <small css={tw`text-sm text-neutral-400 ml-2 font-normal`}>{subtitle}</small>}
        </h1>
        {breadcrumbs && breadcrumbs.length > 0 && (
            <ol css={tw`flex items-center gap-1 text-sm text-neutral-400 m-0 p-0 list-none`}>
                {breadcrumbs.map((crumb, index) => (
                    <React.Fragment key={index}>
                        {index > 0 && <li css={tw`mx-1`}>/</li>}
                        <li>
                            {crumb.to ? (
                                <Link to={crumb.to} css={tw`text-neutral-400 hover:text-neutral-200 no-underline`}>
                                    {crumb.label}
                                </Link>
                            ) : (
                                <span css={tw`text-neutral-200`}>{crumb.label}</span>
                            )}
                        </li>
                    </React.Fragment>
                ))}
            </ol>
        )}
    </div>
);

export default AdminContentHeader;
