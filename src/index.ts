export type TaskStatus = "Not started" | "In progress" | "Done" | "Archived"

export interface NotionTask {
    title: string
    project?: string
    associatedWith?: string
    date?: {
        start: string,
        end?: string
    }
    status?: TaskStatus
}