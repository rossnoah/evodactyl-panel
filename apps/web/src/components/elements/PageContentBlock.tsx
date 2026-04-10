import React, { useEffect, useRef } from 'react';
import ContentContainer from '@/components/elements/ContentContainer';
import { CSSTransition } from 'react-transition-group';
import tw from 'twin.macro';
import FlashMessageRender from '@/components/FlashMessageRender';

export interface PageContentBlockProps {
    title?: string;
    className?: string;
    showFlashKey?: string;
}

const PageContentBlock: React.FC<PageContentBlockProps> = ({ title, showFlashKey, className, children }) => {
    const nodeRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (title) {
            document.title = title;
        }
    }, [title]);

    return (
        <CSSTransition nodeRef={nodeRef} timeout={150} classNames={'fade'} appear in>
            <div ref={nodeRef}>
                <ContentContainer css={tw`my-4 sm:my-10`} className={className}>
                    {showFlashKey && <FlashMessageRender byKey={showFlashKey} css={tw`mb-4`} />}
                    {children}
                </ContentContainer>
                <ContentContainer css={tw`mb-4`}>
                    <p css={tw`text-center text-neutral-500 text-xs`}>
                        <a
                            rel={'noopener nofollow noreferrer'}
                            href={'https://pterodactyl.io'}
                            target={'_blank'}
                            css={tw`no-underline text-neutral-500 hover:text-neutral-300`}
                        >
                            Pterodactyl&reg;
                        </a>
                        &nbsp;&copy; 2015 - {new Date().getFullYear()}
                    </p>
                </ContentContainer>
            </div>
        </CSSTransition>
    );
};

export default PageContentBlock;
