# NotiTasks ✅
Easier way to manage tasks in notion with natural language

Disclaimer: This is a personal project of mine and it doesn't suit all the notion templates and workspaces. Clone it and give it a try!

## Why NotiTasks?
When I first tried Notion, I felt hopeless cause it was very complicated for me. Later I learned Notion and it felt much better. I got to understand the power of notion so I used it as my daily task manager.
But one problem still remained and that's how many clicks I had to do in order to create just a simple task. I got inspiration from Microsoft To Do and made NotiTasks, a simple program that turns a text into a task on Notion.

## Additional files to make
| File | Format |
|------|--------|
|`.env`| File should contain the `NOTION_KEY` |
|`./src/env.ts` | File should export an object `DATABASE_IDS: { [x: string]: string }` as default |