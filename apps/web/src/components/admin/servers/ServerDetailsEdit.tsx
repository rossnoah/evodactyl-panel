import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Form, Formik, FormikHelpers, Field as FormikField } from 'formik';
import { object, string, number } from 'yup';
import tw from 'twin.macro';
import FlashMessageRender from '@/components/FlashMessageRender';
import TitledGreyBox from '@/components/elements/TitledGreyBox';
import Field from '@/components/elements/Field';
import Label from '@/components/elements/Label';
import Button from '@/components/elements/Button';
import SpinnerOverlay from '@/components/elements/SpinnerOverlay';
import FormikFieldWrapper from '@/components/elements/FormikFieldWrapper';
import { Textarea } from '@/components/elements/Input';
import useFlash from '@/plugins/useFlash';
import { updateServerDetails, searchUsers } from '@/api/admin/servers';
import { AdminServerContext } from '@/components/admin/servers/ServerRouter';

interface Values {
    name: string;
    description: string;
    user: number;
    externalId: string;
}

interface UserResult {
    id: number;
    username: string;
    email: string;
}

const schema = object().shape({
    name: string().required('A server name is required.').min(1),
    user: number().required('An owner user ID is required.').min(1, 'A valid user ID is required.'),
    externalId: string().nullable(),
});

const UserSearch = ({ value, onChange, currentUser }: {
    value: number;
    onChange: (userId: number) => void;
    currentUser?: { id: number; username: string; email: string };
}) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<UserResult[]>([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [selectedDisplay, setSelectedDisplay] = useState(
        currentUser ? `${currentUser.username} (${currentUser.email})` : `User #${value}`
    );
    const timerRef = useRef<ReturnType<typeof setTimeout>>();
    const containerRef = useRef<HTMLDivElement>(null);

    const doSearch = useCallback((q: string) => {
        if (q.length < 2) { setResults([]); return; }
        searchUsers(q)
            .then(setResults)
            .catch(() => setResults([]));
    }, []);

    const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const q = e.target.value;
        setQuery(q);
        setShowDropdown(true);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => doSearch(q), 300);
    };

    const handleSelect = (user: UserResult) => {
        onChange(user.id);
        setSelectedDisplay(`${user.username} (${user.email})`);
        setQuery('');
        setShowDropdown(false);
        setResults([]);
    };

    // Close dropdown on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => { document.removeEventListener('mousedown', handler); if (timerRef.current) clearTimeout(timerRef.current); };
    }, []);

    return (
        <div ref={containerRef} css={tw`relative`}>
            <Label>Server Owner</Label>
            <div css={tw`text-sm text-neutral-300 mb-2`}>
                Current: <span css={tw`text-neutral-100`}>{selectedDisplay}</span>
            </div>
            <input
                type={'text'}
                value={query}
                onChange={handleInput}
                onFocus={() => { if (results.length > 0) setShowDropdown(true); }}
                placeholder={'Search by email...'}
                css={tw`w-full bg-neutral-600 border border-neutral-500 rounded px-3 py-2 text-sm text-neutral-200 outline-none focus:border-primary-400`}
            />
            {showDropdown && results.length > 0 && (
                <div css={tw`absolute z-10 w-full mt-1 bg-neutral-700 border border-neutral-500 rounded shadow-lg max-h-48 overflow-y-auto`}>
                    {results.map(user => (
                        <button
                            key={user.id}
                            type={'button'}
                            onClick={() => handleSelect(user)}
                            css={tw`w-full text-left px-3 py-2 text-sm hover:bg-neutral-600 transition-colors`}
                        >
                            <span css={tw`text-neutral-100`}>{user.username}</span>
                            <span css={tw`text-neutral-400 ml-2`}>{user.email}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

const ServerDetailsEdit = () => {
    const { server, setServer } = useContext(AdminServerContext);
    const { addFlash, clearFlashes, clearAndAddHttpError } = useFlash();

    const submit = (values: Values, { setSubmitting }: FormikHelpers<Values>) => {
        clearFlashes('admin:server:details');

        updateServerDetails(server.id, {
            name: values.name,
            description: values.description || undefined,
            user: values.user,
            external_id: values.externalId || null,
        })
            .then((updatedServer) => {
                setServer({ ...server, ...updatedServer });
                addFlash({ key: 'admin:server:details', type: 'success', message: 'Server details have been updated.' });
            })
            .catch((error) => clearAndAddHttpError({ key: 'admin:server:details', error }))
            .finally(() => setSubmitting(false));
    };

    return (
        <>
            <FlashMessageRender byKey={'admin:server:details'} css={tw`mb-4`} />
            <Formik
                onSubmit={submit}
                initialValues={{
                    name: server.name,
                    description: server.description,
                    user: server.userId,
                    externalId: server.externalId || '',
                }}
                validationSchema={schema}
            >
                {({ isSubmitting, values, setFieldValue }) => (
                    <TitledGreyBox title={'Edit Details'} css={tw`relative`}>
                        <SpinnerOverlay visible={isSubmitting} />
                        <Form css={tw`mb-0`}>
                            <div css={tw`mb-4`}>
                                <Field id={'name'} name={'name'} label={'Server Name'} type={'text'} />
                            </div>
                            <div css={tw`mb-4`}>
                                <Label>Description</Label>
                                <FormikFieldWrapper name={'description'}>
                                    <FormikField as={Textarea} name={'description'} rows={3} />
                                </FormikFieldWrapper>
                            </div>
                            <div css={tw`mb-4`}>
                                <UserSearch
                                    value={values.user}
                                    onChange={(userId) => setFieldValue('user', userId)}
                                    currentUser={server.user}
                                />
                            </div>
                            <div css={tw`mb-4`}>
                                <Field
                                    id={'externalId'}
                                    name={'externalId'}
                                    label={'External ID'}
                                    type={'text'}
                                    description={'Leave blank for no external identifier.'}
                                />
                            </div>
                            <div css={tw`text-right`}>
                                <Button type={'submit'}>Update Details</Button>
                            </div>
                        </Form>
                    </TitledGreyBox>
                )}
            </Formik>
        </>
    );
};

export default ServerDetailsEdit;
