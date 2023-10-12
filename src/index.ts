import { configDotenv } from "dotenv"
import { addTask } from "./notion"

configDotenv()

export type TaskStatus = "Not started" | "In progress" | "Done" | "Archived"

export interface NotionTask {
    title: string
    project?: string
    workspace?: string
    date?: {
        start: string
        end?: string
    }
    status?: TaskStatus
}

export const defaultWorkspace = "Personal"
