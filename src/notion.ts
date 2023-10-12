import { Client } from "@notionhq/client"
import { NotionTask, defaultWorkspace } from "."
import DATABASE_IDS from "./env"
import { QueryDatabaseResponse } from "@notionhq/client/build/src/api-endpoints"

const notion = new Client({
    auth: process.env.NOTION_KEY,
})

async function addTask(task: NotionTask) {
    let projectPage: QueryDatabaseResponse

    // Get the related project
    if (task.project) {
        projectPage = await notion.databases.query({
            database_id: DATABASE_IDS.PROJECTS,
            filter: {
                property: "Project name",
                title: {
                    contains: task.project,
                },
            },
        })

        if (projectPage.results.length == 0)
            throw new Error("Project not found")
    } else {
        let workspace = (
            await notion.databases.query({
                database_id: DATABASE_IDS.WORKSPACES,
                filter: {
                    property: "Name",
                    title: {
                        contains: task.workspace || defaultWorkspace,
                    },
                },
            })
        ).results?.[0]

        if (!workspace) throw new Error("Workspace not found")

        projectPage = await notion.databases.query({
            database_id: DATABASE_IDS.PROJECTS,
            filter: {
                and: [
                    {
                        property: "Project name",
                        title: {
                            equals: "No Project",
                        },
                    },
                    {
                        property: "Workspace",
                        relation: {
                            contains: workspace.id,
                        },
                    },
                ],
            },
        })
    }

    // Create the task
    const response = await notion.pages.create({
        parent: {
            database_id: DATABASE_IDS.TASKS,
        },
        properties: {
            title: {
                type: "title",
                title: [
                    {
                        type: "text",
                        text: {
                            content: task.title,
                        },
                    },
                ],
            },
            Due: {
                type: "date",
                date: {
                    start: task.date.start,
                },
            },
            Project: {
                type: "relation",
                relation: [
                    {
                        id: projectPage.results[0].id,
                    },
                ],
            },
        },
    })

    console.log(response)
}

export { addTask }
