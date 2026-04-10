import fs from 'node:fs';
import path from 'node:path';
import type { Request, Response } from '@/types/express.js';
import { config } from '../../config/index.js';
import { prisma } from '../../prisma/client.js';

const PUBLIC_PATH = path.resolve(import.meta.dir, '../../../..', 'public');
const MANIFEST_PATH = path.join(PUBLIC_PATH, 'assets', 'manifest.json');

interface ManifestEntry {
    src: string;
    integrity: string;
}

type Manifest = Record<string, ManifestEntry>;

let manifestCache: Manifest | null = null;

function getManifest(): Manifest {
    if (!manifestCache) {
        const raw = fs.readFileSync(MANIFEST_PATH, 'utf-8');
        manifestCache = JSON.parse(raw);
    }
    return manifestCache!;
}

function getAssetUrl(resource: string): string {
    const manifest = getManifest();
    const file = resource.split('/').pop() ?? resource;
    const entry = manifest[file];
    return entry?.src ?? `/assets/${file}`;
}

function getJsTag(resource: string): string {
    const src = getAssetUrl(resource);
    return `<script src="${src}" crossorigin="anonymous"></script>`;
}

/**
 * Generate the SPA HTML shell that mirrors wrapper.blade.php.
 * Injects PterodactylUser and SiteConfiguration for the React frontend.
 */
async function renderSpaHtml(req: Request): Promise<string> {
    // Load user from session if available (for authenticated SPA pages)
    let user = (req as any).user;
    if (!user && (req.session as any)?.userId) {
        try {
            user = await prisma.users.findUnique({ where: { id: (req.session as any).userId } });
        } catch {}
    }

    const siteConfiguration = {
        name: config.app.name,
        locale: config.app.locale,
        recaptcha: {
            enabled: false,
            siteKey: '',
        },
    };

    let userScript = '';
    if (user) {
        const userObj = {
            uuid: user.uuid,
            username: user.username,
            email: user.email,
            name_first: user.name_first,
            name_last: user.name_last,
            language: user.language,
            root_admin: Boolean(user.root_admin),
            use_totp: Boolean(user.use_totp),
            gravatar: Boolean(user.gravatar),
            created_at: user.created_at,
            updated_at: user.updated_at,
        };
        userScript = `<script>window.PterodactylUser = ${JSON.stringify(userObj)};</script>`;
    }

    return `<!DOCTYPE html>
<html>
  <head>
    <title>${config.app.name}</title>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" name="viewport">
    <meta name="robots" content="noindex">
    <link rel="apple-touch-icon" sizes="180x180" href="/favicons/apple-touch-icon.png">
    <link rel="icon" type="image/png" href="/favicons/favicon-32x32.png" sizes="32x32">
    <link rel="icon" type="image/png" href="/favicons/favicon-16x16.png" sizes="16x16">
    <link rel="manifest" href="/favicons/manifest.json">
    <link rel="mask-icon" href="/favicons/safari-pinned-tab.svg" color="#bc6e3c">
    <link rel="shortcut icon" href="/favicons/favicon.ico">
    <meta name="msapplication-config" content="/favicons/browserconfig.xml">
    <meta name="theme-color" content="#0e4688">
    ${userScript}
    <script>window.SiteConfiguration = ${JSON.stringify(siteConfiguration)};</script>
  </head>
  <body class="bg-neutral-50">
    <div id="modal-portal"></div>
    <div id="app"></div>
    ${getJsTag('main.js')}
  </body>
</html>`;
}

/**
 * Serve the SPA shell for all frontend routes.
 */
export async function serveSpa(req: Request, res: Response): Promise<void> {
    const html = await renderSpaHtml(req);
    res.type('html').send(html);
}
