import dotenv from 'dotenv';

dotenv.config();

import {Gitlab} from '@gitbeaker/rest';

const api = new Gitlab({
    token: process.env.GITLAB_PRIVATE_TOKEN as string,
});

export async function getSubGroups() {
    return await api.Groups.allSubgroups(
        process.env.GITLAB_NAMESPACE_ID as string
    );
}

export async function mirror(repoUrl: string) {
    try {
        const groups = await getSubGroups();

        /* Remove trailing '/' for web URLs */
        if (repoUrl.endsWith('/')) {
            repoUrl = repoUrl.substring(0, repoUrl.length - 1);
        }

        /* Convert to .git URL */
        if (!repoUrl.endsWith('.git')) {
            repoUrl = repoUrl + '.git';
        }

        const repoUrlParts = repoUrl.split('/');
        const repoName = repoUrlParts[repoUrlParts.length - 1].replaceAll(
            '.git',
            ''
        );
        const groupName = repoUrlParts[repoUrlParts.length - 2];
        let existingGroup = groups.find((group) => group.name === groupName);
        if (!existingGroup) {
            /*
            TS2322: Type 'ExpandedGroupSchema' is not assignable to type 'GroupSchema & { statistics: GroupStatisticsSchema; }'.
            Property 'statistics' is missing in type 'ExpandedGroupSchema' but required in type '{ statistics: GroupStatisticsSchema; }'.
             */
            // @ts-ignore
            existingGroup = await api.Groups.create(groupName, groupName, {
                parentId: Number(process.env.GITLAB_NAMESPACE_ID as string),
            });
        }

        console.log(repoUrlParts);
        return;
        const project = await api.Projects.create({
            name: repoName,
            description: `Mirror of ${repoName}`,
            mirror: true,
            importUrl: repoUrl,
            namespaceId: existingGroup?.id,
        });

        await api.Projects.edit(project.id, {
            importUrl: repoUrl,
            mirror: true,
        });
        const mirrors = await api.ProjectRemoteMirrors.all(project.id);
        return project;
    } catch (e: unknown) {
        const error = e as Error;
        console.error('Failed to mirror repository', {
            error: {
                string: error.toString(),
                message: error.message,
                cause: error.cause,
                stack: error.stack,
            },
        });
        throw error;
    }
}
