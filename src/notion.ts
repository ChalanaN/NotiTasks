import { Client } from "@notionhq/client"
import DATABASE_IDS from "./env.js"
import {
    PageObjectResponse,
    QueryDatabaseResponse,
    UpdatePageParameters
} from "@notionhq/client/build/src/api-endpoints.js"
import { configDotenv } from "dotenv"
import stringWidth from "string-width"

configDotenv()

const notion = new Client({
    auth: process.env.NOTION_KEY
})

const defaultWorkspace = "Personal"
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
            },
            "Parent task": task.parentTask ? {
                type: "relation",
                relation: [
                    {
                        id: task.parentTask
                    }
                ]
            } : undefined
        }
    })

    printTask(response as PageObjectResponse, "[\x1b[32m NEW \x1b[0m]")

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

    task.parentTask && (properties["Parent task"] = {
        type: "relation",
        relation: [
            {
                id: task.parentTask
            }
        ]
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
    }) as PageObjectResponse, "[\x1b[33m UPDATED \x1b[0m]")
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

async function printTask(task: PageObjectResponse, specialNotes: string = "") {
    let projectName = (await notion.pages.properties.retrieve({
        // @ts-ignore
        page_id: task.properties.Project.relation[0].id,
        property_id: "Project name"
        // @ts-ignore
    })).results[0].title.text.content,
    projectNameString = `| ${
        projectName == "No Project"
        // @ts-ignore
        ? "#" + workspaceMap[projectMap[task.properties.Project.relation[0].id]?.Workspace?.relation[0].id]?.Name.title[0].text.content
        : projectName
    }`,
    // @ts-ignore
    taskNameString = (((task.properties.Status.status.name as TaskStatus) == "Done" || (task.properties.Status.status.name as TaskStatus) == "Archived") ? "\x1b[9m" : "") + task.properties["Task name"].title[0].text.content + "\x1b[0m" + " " + specialNotes + " ",
    // @ts-ignore
    statusIndicator = `${ (task.properties.Status.status.name as TaskStatus) == "In Progress" ? "\x1b[33m"
                    // @ts-ignore
                    : (task.properties.Status.status.name as TaskStatus) == "Done" ? "\x1b[32m"
                    : "\x1b[90m" } ●\x1b[0m`,
    // @ts-ignore
    dateString = `${ task.properties.Due?.date?.start != null ? " " + task.properties.Due?.date?.start : "" }${ task.properties.Due?.date?.end != null ? " → " + task.properties.Due.date.end : "" }`

    const leftString = `${ statusIndicator } ${ taskNameString }`,
        rightString = `${ dateString } ${ projectNameString }`,
        emptyColumns = process.stdout.columns - (stringWidth(leftString) + stringWidth(rightString))

    console.log(leftString + "\x1b[90m" + ".".repeat(emptyColumns) + "\x1b[0m" + rightString)
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

    console.log("✅ Maps Loaded")
}

export { addTask, updateTask, archiveTask, printTask }

export type TaskStatus = "Not Started" | "In Progress" | "Done" | "Archived"

export interface NotionTask {
    title: string
    project?: string
    workspace?: string
    date?: {
        start: string
        end?: string
    }
    status?: TaskStatus
    id?: string
    parentTask?: string
}
