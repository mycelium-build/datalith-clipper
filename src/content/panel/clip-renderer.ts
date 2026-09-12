import {
    createCompleter,
    interpreterAvailability,
    type CompleteSender,
} from "../../lib/interpreter"
import type { ClipperSettings } from "../../lib/settings-schema"
import { renderTemplate, type RenderOptions } from "../../lib/template"
import type { Template } from "../../lib/templates"

/**
 * Holds the shared variables of a Clip and produces the three render phases:
 *
 * - draft keeps `{{highlights}}` unresolved (and `{"prompt"}` unless exec-on-open)
 *   so the user edits the template, not the resolved text
 * - preview resolves highlights but keeps prompts as text
 * - save resolves everything
 */
export class ClipRenderer {
    readonly variables: Record<string, unknown>
    private readonly settings: ClipperSettings
    private readonly send: CompleteSender | undefined
    private rawContext = ""
    private interpreter: ((prompt: string) => Promise<string>) | undefined

    constructor(
        settings: ClipperSettings,
        variables: Record<string, unknown>,
        send?: CompleteSender,
    ) {
        this.settings = settings
        this.variables = variables
        this.send = send
    }

    /** Status line text when the interpreter is on but unusable, else null. */
    useTemplate(template: Template): string | null {
        const availability = interpreterAvailability(this.settings)
        this.rawContext =
            template.context !== "" ? template.context : this.settings.interpreter.context
        this.interpreter = availability.configured
            ? createCompleter(async () => {
                  try {
                      return await renderTemplate(this.rawContext, {
                          variables: this.variables,
                      })
                  } catch {
                      // Send the raw context rather than dropping the system message.
                      return this.rawContext
                  }
              }, this.send)
            : undefined
        if (availability.enabled && !availability.configured) {
            return "Interpreter is enabled but no model is configured, prompts render as plain text"
        }
        return null
    }

    draft(execOnOpen: boolean): RenderOptions {
        return {
            variables: this.variables,
            deferred: ["highlights"],
            keepPrompts: !execOnOpen,
            interpreter: execOnOpen ? this.interpreter : undefined,
        }
    }

    preview(): RenderOptions {
        return { variables: this.variables, keepPrompts: true }
    }

    save(): RenderOptions {
        return { variables: this.variables, interpreter: this.interpreter }
    }
}
