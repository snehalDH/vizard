import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { input, select } from "@inquirer/prompts";
import "dotenv/config";
import { createDiagram } from "./mcp-server/tools/create-diagram.js";
import { updateDiagram } from "./mcp-server/tools/update-diagram.js";
import { listDiagrams } from "./mcp-server/tools/list-diagrams.js";
import { loadTemplate, TEMPLATE_NAMES } from "./utils/templates.js";

const VALID_STYLES = ["flowchart", "sequence", "architecture"] as const;
type DiagramStyle = (typeof VALID_STYLES)[number];

const program = new Command();

program
  .name("vizard")
  .description("Generate and manage Excalidraw diagrams from plain English")
  .version("1.0.0");

program
  .command("create [description]")
  .description("Create a new diagram from a plain-English description")
  .option(
    "-s, --style <style>",
    "Diagram style: flowchart | sequence | architecture",
    "architecture"
  )
  .option(
    "-t, --template <name>",
    `Use a pre-built template: ${TEMPLATE_NAMES.join(", ")}`
  )
  .action(
    async (
      description: string | undefined,
      options: { style: string; template?: string }
    ) => {
      // Template takes priority over interactive description
      if (options.template) {
        const spinner = ora(`Loading template "${options.template}"...`).start();
        try {
          description = await loadTemplate(options.template);
          spinner.succeed(chalk.dim(`Template loaded: ${options.template}`));
        } catch (err) {
          spinner.fail(chalk.red(err instanceof Error ? err.message : String(err)));
          process.exit(1);
        }
      }

      if (!description) {
        description = await input({ message: "Describe your diagram:" });
      }

      let style: DiagramStyle = "architecture";
      if (VALID_STYLES.includes(options.style as DiagramStyle)) {
        style = options.style as DiagramStyle;
      } else {
        style = await select({
          message: "Choose a diagram style:",
          choices: VALID_STYLES.map((s) => ({ name: s, value: s })),
        });
      }

      const spinner = ora("Generating diagram with Gemini...").start();
      let currentFilePath: string;
      try {
        const result = await createDiagram({ description, style });
        spinner.succeed(chalk.green(`Diagram saved: ${chalk.bold(result.filePath)}`));
        console.log(chalk.dim(`  Elements: ${result.elementCount}`));
        console.log(chalk.dim(`  SVG:      ${result.svgPath}`));
        console.log(chalk.cyan("  Open at:  https://excalidraw.com/ (drag-and-drop the file)"));
        currentFilePath = result.filePath;
      } catch (err) {
        spinner.fail(
          chalk.red(`Failed: ${err instanceof Error ? err.message : String(err)}`)
        );
        process.exit(1);
      }

      // Multi-turn refinement loop
      console.log();
      while (true) {
        const changes = await input({
          message: chalk.dim("Refine this diagram? (describe changes or press Enter to finish):"),
        });
        if (!changes.trim() || changes.trim().toLowerCase() === "done") break;

        const updateSpinner = ora("Updating diagram...").start();
        try {
          const updated = await updateDiagram({ filePath: currentFilePath, changes });
          updateSpinner.succeed(
            chalk.green(`Diagram updated: ${chalk.bold(updated.filePath)}`)
          );
          console.log(chalk.dim(`  SVG: ${updated.svgPath}`));
        } catch (err) {
          updateSpinner.fail(
            chalk.red(`Update failed: ${err instanceof Error ? err.message : String(err)}`)
          );
        }
      }
    }
  );

program
  .command("update <file> [changes]")
  .description("Update an existing diagram with plain-English changes")
  .action(async (file: string, changes: string | undefined) => {
    if (!changes) {
      changes = await input({ message: "Describe the changes to make:" });
    }

    const spinner = ora("Updating diagram with Gemini...").start();
    try {
      const result = await updateDiagram({ filePath: file, changes });
      spinner.succeed(chalk.green(`Diagram updated: ${chalk.bold(result.filePath)}`));
      console.log(chalk.dim(`  SVG: ${result.svgPath}`));
    } catch (err) {
      spinner.fail(
        chalk.red(`Failed: ${err instanceof Error ? err.message : String(err)}`)
      );
      process.exit(1);
    }
  });

program
  .command("list")
  .description("List all saved diagrams")
  .action(async () => {
    try {
      const { diagrams } = await listDiagrams();
      if (diagrams.length === 0) {
        console.log(chalk.dim('\nNo diagrams found. Run "vizard create" to make one.\n'));
        return;
      }
      console.log(chalk.bold(`\n${diagrams.length} diagram(s):\n`));
      for (const d of diagrams) {
        console.log(`  ${chalk.cyan("•")} ${d}`);
      }
      console.log();
    } catch (err) {
      console.error(chalk.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
      process.exit(1);
    }
  });

program.parse();
