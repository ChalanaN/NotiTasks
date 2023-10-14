import { configDotenv } from "dotenv"
import { addTask } from "./notion"
import { connectToWhatsApp } from "./whatsapp"
import parseMessage from "./parser"

configDotenv()

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

export const defaultWorkspace = "Personal"

connectToWhatsApp()

process.stdin.resume()

process.stdin.on("data", async function (input) {
    addTask(parseMessage(input.toString()))
})
