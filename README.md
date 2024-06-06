# NotiTasks ✅
Easier way to manage tasks in notion with natural language

> ⚠️ **Disclaimer:** This is a personal project of mine and it doesn't suit all the notion templates and workspaces. Clone it and give it a try!

## Why NotiTasks?
When I first tried Notion, I felt hopeless cause it was very complicated for me. Later I learned Notion and it felt much better. I got to understand the power of notion so I used it as my daily task manager.
But one problem still remained and that's how many clicks I had to do in order to create just a simple task. I got inspiration from Microsoft To Do and made NotiTasks, a simple program that turns a text into a task on Notion.

## Before You Begin

### Setting Up Notion

Use this link to setup a Notion Integration and give it access to the databases:
https://developers.notion.com/docs/create-a-notion-integration

### Setting Up WhatsApp Webhook

Use this link to setup a Meta App and create a webhook:
https://developers.facebook.com/docs/whatsapp/business-management-api/guides/set-up-webhooks

### Additional Files to Make
| File | Format |
|------|--------|
|`.env`| File should contain `NOTION_KEY`, `WEBHOOK_VERIFY_TOKEN`, `PORT`, `WEBHOOK_PATHNAME`, `CERT_PATH` |
|`./src/env.ts` | File should export an object `DATABASE_IDS: { [x: string]: string }` as default |

### Hosting the Webhook

This app should be hosted on a server with https (you can use [glitch](https://glitch.com/))