import { Client } from "@notionhq/client"
import { NotionTask, defaultWorkspace } from "."
import DATABASE_IDS from "./env"
import {
    PageObjectResponse,
    QueryDatabaseResponse,
    UpdatePageParameters
} from "@notionhq/client/build/src/api-endpoints"
import { configDotenv } from "dotenv"

configDotenv()

const notion = new Client({
    auth: process.env.NOTION_KEY
})

const workspaceMap: { [id: string]: PageObjectResponse } = {},
    projectMap: { [id: string]: PageObjectResponse } = {}

loadMaps()

async function addTask(task: NotionTask) {
    let projectPage: QueryDatabaseResponse

    // Get the related project
    if (task.project) {
        projectPage = await notion.databases.query({
            database_id: DATABASE_IDS.PROJECTS,
            filter: {
                property: "Project name",
                title: {
                    contains: task.project
                }
            }
        })

        if (projectPage.results.length == 0)
            throw new Error("Project not found")
    } else {
        projectPage = await resolveProjectFromWorkspace(task.workspace)
    }

    // Create the task
    const response = await notion.pages.create({
        parent: {
            database_id: DATABASE_IDS.TASKS
        },
        properties: {
            title: {
                type: "title",
                title: [
                    {
                        type: "text",
                        text: {
                            content: task.title
                        }
                    }
                ]
            },
            Due: task.date.start ? ({
                type: "date",
                date: {
                    start: task.date.start,
                    end: task.date.end
                }
            }) : undefined,
            Project: {
                type: "relation",
                relation: [
                    {
                        id: projectPage.results[0].id
                    }
                ]
            }
        }
    })

    printTask(response)

    return { ...task, id: response.id }
}

async function updateTask(task: { id: string } & Partial<NotionTask>) {
    let properties: UpdatePageParameters["properties"] = {}

    task.title && (properties["title"] = {
        type: "title",
        title: [
            {
                type: "text",
                text: {
                    content: task.title
                }
            }
        ]
    })

    task.status && (properties["Status"] = {
        type: "status",
        status: {
            name: task.status
        }
    })

    task.date?.start && (properties["Due"] = {
        type: "date",
        date: {
            start: task.date.start,
            end: task.date.end
        }
    })

    if (task.project) {
        let projectId = Object.keys(projectMap).reduce((found, id) => {
            // @ts-ignore
            return projectMap[id].properties["Project name"].title[0].text.includes(task.project) ? id : found
        }, false) as string | false

        projectId && (properties["Project"] = {
            type: "relation",
            relation: [
                {
                    id: projectId
                }
            ]
        })
    } else if (task.workspace) {
        let projectId = (await resolveProjectFromWorkspace(task.workspace)).results[0].id

        projectId && (properties["Project"] = {
            type: "relation",
            relation: [
                {
                    id: projectId
                }
            ]
        })
    }

    printTask(await notion.pages.update({
        page_id: task.id,
        properties
    }) as PageObjectResponse)
}

function archiveTask(taskId: string) {
    return notion.pages.update({
        page_id: taskId,
        archived: true
    })
}

async function resolveProjectFromWorkspace(workspace: string) {
    let workspacePage = (
        await notion.databases.query({
            database_id: DATABASE_IDS.WORKSPACES,
            filter: {
                property: "Name",
                title: {
                    contains: workspace || defaultWorkspace
                }
            }
        })
    ).results?.[0]

    if (!workspacePage) throw new Error("Workspace not found")

    return await notion.databases.query({
        database_id: DATABASE_IDS.PROJECTS,
        filter: {
            and: [
                {
                    property: "Project name",
                    title: {
                        equals: "No Project"
                    }
                },
                {
                    property: "Workspace",
                    relation: {
                        contains: workspacePage.id
                    }
                }
            ]
        }
    })
}

async function printTask(task: PageObjectResponse) {
    let projectName = (await notion.pages.properties.retrieve({
        // @ts-ignore
        page_id: task.properties.Project.relation[0].id,
        property_id: "Project name"
        // @ts-ignore
    })).results[0].title.text.content

    console.log(
        `${
            // @ts-ignore
            (task.properties.Status.status.name as TaskStatus) == "In Progress"
                ? "\x1b[33m"
                : // @ts-ignore
                (task.properties.Status.status.name as TaskStatus) == "Done"
                ? "\x1b[32m"
                : "\x1b[90m"
            // @ts-ignore
        } ●\x1b[0m ${task.properties["Task name"].title[0].text.content} | ${
            // @ts-ignore
            task.properties.Due?.date?.start || ""
        } ${
            // @ts-ignore
            task.properties.Due?.date?.end != null ? "→ " + task.properties.Due.date.end : ""
        } ${
            projectName != "No Project" ? projectName : ""
        }`
    )
}

async function loadMaps() {
    (await notion.databases.query({
        database_id: DATABASE_IDS.WORKSPACES
    })).results.forEach(page => {
        // @ts-ignore
        workspaceMap[page.id] = page.properties
    });

    (await notion.databases.query({
        database_id: DATABASE_IDS.PROJECTS
    })).results.forEach(page => {
        // @ts-ignore
        projectMap[page.id] = page.properties
    })
}

export { addTask, updateTask, archiveTask, printTask }
