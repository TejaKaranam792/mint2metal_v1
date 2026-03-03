// Quick script to test compilation of orders.ts
import * as ts from "typescript";
import * as fs from "fs";

const fileName = "routes/orders.ts";
const program = ts.createProgram([fileName], {
  noEmit: true,
  target: ts.ScriptTarget.ES2022,
  moduleResolution: ts.ModuleResolutionKind.NodeJs,
  esModuleInterop: true,
});

const emitResult = program.emit();
const allDiagnostics = ts.getPreEmitDiagnostics(program).concat(emitResult.diagnostics);

let errors = 0;
allDiagnostics.forEach(diagnostic => {
  if (diagnostic.file && diagnostic.file.fileName.includes("orders.ts")) {
    const { line, character } = ts.getLineAndCharacterOfPosition(diagnostic.file, diagnostic.start!);
    const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
    console.log(`${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`);
    errors++;
  }
});

if (errors === 0) {
  console.log("No TypeScript errors in orders.ts!");
}
