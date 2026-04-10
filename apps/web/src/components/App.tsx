import { lazy } from 'react';
import { Route, Router, Switch } from 'react-router-dom';
import { StoreProvider } from 'easy-peasy';
import { store } from '@/state';
import ProgressBar from '@/components/elements/ProgressBar';
import { NotFound } from '@/components/elements/ScreenBlock';
import tw from 'twin.macro';
import GlobalStylesheet from '@/assets/css/GlobalStylesheet';
import { history } from '@/components/history';
import { setupInterceptors } from '@/api/interceptors';
import AuthenticatedRoute from '@/components/elements/AuthenticatedRoute';
import { ServerContext } from '@/state/server';
import '@/assets/tailwind.css';
import Spinner from '@/components/elements/Spinner';

const DashboardRouter = lazy(() => import('@/routers/DashboardRouter'));
const ServerRouter = lazy(() => import('@/routers/ServerRouter'));
const AuthenticationRouter = lazy(() => import('@/routers/AuthenticationRouter'));
const AdminRouter = lazy(() => import('@/routers/AdminRouter'));

setupInterceptors(history);

const App = () => (
    <>
        <GlobalStylesheet />
        <StoreProvider store={store}>
            <ProgressBar />
            <div css={tw`mx-auto w-auto`}>
                <Router history={history}>
                    <Switch>
                        <Route path={'/auth'}>
                            <Spinner.Suspense>
                                <AuthenticationRouter />
                            </Spinner.Suspense>
                        </Route>
                        <AuthenticatedRoute path={'/admin'}>
                            <Spinner.Suspense>
                                <AdminRouter />
                            </Spinner.Suspense>
                        </AuthenticatedRoute>
                        <AuthenticatedRoute path={'/server/:id'}>
                            <Spinner.Suspense>
                                <ServerContext.Provider>
                                    <ServerRouter />
                                </ServerContext.Provider>
                            </Spinner.Suspense>
                        </AuthenticatedRoute>
                        <AuthenticatedRoute path={'/'}>
                            <Spinner.Suspense>
                                <DashboardRouter />
                            </Spinner.Suspense>
                        </AuthenticatedRoute>
                        <Route path={'*'}>
                            <NotFound />
                        </Route>
                    </Switch>
                </Router>
            </div>
        </StoreProvider>
    </>
);

export default App;
