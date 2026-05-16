import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { input, select } from "@inquirer/prompts";
import "dotenv/config";
import { createDiagram } from "./mcp-server/tools/create-diagram.js";
import { updateDiagram } from "./mcp-server/tools/update-diagram.js";
import { listDiagrams } from "./mcp-server/tools/list-diagrams.js";

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
  .action(async (description: string | undefined, options: { style: string }) => {
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
    try {
      const result = await createDiagram({ description, style });
      spinner.succeed(chalk.green(`Diagram saved: ${chalk.bold(result.filePath)}`));
      console.log(chalk.dim(`  Elements: ${result.elementCount}`));
      console.log(chalk.cyan("  Open at: https://excalidraw.com/ (drag-and-drop the file)"));
    } catch (err) {
      spinner.fail(chalk.red(`Failed: ${err instanceof Error ? err.message : String(err)}`));
      process.exit(1);
    }
  });

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
    } catch (err) {
      spinner.fail(chalk.red(`Failed: ${err instanceof Error ? err.message : String(err)}`));
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
