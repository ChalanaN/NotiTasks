import { Client } from "@notionhq/client"
import { NotionTask, defaultWorkspace } from "."
import DATABASE_IDS from "./env"
import {
    PageObjectResponse,
    QueryDatabaseResponse
} from "@notionhq/client/build/src/api-endpoints"
import { configDotenv } from "dotenv"

configDotenv()

const notion = new Client({
    auth: process.env.NOTION_KEY
})

export const printTask = async (task: PageObjectResponse) => {
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
            task.properties.Due.date.start
        } ${
            // @ts-ignore
            task.properties.Due.date.end != null ? "→ " + task.properties.Due.date.end : ""
        } ${
            projectName != "No Project" ? projectName : ""
        }`
    )
}

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
        let workspace = (
            await notion.databases.query({
                database_id: DATABASE_IDS.WORKSPACES,
                filter: {
                    property: "Name",
                    title: {
                        contains: task.workspace || defaultWorkspace
                    }
                }
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
                            equals: "No Project"
                        }
                    },
                    {
                        property: "Workspace",
                        relation: {
                            contains: workspace.id
                        }
                    }
                ]
            }
        })
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
            Due: {
                type: "date",
                date: {
                    start: task.date.start
                }
            },
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
}

export { addTask }
